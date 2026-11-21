/**
 * Seamless self-update for Aspera Hub.
 *
 * Model: the whole app (including the bundled Electron runtime) is replaced by a
 * new build, so "update Aspera Hub" == "update Electron". Users never manage
 * Electron themselves — every runtime change ships inside an Aspera Hub update.
 *
 * How it works:
 *  - Fetches a small JSON manifest (latest.json) from updateFeedUrl.
 *  - Compares versions (semver-ish) against app.getVersion().
 *  - Downloads the matching artifact for this install type (AppImage / deb / rpm),
 *    verifies SHA-256, then installs:
 *      AppImage → overwrite in place + relaunch (fully seamless)
 *      deb/rpm  → systemd-run + pkexec (or xdg-open .deb) + relaunch
 *                 (never pkexec as a direct Electron child — NO_NEW_PRIVS)
 *      dev/zip  → notify + reveal file (manual)
 *
 * Manifest shape (host anywhere static):
 * {
 *   "version": "0.2.0",
 *   "notes": "What changed",
 *   "pub_date": "2026-07-25T10:00:00Z",
 *   "mandatory": false,
 *   "files": {
 *     "appimage": { "url": "https://.../AsperaDock-0.2.0.AppImage", "sha256": "…", "size": 123 },
 *     "deb":      { "url": "https://.../asperadock_0.2.0_amd64.deb",  "sha256": "…", "size": 123 }
 *   }
 * }
 */

import { app, dialog, shell, BrowserWindow, Notification } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { GITHUB_UPDATE_FEED, GITHUB_SLUG } from './github.js';
import { assertHttpsUrl } from './netTrust.js';
import {
  extractWhatsNewNotes,
  formatUpdatePromptDetail,
} from './updateNotes.js';
import {
  formatDownloadErrorDetail,
  isRetryableDownloadError,
} from './updateDownloadErrors.js';
import {
  DOWNLOAD_STALL_MS,
  DOWNLOAD_STREAM_ATTEMPTS,
  partResumeOffset,
  rangeRequestHeaders,
  resolveDownloadTotal,
  shouldDiscardPartialOnError,
} from './updateDownloadStream.js';
import {
  stagePackageForElevatedInstall as stagePackageForElevatedInstallPure,
  shouldSilentInstallOnQuit,
} from './updateInstallPolicy.js';
import {
  compareVersions,
  resolveUpdateFeedUrl,
  synthesizeManifestFromGithubRelease,
  githubTaggedManifestUrl,
  shouldJumpToNewerUpdate,
  MAX_UPDATE_LATEST_HOPS,
} from './updateFeedResolve.js';

export {
  compareVersions,
  resolveUpdateFeedUrl,
  synthesizeManifestFromGithubRelease,
  githubTaggedManifestUrl,
  shouldJumpToNewerUpdate,
  MAX_UPDATE_LATEST_HOPS,
} from './updateFeedResolve.js';

/** Default feed: GitHub Releases (no custom server). */
const DEFAULT_FEED = GITHUB_UPDATE_FEED;
const CHECK_INTERVAL_MIN = 180; // 3h default

let settingsProvider = () => ({});
let reportError = () => {};
let beforeDialog = () => {};
let afterDialog = () => {};
let beforeRelaunch = () => {};
let mainWindowProvider = () => null;
let checkTimer = null;

/** @type {{version:string, notes?:string, mandatory?:boolean, file?:object}|null} */
let pendingUpdate = null;
let downloadedPath = null;
let busy = false;
/** Latest download-progress payload (for "already downloading" dialogs). */
let downloadProgress = null;
/** Version currently streaming to disk (may differ briefly from pendingUpdate). */
let activeDownloadVersion = null;
/**
 * Bumped when a newer release supersedes an in-flight download so the stream
 * aborts and restarts on absolute latest (never install N then N+1 then N+2).
 */
let downloadEpoch = 0;
let activeDownloadEpoch = 0;
/** True while Install & restart is waiting on dpkg / package UI. */
let installBusy = false;

export function configureUpdater({
  getSettings,
  getMainWindow,
  onError,
  onBeforeDialog,
  onAfterDialog,
  onBeforeRelaunch,
} = {}) {
  if (getSettings) settingsProvider = getSettings;
  if (getMainWindow) mainWindowProvider = getMainWindow;
  if (onError) reportError = onError;
  if (onBeforeDialog) beforeDialog = onBeforeDialog;
  if (onAfterDialog) afterDialog = onAfterDialog;
  if (onBeforeRelaunch) beforeRelaunch = onBeforeRelaunch;
}

export function isUpdateInstallBusy() {
  return installBusy;
}

function dialogParent() {
  try {
    const fromProvider = mainWindowProvider?.();
    if (fromProvider && !fromProvider.isDestroyed()) return fromProvider;
  } catch {
    // ignore
  }
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const all = BrowserWindow.getAllWindows().filter((w) => w && !w.isDestroyed());
  return all[0] || undefined;
}

async function showUpdateBox(options) {
  beforeDialog();
  try {
    const parent = dialogParent();
    // Never pass `undefined` as the first arg — Electron treats it as options and the dialog fails.
    if (parent) return await dialog.showMessageBox(parent, options);
    return await dialog.showMessageBox(options);
  } finally {
    afterDialog();
  }
}

function settings() {
  return settingsProvider() || {};
}

function currentVersion() {
  return app.getVersion();
}

function updatesDir() {
  const dir = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // ignore (e.g. unsupported on some FS)
  }
  return dir;
}

function feedUrl() {
  return resolveUpdateFeedUrl(settings(), DEFAULT_FEED);
}

/**
 * Pure feed URL resolver — see updateFeedResolve.js (re-exported).
 */

/** appimage | deb | rpm | dev | unknown */
export function detectPackaging() {
  if (!app.isPackaged) return 'dev';
  if (process.env.APPIMAGE) return 'appimage';
  const exec = process.execPath || '';
  // deb/rpm installs live under /opt or /usr
  if (exec.startsWith('/opt/') || exec.startsWith('/usr/')) {
    // Best-effort: detect dpkg vs rpm world.
    if (fs.existsSync('/usr/bin/dpkg') || fs.existsSync('/var/lib/dpkg')) return 'deb';
    if (fs.existsSync('/usr/bin/rpm') || fs.existsSync('/var/lib/rpm')) return 'rpm';
    return 'deb';
  }
  return 'unknown';
}

