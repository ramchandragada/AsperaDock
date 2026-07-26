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

import { app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
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
  // An explicit "Check for updates" always runs, even with auto-update off.
  if (silent && settings().autoUpdateEnabled === false) {
    return { available: false, disabled: true };
  }

  // Already downloaded and waiting? Re-offer it instead of doing nothing.
  if (!silent && pendingUpdate && downloadedPath && fs.existsSync(downloadedPath)) {
    clearSnooze();
    promptReady();
    return { available: true, version: pendingUpdate.version, downloaded: true };
  }
  // Dev / npm start uses package.json 0.1.0 forever — don't spam "install .deb" nags.
  if (detectPackaging() === 'dev') {
    broadcast('up-to-date', { version: `${currentVersion()} (dev)` });
    if (!silent) {
      beforeDialog();
      dialog
        .showMessageBox(BrowserWindow.getAllWindows()[0], {
          type: 'info',
          title: 'Development build',
          message: `You are running a development build (v${currentVersion()}).`,
          detail:
            'Updates apply to the installed Aspera Dock package (/usr/bin/asperadock), not this npm start session.\n\nQuit this window and launch Aspera Dock from the app menu to use the installed version.',
          buttons: ['OK'],
        })
        .finally(() => afterDialog());
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
        beforeDialog();
        dialog
          .showMessageBox(BrowserWindow.getAllWindows()[0], {
            type: 'info',
            title: 'Update installed',
            message: `Aspera Dock ${debVer} is installed. Restart to use it.`,
            buttons: ['Restart now', 'Later'],
            defaultId: 0,
            cancelId: 1,
          })
          .then((r) => {
            afterDialog();
            if (r.response === 0) relaunchAndExit();
            else snoozeUpdate(manifest.version);
          })
          .catch(() => afterDialog());
        return { available: false, version: debVer, pendingRelaunch: true };
      }
      broadcast('up-to-date', { version: currentVersion() });
      return { available: false, version: currentVersion() };
    }
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

    // A manual check overrides an earlier "Later".
    if (!silent) clearSnooze();

    if (silent && !manifest.mandatory && isUpdateSnoozed(manifest.version)) {
      broadcast('snoozed', { version: manifest.version });
      return { available: true, snoozed: true, version: manifest.version };
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
        ['-c', `sleep 1.5; exec ${shellQuote(launcher)}`],
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

      if (installed.manual) {
        // Desktop installer / systemd-run kicked off — wait for the package
        // version to catch up, then relaunch. Never claim success early.
        const applied = await waitForDebVersion(pendingUpdate?.version, 90_000);
        if (!applied) {
          beforeDialog();
          const choice = await dialog.showMessageBox(BrowserWindow.getAllWindows()[0], {
            type: 'info',
            title: 'Finish installing the update',
            message: `Approve the install of Aspera Dock ${pendingUpdate?.version} in your package manager.`,
            detail:
              `The update file is:\n${downloadedPath}\n\n` +
              'When the package manager says the install is done, click Restart.\n' +
              'If nothing opened, click Open folder and double-click the .deb.',
            buttons: ['Restart now', 'Open folder', 'Later'],
            defaultId: 0,
            cancelId: 2,
          });
          afterDialog();
          if (choice.response === 1) {
            shell.showItemInFolder(downloadedPath);
            return { ok: false, manual: true, error: 'Waiting for manual install' };
          }
          if (choice.response === 2) {
            snoozeUpdate(pendingUpdate?.version);
            return { ok: false, manual: true, snoozed: true };
          }
          const okNow = await waitForDebVersion(pendingUpdate?.version, 15_000);
          if (!okNow) {
            throw new Error(
              `Version ${pendingUpdate?.version} is not installed yet (still ${readDebPackageVersion() || currentVersion()}). Finish the package install, then try again.`,
            );
          }
        }
      }

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
      beforeDialog();
      dialog
        .showMessageBox(BrowserWindow.getAllWindows()[0], {
          type: 'error',
          title: 'Update failed to install',
          message: 'Aspera Dock could not install the update automatically.',
          detail: `${message}\n\nThe downloaded file is here:\n${downloadedPath}\n\nDouble-click the .deb to install it with your package manager, then reopen Aspera Dock.`,
          buttons: ['Open folder', 'OK'],
          defaultId: 0,
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
      '--description=Aspera Dock update',
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
    '--description=Aspera Dock update',
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
  if (!pendingUpdate.mandatory && isUpdateSnoozed(pendingUpdate.version)) return;
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
      else snoozeUpdate(pendingUpdate?.version);
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
