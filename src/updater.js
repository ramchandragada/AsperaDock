/**
 * Seamless self-update for Aspera Dock.
 *
 * Model: the whole app (including the bundled Electron runtime) is replaced by a
 * new build, so "update Aspera Dock" == "update Electron". Users never manage
 * Electron themselves — every runtime change ships inside an Aspera Dock update.
 *
 * How it works:
 *  - Fetches a small JSON manifest (latest.json) from updateFeedUrl.
 *  - Compares versions (semver-ish) against app.getVersion().
 *  - Downloads the matching artifact for this install type (AppImage / deb / rpm),
 *    verifies SHA-256, then installs:
 *      AppImage → overwrite in place + relaunch (fully seamless)
 *      deb/rpm  → elevated install via pkexec + relaunch
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

import { app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { GITHUB_UPDATE_FEED, GITHUB_SLUG } from './github.js';

/** Default feed: GitHub Releases (no custom server). */
const DEFAULT_FEED = GITHUB_UPDATE_FEED;
const CHECK_INTERVAL_MIN = 180; // 3h default

let settingsProvider = () => ({});
let reportError = () => {};
let beforeDialog = () => {};
let afterDialog = () => {};
let beforeRelaunch = () => {};
let checkTimer = null;

/** @type {{version:string, notes?:string, mandatory?:boolean, file?:object}|null} */
let pendingUpdate = null;
let downloadedPath = null;
let busy = false;

export function configureUpdater({
  getSettings,
  onError,
  onBeforeDialog,
  onAfterDialog,
  onBeforeRelaunch,
} = {}) {
  if (getSettings) settingsProvider = getSettings;
  if (onError) reportError = onError;
  if (onBeforeDialog) beforeDialog = onBeforeDialog;
  if (onAfterDialog) afterDialog = onAfterDialog;
  if (onBeforeRelaunch) beforeRelaunch = onBeforeRelaunch;
}

function settings() {
  return settingsProvider() || {};
}

function currentVersion() {
  return app.getVersion();
}

function updatesDir() {
  const dir = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function feedUrl() {
  const channel = String(settings().updateChannel || 'stable');
  const custom = String(settings().updateFeedUrl || '').replace(/\/+$/, '');
  if (custom) {
    const file = channel && channel !== 'stable' ? `${channel}.json` : 'latest.json';
    return `${custom}/${file}`;
  }
  // GitHub Releases: stable → …/releases/latest/download/latest.json
  // beta → …/releases/download/beta/beta.json (floating "beta" tag)
  if (channel && channel !== 'stable') {
    return `https://github.com/${GITHUB_SLUG}/releases/download/${channel}/${channel}.json`;
  }
  return `${DEFAULT_FEED}/latest.json`;
}

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

/** Compare semver-ish strings. Returns 1 if a>b, -1 if a<b, 0 equal. */
export function compareVersions(a, b) {
  const parse = (v) =>
    String(v || '0')
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
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

async function fetchManifest() {
  const url = feedUrl();
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      'X-AsperaDock-Version': currentVersion(),
    },
  });
  if (!res.ok) throw new Error(`Feed responded ${res.status}`);
  const manifest = await res.json();
  if (!manifest || !manifest.version) throw new Error('Manifest missing version');
  return manifest;
}

/**
 * @returns {Promise<{available:boolean, version?:string, notes?:string, mandatory?:boolean, error?:string}>}
 */