function pickFileForPackaging(manifest) {
  const files = manifest?.files || {};
  const kind = detectPackaging();
  if (kind === 'appimage' && files.appimage) return { kind, ...files.appimage };
  if (kind === 'deb' && files.deb) return { kind, ...files.deb };
  if (kind === 'rpm' && files.rpm) return { kind, ...files.rpm };
  // dev / unknown → prefer appimage, then deb, so a manual download still works.
  if (files.appimage) return { kind: 'appimage', ...files.appimage };
  if (files.deb) return { kind: 'deb', ...files.deb };
  if (files.rpm) return { kind: 'rpm', ...files.rpm };
  return null;
}

function broadcast(event, payload = {}) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('dock:update-event', { event, ...payload });
    } catch {
      // ignore
    }
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'User-Agent': 'AsperaHub-Updater',
      'X-AsperaDock-Version': currentVersion(),
    },
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Feed responded ${res.status}`);
  return res.json();
}

function usingDefaultGithubFeed() {
  return (
    !String(settings().updateFeedUrl || '').trim() &&
    String(settings().updateChannel || 'stable') === 'stable'
  );
}

/** GitHub CDN can lag on /releases/latest/download — API is fresher. */
async function fetchLatestGithubRelease() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_SLUG}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AsperaHub-Updater',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchLatestTagFromGithubApi() {
  const data = await fetchLatestGithubRelease();
  const tag = String(data?.tag_name || '')
    .replace(/^v/, '')
    .trim();
  return tag || null;
}

/**
 * When /releases/latest/download/latest.json 404s (release created before the
 * manifest asset lands, or a release shipped with only a .deb), resolve via the
 * Releases API asset URL, tag path, or synthesize from release assets.
 */
async function fetchManifestFromGithubReleaseApi(bust) {
  const data = await fetchLatestGithubRelease();
  if (!data) throw new Error('GitHub Releases API unavailable');
  const tag = String(data.tag_name || '')
    .replace(/^v/, '')
    .trim();
  if (!tag) throw new Error('GitHub Releases API missing tag');

  const assets = Array.isArray(data.assets) ? data.assets : [];
  const releaseNotes = extractWhatsNewNotes(data.body || '');
  const manifestAsset = assets.find((a) => String(a?.name || '') === 'latest.json');
  let manifest;
  if (manifestAsset?.browser_download_url) {
    const url = String(manifestAsset.browser_download_url);
    manifest = await fetchJson(`${url}${url.includes('?') ? '&' : '?'}${bust}`);
  } else {
    try {
      manifest = await fetchJson(`${githubTaggedManifestUrl(tag)}?${bust}`);
    } catch {
      manifest = synthesizeManifestFromGithubRelease(data);
      if (!manifest) {
        throw new Error(
          'Release has no latest.json and no installable .deb/.AppImage/.rpm asset',
        );
      }
    }
  }
  // Prefer explicit manifest notes; fall back to GitHub release body.
  if (manifest && !String(manifest.notes || '').trim() && releaseNotes) {
    manifest = { ...manifest, notes: releaseNotes };
  } else if (manifest && releaseNotes && String(manifest.notes || '').trim().length < 24) {
    manifest = { ...manifest, notes: releaseNotes };
  }
  return manifest;
}

async function enrichNotesFromGithub(manifest) {
  if (!manifest || !usingDefaultGithubFeed()) return manifest;
  const existing = extractWhatsNewNotes(manifest.notes || '');
  if (existing && existing.length >= 40) return { ...manifest, notes: existing };
  try {
    const data = await fetchLatestGithubRelease();
    const tag = String(data?.tag_name || '')
      .replace(/^v/, '')
      .trim();
    if (tag && tag !== String(manifest.version || '').trim()) return manifest;
    const fromBody = extractWhatsNewNotes(data?.body || '');
    if (!fromBody) return { ...manifest, notes: existing || manifest.notes || '' };
    if (!existing || fromBody.length > existing.length) {
      return { ...manifest, notes: fromBody };
    }
  } catch {
    // ignore
  }
  return { ...manifest, notes: existing || manifest.notes || '' };
}

async function fetchManifest() {
  const bust = `t=${Date.now()}&cv=${encodeURIComponent(currentVersion())}`;
  const base = feedUrl();
  const primaryUrl = `${base}${base.includes('?') ? '&' : '?'}${bust}`;
  const defaultGithub = usingDefaultGithubFeed();

  let manifest;
  let primaryError;
  try {
    manifest = await fetchJson(primaryUrl);
  } catch (error) {
    primaryError = error;
    if (!defaultGithub) throw error;
    try {
      manifest = await fetchManifestFromGithubReleaseApi(`t=${Date.now()}&fallback=api`);
    } catch (apiError) {
      // Brief retry — CI often uploads latest.json a few seconds after the .deb.
      await new Promise((resolve) => setTimeout(resolve, 1600));
      try {
        manifest = await fetchJson(
          `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}&retry=1`,
        );
      } catch {
        try {
          manifest = await fetchManifestFromGithubReleaseApi(
            `t=${Date.now()}&fallback=api-retry`,
          );
        } catch {
          throw primaryError;
        }
      }
    }
  }
  if (!manifest || !manifest.version) throw new Error('Manifest missing version');

  // Default GitHub feed only — verify against Releases API when CDN is stale.
  if (defaultGithub) {
    const apiVer = await fetchLatestTagFromGithubApi();
    if (apiVer && compareVersions(apiVer, manifest.version) > 0) {
      const tagUrl = `https://github.com/${GITHUB_SLUG}/releases/download/v${apiVer}/latest.json?${bust}`;
      try {
        const fresh = await fetchJson(tagUrl);
        if (fresh?.version && compareVersions(fresh.version, manifest.version) > 0) {
          manifest = fresh;
        }
      } catch {
        // Keep CDN manifest if tag asset fetch fails.
      }
    }
  }

  if (!manifest?.version) throw new Error('Manifest missing version');
  return manifest;
}

/** Drop on-disk artifacts that are not the absolute-latest pending package. */
function clearStaleUpdateArtifacts(keepVersion = null) {
  const keep = String(keepVersion || '').trim();
  try {
    if (
      downloadedPath &&
      fs.existsSync(downloadedPath) &&
      keep &&
      !String(downloadedPath).includes(keep)
    ) {
      clearConsumedUpdateArtifact(downloadedPath);
    }
  } catch {
    // ignore
  }
  if (downloadedPath && keep && !String(downloadedPath).includes(keep)) {
    downloadedPath = null;
  }
  try {
    const dir = updatesDir();
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (keep && name.includes(keep)) continue;
      if (!/\.(deb|AppImage|rpm|part)$/i.test(name)) continue;
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

async function applyPendingFromManifest(manifest) {
  const enriched = await enrichNotesFromGithub(manifest);
  const file = pickFileForPackaging(enriched);
  pendingUpdate = {
    version: enriched.version,
    notes: extractWhatsNewNotes(enriched.notes || '') || String(enriched.notes || ''),
    mandatory: !!enriched.mandatory,
    synthesized: !!enriched.synthesized,
    file,
  };
  return { enriched, file };
}

/**
 * Re-check the feed and jump pendingUpdate to absolute latest when it moved.
 * Prevents: download 0.5.88 → install → download 0.5.89 → install → …
 */
async function refreshPendingToAbsoluteLatest({ force = false } = {}) {
  const currentPending = String(pendingUpdate?.version || '').trim();
  let manifest;
  try {
    manifest = await fetchManifest();
  } catch (error) {
    if (force) throw error;
    return { switched: false, error: String(error?.message || error) };
  }
  const latest = String(manifest?.version || '').trim();
  if (!latest) return { switched: false };
  if (currentPending && !shouldJumpToNewerUpdate(currentPending, latest)) {
    return { switched: false, version: latest };
  }
  if (!currentPending && compareVersions(latest, currentVersion()) <= 0) {
    return { switched: false, version: latest };
  }
  clearStaleUpdateArtifacts(latest);
  downloadedPath = null;
  await applyPendingFromManifest(manifest);
  // Abort any in-flight stream so downloadUpdate restarts on the new file.
  downloadEpoch += 1;
  broadcast('available', {
    version: pendingUpdate.version,
    notes: pendingUpdate.notes,
    mandatory: !!pendingUpdate.mandatory,
    canAutoInstall: !!pendingUpdate.file,
    jumpedToLatest: true,
  });
  return { switched: true, version: pendingUpdate.version, from: currentPending || null };
}

/**
 * @returns {Promise<{available:boolean, version?:string, notes?:string, mandatory?:boolean, error?:string}>}
 */
export async function checkForUpdates({ silent = true, promptOnAvailable = false } = {}) {
  // An explicit "Check for updates" always runs, even with auto-update off.
  if (silent && settings().autoUpdateEnabled === false) {
    return { available: false, disabled: true };
  }

  if (installBusy) {
    return {
      available: true,
      version: pendingUpdate?.version,
      downloaded: true,
      installing: true,
    };
  }

  // Already downloaded and waiting? Jump to absolute latest first — never
  // install a stale N when N+1 is already on the feed.
  if (!silent && pendingUpdate && downloadedPath && fs.existsSync(downloadedPath)) {
    clearSnooze();
    const hop = await refreshPendingToAbsoluteLatest();
    if (hop.switched) {
      downloadUpdate({ quiet: false }).catch((err) =>
        reportError('update-download', { message: String(err) }),
      );
      return { available: true, version: pendingUpdate.version, jumpedToLatest: true };
    }
    await promptReady({ force: true });
    return { available: true, version: pendingUpdate.version, downloaded: true };
  }
  // Dev / npm start uses package.json 0.1.0 forever — don't spam "install .deb" nags.
  if (detectPackaging() === 'dev') {
    broadcast('up-to-date', { version: `${currentVersion()} (dev)` });
    if (!silent) {
      await showUpdateBox({
        type: 'info',
        title: 'Development build',
        message: `You are running a development build (v${currentVersion()}).`,
        detail:
          'Updates apply to the installed Aspera Hub package (/usr/bin/asperadock), not this npm start session.\n\nQuit this window and launch Aspera Hub from the app menu to use the installed version.',
        buttons: ['OK'],
      });
    }
    return { available: false, version: currentVersion(), dev: true };
  }
  broadcast('checking');
  try {
    const manifest = await fetchManifest();
    const newer = compareVersions(manifest.version, currentVersion()) > 0;
    const debVer = detectPackaging() === 'deb' ? readDebPackageVersion() : null;
    // Package already on disk (manual/systemd install) but this process is stale.
    if (debVer && compareVersions(debVer, manifest.version) >= 0) {
      if (compareVersions(currentVersion(), manifest.version) < 0) {
        const r = await showUpdateBox({
          type: 'info',
          title: 'Update installed',
          message: `Aspera Hub ${debVer} is installed. Restart to use it.`,
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
        });
        if (r.response === 0) relaunchAndExit();
        else snoozeUpdate(manifest.version);
        return { available: false, version: debVer, pendingRelaunch: true };
      }
      broadcast('up-to-date', { version: currentVersion() });
      if (!silent) {
        await showUpdateBox({
          type: 'info',
          title: 'Aspera Hub',
          message: 'You are up to date.',
          detail:
            `Running v${currentVersion()}` +
            (debVer && debVer !== currentVersion() ? ` · package v${debVer}` : '') +
            `\nLatest feed: v${manifest.version}`,
          buttons: ['OK'],
        });
      }
      return { available: false, version: currentVersion() };
    }
    if (!newer) {
      broadcast('up-to-date', { version: currentVersion() });
      if (!silent) {
        await showUpdateBox({
          type: 'info',
          title: 'Aspera Hub',
          message: 'You are up to date.',
          detail: `Running v${currentVersion()}\nLatest on GitHub Releases: v${manifest.version}`,
          buttons: ['OK'],
        });
      }
      return { available: false, version: currentVersion() };
    }

    // Manual check or startup prompt overrides an earlier "Later".
    if (!silent || promptOnAvailable) clearSnooze();

    if (silent && !promptOnAvailable && !manifest.mandatory && isUpdateSnoozed(manifest.version)) {
      broadcast('snoozed', { version: manifest.version });
      return { available: true, snoozed: true, version: manifest.version };
    }

    const { enriched, file } = await applyPendingFromManifest(manifest);

    // If an older package is mid-download, supersede it with absolute latest.
    if (
      busy &&
      activeDownloadVersion &&
      shouldJumpToNewerUpdate(activeDownloadVersion, enriched.version)
    ) {
      clearStaleUpdateArtifacts(enriched.version);
      downloadedPath = null;
      downloadEpoch += 1;
      broadcast('download-progress', {
        percent: 0,
        received: 0,
        total: Number(file?.size) || 0,
        retrying: true,
        jumpingToLatest: true,
        version: enriched.version,
      });
    }

    // Reuse a previously finished download only after SHA-256 re-verify,
    // and only when it matches absolute latest (never install an older hop).
    const existing = await findDownloadedArtifact(enriched.version, file);
    if (existing) downloadedPath = existing;
    else downloadedPath = null;

    broadcast('available', {
      version: enriched.version,
      notes: pendingUpdate.notes,
      mandatory: !!enriched.mandatory,
      canAutoInstall: !!file && ['appimage', 'deb', 'rpm'].includes(file.kind),
    });

    // Manual "Check for updates" must always show a dialog — auto-download with
    // no UI looked like the menu item was broken (80MB+ silent fetch).
    if (!silent) {
      if (downloadedPath && fs.existsSync(downloadedPath)) {
        await promptReady({ force: true });
      } else if (busy) {
        await showUpdateBox({
          type: 'info',
          title: 'Downloading update',
          message: `Aspera Hub ${enriched.version} is downloading…`,
          detail: formatUpdatePromptDetail({
            version: enriched.version,
            notes: pendingUpdate.notes,
            phase: 'downloading',
            progress: downloadProgress,
          }),
          buttons: ['OK'],
        });
      } else {
        await promptAvailable();
      }
    } else if (downloadedPath && fs.existsSync(downloadedPath)) {
      // Already on disk — prompt to install (first start + while using).
      await promptReady({ force: !!promptOnAvailable });
    } else if (promptOnAvailable || settings().autoUpdateDownload === false) {
      // Always tell the user an update exists on first start / while using.
      // If auto-download is off, silent checks must still prompt (not stay quiet).
      await promptAvailable();
    } else if (file) {
      downloadUpdate({ quiet: true }).catch((err) =>
        reportError('update-download', { message: String(err) }),
      );
    }
    return {
      available: true,
      version: enriched.version,
      notes: pendingUpdate.notes,
      mandatory: !!enriched.mandatory,
    };
  } catch (error) {
    const message = String(error?.message || error);
    broadcast('error', { message });
    reportError('update-check', { message });
    if (!silent) {
      const hint = /Feed responded 404/i.test(message)
        ? '\n\nThe update manifest may still be publishing. Aspera Hub will retry automatically, or try again in a minute.'
        : '';
      await showUpdateBox({
        type: 'error',
        title: 'Update check failed',
        message: 'Could not check for updates.',
        detail: `${message}${hint}`,
        buttons: ['OK'],
      });
    }
    return { available: false, error: message };
  }
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Reject non-HTTPS artifact URLs (feed integrity alone is not enough). */
function assertHttpsArtifactUrl(url) {
  return assertHttpsUrl(url, 'Update artifact URL');
}

/**
 * Verify on-disk artifact against the pending manifest SHA-256.
 * Deletes the file and clears downloadedPath on mismatch / missing checksum.
 */
async function assertDownloadedIntegrity(filePath = downloadedPath) {
  const expected = pendingUpdate?.file?.sha256;
  if (!expected) {
    // Synthesized manifests (release missing latest.json) omit SHA-256.
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('No update file available');
    }
    return filePath;
  }
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('No update file available');
  }
  const got = await sha256File(filePath);
  if (got.toLowerCase() !== String(expected).toLowerCase()) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
    if (downloadedPath === filePath) downloadedPath = null;
    throw new Error('Checksum mismatch — download rejected');
  }
  return filePath;
}