export async function checkForUpdates({ silent = true } = {}) {
  if (settings().autoUpdateEnabled === false) {
    return { available: false, disabled: true };
  }
  broadcast('checking');
  try {
    const manifest = await fetchManifest();
    const newer = compareVersions(manifest.version, currentVersion()) > 0;
    if (!newer) {
      broadcast('up-to-date', { version: currentVersion() });
      if (!silent) {
        beforeDialog();
        dialog
          .showMessageBox(BrowserWindow.getAllWindows()[0], {
            type: 'info',
            title: 'Aspera Dock',
            message: 'You are up to date.',
            detail: `Version ${currentVersion()} is the latest.`,
            buttons: ['OK'],
          })
          .finally(() => afterDialog());
      }
      return { available: false, version: currentVersion() };
    }

    const file = pickFileForPackaging(manifest);
    pendingUpdate = {
      version: manifest.version,
      notes: manifest.notes || '',
      mandatory: !!manifest.mandatory,
      file,
    };
    broadcast('available', {
      version: manifest.version,
      notes: manifest.notes || '',
      mandatory: !!manifest.mandatory,
      canAutoInstall: !!file && ['appimage', 'deb', 'rpm'].includes(file.kind),
    });

    // Auto-download when enabled and we have an installable artifact.
    if (settings().autoUpdateDownload !== false && file) {
      downloadUpdate().catch((err) => reportError('update-download', { message: String(err) }));
    } else if (!silent) {
      promptAvailable();
    }
    return {
      available: true,
      version: manifest.version,
      notes: manifest.notes || '',
      mandatory: !!manifest.mandatory,
    };
  } catch (error) {
    const message = String(error?.message || error);
    broadcast('error', { message });
    reportError('update-check', { message });
    if (!silent) {
      beforeDialog();
      dialog
        .showMessageBox(BrowserWindow.getAllWindows()[0], {
          type: 'error',
          title: 'Update check failed',
          message: 'Could not check for updates.',
          detail: message,
          buttons: ['OK'],
        })
        .finally(() => afterDialog());
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

/** Stream-download the pending artifact, verify checksum, report progress. */
export async function downloadUpdate() {
  if (!pendingUpdate?.file?.url) {
    return { ok: false, error: 'No update file available for this install type' };
  }
  if (busy) return { ok: false, error: 'Update already in progress' };
  busy = true;

  const { url, sha256, size } = pendingUpdate.file;
  const dest = path.join(updatesDir(), path.basename(new URL(url).pathname) || 'asperadock-update');
  const tmp = `${dest}.part`;

  try {
    broadcast('download-start', { version: pendingUpdate.version });
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}`);

    const total = Number(res.headers.get('content-length')) || size || 0;
    let received = 0;
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(tmp);
    const reader = res.body.getReader();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      hash.update(value);
      if (!out.write(Buffer.from(value))) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => out.once('drain', r));
      }
      if (total) {
        broadcast('download-progress', {
          percent: Math.round((received / total) * 100),
          received,
          total,
        });
      }
    }
    await new Promise((resolve, reject) => {
      out.end(() => resolve());
      out.on('error', reject);
    });

    if (sha256) {
      const got = hash.digest('hex');
      if (got.toLowerCase() !== String(sha256).toLowerCase()) {
        fs.unlinkSync(tmp);
        throw new Error('Checksum mismatch — download rejected');
      }
    }

    fs.renameSync(tmp, dest);
    downloadedPath = dest;
    busy = false;
    broadcast('downloaded', { version: pendingUpdate.version, path: dest });

    if (settings().autoUpdateInstall === true && !pendingUpdate.mandatory) {
      // Silent: install on next quit (see maybeInstallOnQuit).
    } else {
      promptReady();
    }
    return { ok: true, path: dest };
  } catch (error) {
    busy = false;
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    const message = String(error?.message || error);
    broadcast('error', { message });
    reportError('update-download', { message });
    return { ok: false, error: message };
  }
}

function relaunchAndExit(execPathOverride) {
  try {
    beforeRelaunch();
  } catch {
    // ignore
  }
  const opts = {};
  if (execPathOverride) opts.execPath = execPathOverride;
  app.relaunch(opts);
  app.exit(0);
}

/** Install the downloaded artifact and relaunch into the new version. */
export async function installUpdate({ silentOnFail = false } = {}) {
  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    const result = await downloadUpdate();
    if (!result.ok) return result;
  }
  const kind = pendingUpdate?.file?.kind || detectPackaging();
  broadcast('installing', { version: pendingUpdate?.version });

  try {
    if (kind === 'appimage') {
      const target = process.env.APPIMAGE;
      if (!target) throw new Error('APPIMAGE path not found');
      fs.copyFileSync(downloadedPath, target);
      fs.chmodSync(target, 0o755);
      relaunchAndExit(target);
      return { ok: true };
    }

    if (kind === 'deb' || kind === 'rpm') {
      const installed = await elevatedInstall(kind, downloadedPath);
      if (!installed.ok) throw new Error(installed.error || 'Install failed');
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
      beforeDialog();
      dialog
        .showMessageBox(BrowserWindow.getAllWindows()[0], {
          type: 'error',
          title: 'Update failed to install',
          message: 'Aspera Dock could not install the update automatically.',
          detail: `${message}\n\nThe downloaded file is here:\n${downloadedPath}\n\nYou can double-click the .deb to install it manually, then reopen Aspera Dock.`,
          buttons: ['Open folder', 'OK'],
          defaultId: 1,
        })
        .then((r) => {
          afterDialog();
          if (r.response === 0) shell.showItemInFolder(downloadedPath);
        })
        .catch(() => afterDialog());
    }
    return { ok: false, error: message };
  }
}

function elevatedInstall(kind, filePath) {
  return new Promise((resolve) => {
    // pkexec requires an absolute path to the binary (relative names → exit 127).
    const pkexec = '/usr/bin/pkexec';
    let args;
    if (kind === 'deb') {
      // Local .deb: dpkg -i is the reliable path; apt-get may not accept a bare file.
      args = ['/usr/bin/dpkg', '-i', filePath];
    } else {
      args = ['/usr/bin/rpm', '-U', '--force', filePath];
    }
    if (!fs.existsSync(pkexec)) {
      resolve({
        ok: false,
        error: 'pkexec not found — open the .deb manually and install with your package manager',
      });
      return;
    }
    const child = spawn(pkexec, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => resolve({ ok: false, error: String(err) }));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      // Dependency gaps after dpkg -i: try apt-get -f install.
      if (kind === 'deb' && code !== 127) {
        const fix = spawn(
          pkexec,
          ['/usr/bin/apt-get', 'install', '-f', '-y'],
          { stdio: 'ignore' },
        );
        fix.on('error', () =>
          resolve({
            ok: false,
            error: `Installer exited with code ${code}${stderr ? `: ${stderr.trim().slice(0, 200)}` : ''}`,
          }),
        );
        fix.on('exit', (fixCode) => {
          if (fixCode === 0) resolve({ ok: true });
          else
            resolve({
              ok: false,
              error: `Installer exited with code ${code}${stderr ? `: ${stderr.trim().slice(0, 200)}` : ''}`,
            });
        });
        return;
      }
      const hint =
        code === 127
          ? ' (command not found — install policykit-1 / use absolute package tools)'
          : '';
      resolve({
        ok: false,
        error: `Installer exited with code ${code}${hint}${stderr ? `: ${stderr.trim().slice(0, 200)}` : ''}`,
      });
    });
  });
}

function promptAvailable() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || !pendingUpdate) return;
  beforeDialog();
  dialog
    .showMessageBox(win, {
      type: 'info',
      title: 'Update available',
      message: `Aspera Dock ${pendingUpdate.version} is available.`,
      detail: pendingUpdate.notes || 'Download now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    .then((r) => {
      afterDialog();
      if (r.response === 0) downloadUpdate();
    })
    .catch(() => afterDialog());
}

function promptReady() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || !pendingUpdate) return;
  beforeDialog();
  dialog
    .showMessageBox(win, {
      type: 'info',
      title: 'Update ready',
      message: `Aspera Dock ${pendingUpdate.version} is ready to install.`,
      detail: pendingUpdate.mandatory
        ? 'This is a required update and will install now.'
        : 'Restart to apply the update.',
      buttons: pendingUpdate.mandatory
        ? ['Install & restart']
        : ['Install & restart', 'Later'],
      defaultId: 0,
      cancelId: pendingUpdate.mandatory ? 0 : 1,
    })
    .then((r) => {
      afterDialog();
      if (r.response === 0) installUpdate();
    })
    .catch(() => afterDialog());
}

/** Called from before-quit: silently apply a downloaded update if configured. */
export function updateReadyForQuit() {
  return (
    settings().autoUpdateInstall === true &&
    downloadedPath &&
    fs.existsSync(downloadedPath) &&
    !!pendingUpdate
  );
}

export function getUpdateStatus() {
  return {
    currentVersion: currentVersion(),
    packaging: detectPackaging(),
    channel: settings().updateChannel || 'stable',
    enabled: settings().autoUpdateEnabled !== false,
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
  setTimeout(() => checkForUpdates({ silent: true }), 8000);
  const mins = Math.max(30, Number(settings().updateCheckMinutes) || CHECK_INTERVAL_MIN);
  checkTimer = setInterval(() => checkForUpdates({ silent: true }), mins * 60_000);
  if (typeof checkTimer.unref === 'function') checkTimer.unref();
}

export function stopAutoUpdate() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}