/**
 * When the manifest URL 404s (publish race / CDN lag), resolve the same
 * filename from the GitHub Releases API browser_download_url.
 */
async function resolveGithubAssetDownloadUrl(url) {
  if (!usingDefaultGithubFeed()) return null;
  let fileName = '';
  try {
    fileName = decodeURIComponent(path.basename(new URL(url).pathname || ''));
  } catch {
    fileName = '';
  }
  if (!fileName) return null;
  const data = await fetchLatestGithubRelease();
  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const hit = assets.find((a) => String(a?.name || '') === fileName);
  const alt = String(hit?.browser_download_url || '').trim();
  if (!alt || alt === url) return null;
  return alt;
}

/** Bust CDN / proxy caches after a checksum mismatch or publish race. */
function withCacheBust(url, nonce = Date.now()) {
  try {
    const u = new URL(String(url || ''));
    u.searchParams.set('aspera_cb', String(nonce));
    return u.toString();
  } catch {
    const base = String(url || '');
    const join = base.includes('?') ? '&' : '?';
    return `${base}${join}aspera_cb=${encodeURIComponent(String(nonce))}`;
  }
}

async function fetchUpdateArtifact(
  url,
  { attempts = 4, cacheBust = false, rangeOffset = 0 } = {},
) {
  let lastError = null;
  let activeUrl = cacheBust ? withCacheBust(url) : url;
  let triedApiFallback = false;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(activeUrl, {
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          Accept: 'application/octet-stream,*/*',
          'User-Agent': 'AsperaHub-Updater',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          ...rangeRequestHeaders(rangeOffset),
        },
      });
      // 206 = resumed Range; 200 = full body (caller may restart .part).
      if ((res.ok || res.status === 206) && res.body) return res;
      lastError = new Error(`Download failed ${res.status}`);
      // Release asset clobber / CDN race — wait and retry.
      if (![404, 408, 416, 425, 429, 500, 502, 503, 504].includes(res.status)) {
        throw lastError;
      }
      // Range not satisfiable — caller should discard .part and restart.
      if (res.status === 416) {
        const err = new Error('Download failed 416');
        err.code = 'RANGE_NOT_SATISFIABLE';
        throw err;
      }
      // One-shot: swap to Releases API asset URL after a 404.
      if (res.status === 404 && !triedApiFallback) {
        triedApiFallback = true;
        // eslint-disable-next-line no-await-in-loop
        const alt = await resolveGithubAssetDownloadUrl(url);
        if (alt) activeUrl = cacheBust ? withCacheBust(alt) : alt;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableDownloadError(lastError.message)) {
        throw lastError;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 900 * (i + 1)));
  }
  throw lastError || new Error('Download failed');
}

/**
 * Read the next body chunk, aborting if the connection stalls.
 */
function readBodyChunkWithStall(reader, stallMs = DOWNLOAD_STALL_MS) {
  let timer = null;
  const stall = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Download stalled — no data received');
      err.code = 'DOWNLOAD_STALL';
      reject(err);
    }, stallMs);
  });
  return Promise.race([reader.read(), stall]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Stream one fetch response body to disk while hashing + reporting progress.
 * Supports resume via startAt (append + seed SHA-256 from existing .part bytes).
 * Throws on mid-stream abort / stall so callers can Range-resume the .part file.
 */
async function streamResponseToFile(
  res,
  tmp,
  { size = 0, onProgress, startAt = 0 } = {},
) {
  const start = Math.max(0, Math.floor(Number(startAt) || 0));
  const total = resolveDownloadTotal({
    status: res.status,
    contentLength: Number(res.headers.get('content-length')) || 0,
    contentRange: res.headers.get('content-range') || '',
    startAt: start,
    expectedSize: size,
  });
  let received = start;
  const hash = crypto.createHash('sha256');
  if (start > 0) {
    await new Promise((resolve, reject) => {
      const rs = fs.createReadStream(tmp, { start: 0, end: start - 1 });
      rs.on('data', (d) => hash.update(d));
      rs.on('end', resolve);
      rs.on('error', reject);
    });
  }
  const out = fs.createWriteStream(tmp, start > 0 ? { flags: 'a' } : undefined);
  const reader = res.body.getReader();
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await readBodyChunkWithStall(reader);
      if (done) break;
      received += value.length;
      hash.update(value);
      if (!out.write(Buffer.from(value))) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => out.once('drain', r));
      }
      if (total && typeof onProgress === 'function') {
        onProgress({
          percent: Math.round((received / total) * 100),
          received,
          total,
        });
      }
    }
  } catch (error) {
    try {
      reader.cancel?.();
    } catch {
      // ignore
    }
    throw error;
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      // ignore
    }
  }
  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on('error', reject);
  });
  if (total > 0 && received > 0 && received < total * 0.98) {
    throw new Error(
      `Download truncated (${received} of ${total} bytes) — connection closed early`,
    );
  }
  return { hash, received, total };
}

/**
 * Stream-download the pending artifact, verify checksum, report progress.
 * @param {{ quiet?: boolean }} [opts] quiet=true for background auto-download
 *   (no blocking error dialog — must not interrupt Forward / chat work).
 */
export async function downloadUpdate(opts = {}) {
  const quiet = !!opts.quiet;
  const hopCount = Math.max(0, Number(opts.hopCount) || 0);
  if (!pendingUpdate?.file?.url) {
    return { ok: false, error: 'No update file available for this install type' };
  }
  if (busy) return { ok: false, error: 'Update already in progress' };

  // Always aim at absolute latest before spending ~85MB on a mid-version.
  if (hopCount < MAX_UPDATE_LATEST_HOPS) {
    try {
      await refreshPendingToAbsoluteLatest();
    } catch {
      // Keep current pending if the feed blips — still better than doing nothing.
    }
  }
  if (!pendingUpdate?.file?.url) {
    return { ok: false, error: 'No update file available for this install type' };
  }

  busy = true;
  activeDownloadVersion = pendingUpdate.version;
  activeDownloadEpoch = downloadEpoch;
  downloadProgress = {
    percent: 0,
    received: 0,
    total: Number(pendingUpdate.file?.size) || 0,
  };

  const targetVersion = pendingUpdate.version;
  const { url, sha256, size } = pendingUpdate.file;
  assertHttpsArtifactUrl(url);
  const dest = path.join(updatesDir(), path.basename(new URL(url).pathname) || 'asperadock-update');
  const tmp = `${dest}.part`;
  const streamAttempts = DOWNLOAD_STREAM_ATTEMPTS;
  let lastError = null;

  const assertNotSuperseded = () => {
    if (activeDownloadEpoch !== downloadEpoch) {
      const err = new Error('Update superseded by a newer release');
      err.code = 'UPDATE_SUPERSEDED';
      throw err;
    }
  };

  try {
    broadcast('download-start', { version: targetVersion });

    for (let attempt = 0; attempt < streamAttempts; attempt += 1) {
      try {
        assertNotSuperseded();
        let startAt = 0;
        try {
          if (fs.existsSync(tmp)) {
            startAt = partResumeOffset(fs.statSync(tmp).size, size);
          }
        } catch {
          startAt = 0;
        }
        if (startAt > 0 && typeof downloadProgress?.received === 'number') {
          // Keep the status bar honest while we reconnect.
          downloadProgress = {
            percent: size
              ? Math.round((startAt / size) * 100)
              : downloadProgress.percent || 0,
            received: startAt,
            total: size || downloadProgress.total || 0,
            resuming: true,
            attempt: attempt + 1,
          };
          broadcast('download-progress', downloadProgress);
        }
        // After a checksum miss / empty part, bust CDN caches.
        // eslint-disable-next-line no-await-in-loop
        const res = await fetchUpdateArtifact(url, {
          cacheBust: attempt > 0 && startAt === 0,
          rangeOffset: startAt,
        });
        assertNotSuperseded();
        // Server ignored Range and sent the full body — rewrite from byte 0.
        if (startAt > 0 && res.status === 200) {
          startAt = 0;
          try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
          } catch {
            // ignore
          }
        }
        // eslint-disable-next-line no-await-in-loop
        const { hash } = await streamResponseToFile(res, tmp, {
          size,
          startAt,
          onProgress: (progress) => {
            if (activeDownloadEpoch !== downloadEpoch) {
              const err = new Error('Update superseded by a newer release');
              err.code = 'UPDATE_SUPERSEDED';
              throw err;
            }
            downloadProgress = { ...progress };
            broadcast('download-progress', progress);
          },
        });

        assertNotSuperseded();

        if (!sha256) {
          if (pendingUpdate?.synthesized) {
            fs.renameSync(tmp, dest);
            downloadedPath = dest;
            busy = false;
            activeDownloadVersion = null;
            downloadProgress = null;
            broadcast('downloaded', { version: pendingUpdate.version, path: dest });
            // Hop again — a newer release may have published during this download.
            if (hopCount < MAX_UPDATE_LATEST_HOPS) {
              const hop = await refreshPendingToAbsoluteLatest();
              if (hop.switched) {
                clearStaleUpdateArtifacts(hop.version);
                return downloadUpdate({ quiet, hopCount: hopCount + 1 });
              }
            }
            await promptReady();
            return { ok: true, path: dest };
          }
          try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
          } catch {
            // ignore
          }
          throw new Error(
            'Update rejected — release is missing a SHA-256 checksum. Refusing to install.',
          );
        }
        const got = hash.digest('hex');
        if (got.toLowerCase() !== String(sha256).toLowerCase()) {
          try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
          } catch {
            // ignore
          }
          const err = new Error('Checksum mismatch — download rejected');
          err.code = 'CHECKSUM_MISMATCH';
          throw err;
        }

        fs.renameSync(tmp, dest);
        downloadedPath = dest;
        busy = false;
        activeDownloadVersion = null;
        downloadProgress = null;
        broadcast('downloaded', { version: targetVersion, path: dest });

        // Absolute latest may have moved while this ~85MB finished — jump, don't
        // install mid-versions one after another.
        if (hopCount < MAX_UPDATE_LATEST_HOPS) {
          const hop = await refreshPendingToAbsoluteLatest();
          if (hop.switched) {
            clearStaleUpdateArtifacts(hop.version);
            return downloadUpdate({ quiet, hopCount: hopCount + 1 });
          }
        }

        // Always prompt — users must see the update while using the app.
        // autoUpdateInstall still applies on quit if they choose Later.
        await promptReady();
        return { ok: true, path: dest };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.code === 'UPDATE_SUPERSEDED') {
          throw lastError;
        }
        // Keep .part for Range resume unless the bytes themselves are bad.
        if (
          shouldDiscardPartialOnError(lastError) ||
          lastError.code === 'RANGE_NOT_SATISFIABLE'
        ) {
          try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
          } catch {
            // ignore
          }
        }
        // Missing checksum is final; mismatch may be a CDN/publish race — retry.
        if (/missing a SHA-256/i.test(lastError.message)) {
          throw lastError;
        }
        const checksumMiss =
          lastError.code === 'CHECKSUM_MISMATCH' ||
          /Checksum mismatch/i.test(lastError.message);
        if (
          !checksumMiss &&
          (!isRetryableDownloadError(lastError.message) ||
            attempt >= streamAttempts - 1)
        ) {
          throw lastError;
        }
        if (checksumMiss && attempt >= streamAttempts - 1) {
          throw lastError;
        }
        let kept = 0;
        try {
          if (fs.existsSync(tmp)) kept = fs.statSync(tmp).size;
        } catch {
          kept = 0;
        }
        downloadProgress = {
          percent: size ? Math.round((kept / size) * 100) : 0,
          received: kept,
          total: size || 0,
          retrying: true,
          attempt: attempt + 1,
          checksumRetry: checksumMiss,
        };
        broadcast('download-progress', downloadProgress);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw lastError || new Error('Download failed');
  } catch (error) {
    busy = false;
    activeDownloadVersion = null;
    downloadProgress = null;
    if (error?.code === 'UPDATE_SUPERSEDED' && hopCount < MAX_UPDATE_LATEST_HOPS) {
      clearStaleUpdateArtifacts(pendingUpdate?.version);
      return downloadUpdate({ quiet, hopCount: hopCount + 1 });
    }
    // Leave .part on disk for the next Check for updates (resume).
    // Only wipe on final checksum / missing-hash failures (already handled).
    const message = String(error?.message || error);
    broadcast('error', { message });
    reportError('update-download', { message });
    // Background checks must not steal focus with a modal (e.g. during Forward).
    if (!quiet) {
      const raceHint = /Download failed 404/i.test(message)
        ? '\n\nThe release may still be publishing. Wait a few seconds and try Check for updates again.'
        : '';
      await showUpdateBox({
        type: 'error',
        title: 'Update download failed',
        message: 'Could not download the update.',
        detail: `${formatDownloadErrorDetail(message)}${raceHint}`,
        buttons: ['OK'],
      });
    } else {
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'Aspera Hub update',
            body: 'Update download will retry later.',
            silent: true,
          }).show();
        }
      } catch {
        // ignore
      }
    }
    return { ok: false, error: message };
  }
}

async function findDownloadedArtifact(version, file) {
  if (!version) return null;
  const expected = file?.sha256;
  if (!expected) return null;
  const candidates = [];
  if (file?.url) {
    try {
      candidates.push(path.basename(new URL(file.url).pathname));
    } catch {
      // ignore
    }
  }
  candidates.push(
    `asperadock_${version}_amd64.deb`,
    `AsperaDock-${version}.AppImage`,
    `asperadock-${version}.x86_64.rpm`,
  );
  for (const name of candidates) {
    if (!name) continue;
    const full = path.join(updatesDir(), name);
    if (!fs.existsSync(full)) continue;
    try {
      const got = await sha256File(full);
      if (got.toLowerCase() === String(expected).toLowerCase()) return full;
      try {
        fs.unlinkSync(full);
      } catch {
        // ignore
      }
    } catch {
      // ignore unreadable files
    }
  }
  return null;
}

function relaunchAndExit(execPathOverride) {
  try {
    beforeRelaunch();
  } catch {
    // ignore
  }

  // After a .deb/.rpm replace, process.execPath can still point at the old
  // unlinked inode — app.relaunch() then "restarts" the dead binary and the
  // UI never comes back. Always spawn the fresh launcher after we exit.
  const packaged = app.isPackaged && !process.env.APPIMAGE;
  if (packaged && !execPathOverride) {
    const launcher =
      process.platform === 'linux' && fs.existsSync('/usr/bin/asperadock')
        ? '/usr/bin/asperadock'
        : process.execPath;
    try {
      const child = spawn(
        '/bin/sh',
        ['-c', `sleep 3; exec ${shellQuote(launcher)} --disable-gpu-sandbox`],
        {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env },
        },
      );
      child.unref();
    } catch (error) {
      console.error('[updater] delayed relaunch failed', error);
      app.relaunch();
    }
    app.exit(0);
    return;
  }

  const opts = {};
  if (execPathOverride) opts.execPath = execPathOverride;
  app.relaunch(opts);
  app.exit(0);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Copy the .deb to a world-readable /tmp path without spaces.
 * Elevating from ~/.config/Aspera Dock/updates/ is fragile (spaces + session).
 * @param {string} srcPath
 * @param {{ tmpDir?: string, copyFileSync?: Function, chmodSync?: Function }} [opts]
 */
export function stagePackageForElevatedInstall(srcPath, opts = {}) {
  return stagePackageForElevatedInstallPure(srcPath, {
    tmpDir: opts.tmpDir || '/tmp',
    copyFileSync: opts.copyFileSync || fs.copyFileSync.bind(fs),
    chmodSync: opts.chmodSync || fs.chmodSync.bind(fs),
  });
}

function clearConsumedUpdateArtifact(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
  if (downloadedPath === filePath) downloadedPath = null;
}

/** Install the downloaded artifact and relaunch into the new version. */
export async function installUpdate({ silentOnFail = false } = {}) {
  if (installBusy) {
    return { ok: false, error: 'Install already in progress' };
  }
  // Never install a mid-version when absolute latest has moved on.
  try {
    const hop = await refreshPendingToAbsoluteLatest();
    if (hop.switched) {
      downloadedPath = null;
      const result = await downloadUpdate({ quiet: silentOnFail });
      if (!result.ok) return result;
      // downloadUpdate already prompted Install when interactive.
      if (!silentOnFail) return result;
    }
  } catch {
    // Proceed with whatever is pending if the feed is briefly unreachable.
  }
  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    const result = await downloadUpdate({ quiet: silentOnFail });
    if (!result.ok) return result;
  }
  installBusy = true;
  let stagedPath = null;
  try {
    try {
      await assertDownloadedIntegrity(downloadedPath);
    } catch (error) {
      const message = String(error?.message || error);
      broadcast('error', { message });
      reportError('update-install', { message });
      if (!silentOnFail) {
        await showUpdateBox({
          type: 'error',
          title: 'Update rejected',
          message: 'Could not verify the update package.',
          detail: message,
          buttons: ['OK'],
        });
      }
      return { ok: false, error: message };
    }
    const kind = pendingUpdate?.file?.kind || detectPackaging();
    broadcast('installing', { version: pendingUpdate?.version });

    if (kind === 'appimage') {
      const target = process.env.APPIMAGE;
      if (!target) throw new Error('APPIMAGE path not found');
      fs.copyFileSync(downloadedPath, target);
      fs.chmodSync(target, 0o755);
      clearConsumedUpdateArtifact(downloadedPath);
      pendingUpdate = null;
      relaunchAndExit(target);
      return { ok: true };
    }

    if (kind === 'deb' || kind === 'rpm') {
      const elevatePath =
        kind === 'deb'
          ? (stagedPath = stagePackageForElevatedInstall(downloadedPath))
          : downloadedPath;
      const installed = await elevatedInstall(kind, elevatePath);
      if (!installed.ok) throw new Error(installed.error || 'Install failed');

      if (installed.manual) {
        // Desktop installer / systemd-run kicked off — wait for the package
        // version to catch up, then relaunch. Never claim success early.
        const applied = await waitForDebVersion(pendingUpdate?.version, 90_000);
        if (!applied) {
          const choice = await showUpdateBox({
            type: 'warning',
            title: 'Finish installing the update',
            message: `Aspera Hub ${pendingUpdate?.version} is not installed yet.`,
            detail:
              'A password / package window may be behind Hub, or was cancelled.\n\n' +
              '1. Look for a password prompt or package installer.\n' +
              '2. Or click Open .deb and install it yourself.\n' +
              '3. Then reopen Aspera Hub.\n\n' +
              `File:\n${elevatePath}`,
            buttons: ['Open .deb', 'Open folder', 'Later'],
            defaultId: 0,
            cancelId: 2,
          });
          if (choice.response === 0) {
            await shell.openPath(elevatePath);
            return { ok: false, manual: true, error: 'Waiting for manual install' };
          }
          if (choice.response === 1) {
            shell.showItemInFolder(elevatePath);
            return { ok: false, manual: true, error: 'Waiting for manual install' };
          }
          snoozeUpdate(pendingUpdate?.version);
          return { ok: false, manual: true, snoozed: true };
        }
      }

      // Package is on disk — drop the cached artifact so the next launch
      // does not keep offering Install & restart for the same version.
      clearConsumedUpdateArtifact(downloadedPath);
      if (stagedPath && stagedPath !== downloadedPath) {
        clearConsumedUpdateArtifact(stagedPath);
      }
      pendingUpdate = null;

      // Give dpkg a moment to finish writing files, then restart via /usr/bin/asperadock.
      await new Promise((r) => setTimeout(r, 800));
      relaunchAndExit();
      return { ok: true };
    }

    // dev / unknown / zip → reveal for manual install.
    await shell.openPath(downloadedPath);
    broadcast('manual-install', { path: downloadedPath });
    return { ok: true, manual: true, path: downloadedPath };
  } catch (error) {
    const message = String(error?.message || error);
    broadcast('error', { message });
    reportError('update-install', { message });
    if (!silentOnFail) {
      const r = await showUpdateBox({
        type: 'error',
        title: 'Update failed to install',
        message: 'Aspera Hub could not install the update automatically.',
        detail:
          `${message}\n\n` +
          'Fix (terminal):\n' +
          `sudo dpkg -i "${stagedPath || downloadedPath}"\n\n` +
          'Then reopen Aspera Hub.',
        buttons: ['Open folder', 'OK'],
        defaultId: 0,
      });
      if (r.response === 0) shell.showItemInFolder(stagedPath || downloadedPath);
    }
    return { ok: false, error: message };
  } finally {
    installBusy = false;
  }
}

function readDebPackageVersion() {
  try {
    const out = execFileSync('/usr/bin/dpkg-query', ['-W', '-f=${Version}', 'asperadock'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return String(out || '').trim() || null;
  } catch {
    return null;
  }
}

async function waitForDebVersion(version, timeoutMs) {
  if (!version) return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const installed = readDebPackageVersion();
    if (installed && compareVersions(installed, version) >= 0) return true;
    // Also accept app.getVersion() if this process was already replaced (rare).
    if (compareVersions(currentVersion(), version) >= 0) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

function snoozePath() {
  return path.join(app.getPath('userData'), 'update-snooze.json');
}

function snoozeUpdate(version) {
  if (!version) return;
  try {
    fs.writeFileSync(
      snoozePath(),
      JSON.stringify({ version, until: Date.now() + 24 * 60 * 60 * 1000 }),
      'utf8',
    );
  } catch {
    // ignore
  }
}

function clearSnooze() {
  try {
    if (fs.existsSync(snoozePath())) fs.unlinkSync(snoozePath());
  } catch {
    // ignore
  }
}

function isUpdateSnoozed(version) {
  try {
    if (!fs.existsSync(snoozePath())) return false;
    const raw = JSON.parse(fs.readFileSync(snoozePath(), 'utf8'));
    if (!raw || raw.version !== version) return false;
    if (Date.now() > Number(raw.until || 0)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Install .deb/.rpm without spawning pkexec as a direct Electron child.
 * Chromium sets PR_SET_NO_NEW_PRIVS, so setuid helpers like pkexec fail with
 * "pkexec must be setuid root" when launched from this process tree.
 */
function elevatedInstall(kind, filePath) {
  return new Promise((resolve) => {
    if (kind === 'deb') {
      // 1) systemd-run → new process under systemd (no NO_NEW_PRIVS) → pkexec works.
      const ran = trySystemdPkexecInstall(filePath);
      if (ran.started) {
        resolve({ ok: true, manual: true, via: 'systemd-run' });
        return;
      }

      // 2) Hand off to the desktop package installer (mintinstall / apturl / etc.).
      const child = spawn('/usr/bin/xdg-open', [filePath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      child.on('error', () => {
        resolve({
          ok: false,
          error: `Could not open the package installer (${ran.error || 'no systemd-run'}). Open the .deb manually.`,
        });
      });
      child.unref();
      // xdg-open returns immediately; treat as manual install in progress.
      setTimeout(() => resolve({ ok: true, manual: true, via: 'xdg-open' }), 500);
      return;
    }

    // rpm: same systemd-run strategy
    const display = process.env.DISPLAY || ':0';
    const xauth = process.env.XAUTHORITY || '';
    const rpmArgs = [
      '--description=Aspera Hub update',
      `--setenv=DISPLAY=${display}`,
    ];
    if (xauth) rpmArgs.push(`--setenv=XAUTHORITY=${xauth}`);
    rpmArgs.push('/usr/bin/pkexec', '/usr/bin/rpm', '-U', '--force', filePath);
    const started = spawnSystemdRun(['--user', ...rpmArgs]);
    if (started.ok || spawnSystemdRun(rpmArgs).ok) {
      resolve({ ok: true, manual: true, via: 'systemd-run' });
      return;
    }
    resolve({
      ok: false,
      error: started.error || 'Could not start elevated rpm install',
    });
  });
}

function trySystemdPkexecInstall(filePath) {
  const display = process.env.DISPLAY || ':0';
  const xauth = process.env.XAUTHORITY || '';
  const args = [
    '--description=Aspera Hub update',
    `--setenv=DISPLAY=${display}`,
  ];
  if (xauth) args.push(`--setenv=XAUTHORITY=${xauth}`);
  // Prefer --user so the polkit agent on the desktop session can prompt.
  const userTry = spawnSystemdRun([
    '--user',
    ...args,
    '/usr/bin/pkexec',
    '/usr/bin/dpkg',
    '-i',
    filePath,
  ]);
  if (userTry.ok) return { started: true };
  const sysTry = spawnSystemdRun([
    ...args,
    '/usr/bin/pkexec',
    '/usr/bin/dpkg',
    '-i',
    filePath,
  ]);
  if (sysTry.ok) return { started: true };
  return { started: false, error: userTry.error || sysTry.error };
}

function spawnSystemdRun(argv) {
  const bin = '/usr/bin/systemd-run';
  if (!fs.existsSync(bin)) return { ok: false, error: 'systemd-run not found' };
  try {
    const result = spawnSync(bin, argv, {
      encoding: 'utf8',
      timeout: 15_000,
      env: { ...process.env },
    });
    if (result.status === 0) return { ok: true };
    const detail = String(result.stderr || result.stdout || '').trim().slice(0, 240);
    return { ok: false, error: detail || `systemd-run exited ${result.status}` };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function promptAvailable() {
  if (!pendingUpdate) return;
  try {
    const r = await showUpdateBox({
      type: 'info',
      title: 'Update available',
      message: `Aspera Hub ${pendingUpdate.version} is available`,
      detail: formatUpdatePromptDetail({
        version: pendingUpdate.version,
        notes: pendingUpdate.notes,
        phase: 'available',
      }),
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (r.response === 0) {
      downloadUpdate({ quiet: false }).catch((err) =>
        reportError('update-download', { message: String(err) }),
      );
    } else {
      snoozeUpdate(pendingUpdate?.version);
    }
  } catch (error) {
    reportError('update-prompt', { message: String(error?.message || error) });
    // Dialog failed (focus/parent issues on some Linux sessions) — still fetch if allowed.
    if (settings().autoUpdateDownload !== false && pendingUpdate?.file) {
      downloadUpdate({ quiet: true }).catch((err) =>
        reportError('update-download', { message: String(err) }),
      );
    }
  }
}

async function promptReady({ force = false } = {}) {
  if (!pendingUpdate) return;
  if (installBusy) return;
  if (!force && !pendingUpdate.mandatory && isUpdateSnoozed(pendingUpdate.version)) return;
  if (force) clearSnooze();
  // Don't offer Install for N when N+2 is already latest — hop first.
  try {
    const hop = await refreshPendingToAbsoluteLatest();
    if (hop.switched) {
      downloadedPath = null;
      await downloadUpdate({ quiet: false });
      return;
    }
  } catch {
    // Feed blip — fall through and offer whatever is already downloaded.
  }
  if (!downloadedPath || !fs.existsSync(downloadedPath)) return;
  try {
    const r = await showUpdateBox({
      type: 'info',
      title: 'Update ready',
      message: `Aspera Hub ${pendingUpdate.version} is ready to install`,
      detail: formatUpdatePromptDetail({
        version: pendingUpdate.version,
        notes: pendingUpdate.notes,
        phase: pendingUpdate.mandatory ? 'mandatory' : 'ready',
      }),
      buttons: pendingUpdate.mandatory
        ? ['Install & restart']
        : ['Install & restart', 'Later'],
      defaultId: 0,
      cancelId: pendingUpdate.mandatory ? 0 : 1,
    });
    if (r.response === 0) {
      // Await so a second prompt cannot stack while dpkg/pkexec is running.
      await installUpdate().catch((err) =>
        reportError('update-install', { message: String(err) }),
      );
    } else {
      snoozeUpdate(pendingUpdate?.version);
    }
  } catch (error) {
    reportError('update-prompt', { message: String(error?.message || error) });
    if (settings().autoUpdateInstall === true || pendingUpdate?.mandatory) {
      await installUpdate({ silentOnFail: true }).catch((err) =>
        reportError('update-install', { message: String(err) }),
      );
    }
  }
}

/** Called from before-quit: silently apply a downloaded AppImage update if configured. */
export function updateReadyForQuit() {
  // deb/rpm need an interactive polkit prompt — never elevate silently on quit
  // (that left fleets stuck re-offering Install & restart forever).
  return shouldSilentInstallOnQuit({
    autoUpdateInstall: settings().autoUpdateInstall === true,
    packaging: detectPackaging(),
    downloadedPath,
    pendingUpdate,
    installBusy,
    existsSync: fs.existsSync.bind(fs),
  });
}

export function getUpdateStatus() {
  return {
    currentVersion: currentVersion(),
    packaging: detectPackaging(),
    channel: settings().updateChannel || 'stable',
    enabled: settings().autoUpdateEnabled !== false,
    downloading: !!busy,
    downloadProgress: busy ? downloadProgress : null,
    pending: pendingUpdate
      ? {
          version: pendingUpdate.version,
          notes: pendingUpdate.notes,
          mandatory: pendingUpdate.mandatory,
          downloaded: !!downloadedPath && fs.existsSync(downloadedPath),
        }
      : null,
  };
}

/** Start periodic background checks. */
export function startAutoUpdate() {
  stopAutoUpdate();
  if (settings().autoUpdateEnabled === false) return;
  // Kick off shortly after launch, then on an interval.
  // Prompt on first start AND while using (periodic checks also prompt).
  setTimeout(() => checkForUpdates({ silent: true, promptOnAvailable: true }), 5_000);
  const mins = Math.max(30, Number(settings().updateCheckMinutes) || CHECK_INTERVAL_MIN);
  checkTimer = setInterval(
    () => checkForUpdates({ silent: true, promptOnAvailable: true }),
    mins * 60_000,
  );
  if (typeof checkTimer.unref === 'function') checkTimer.unref();
}

export function stopAutoUpdate() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}
