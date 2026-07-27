/**
 * Robust error / crash / freeze reporting for Aspera Hub.
 *
 * - Saves structured JSON reports under userData/error-reports/
 * - Uploads to GitHub Issues by default (no custom server)
 * - Optional custom HTTPS endpoint
 * - Detects unclean shutdowns (crash between sessions)
 * - Accepts renderer exceptions + freeze heartbeats
 */

import {
  app,
  crashReporter,
  dialog,
  shell,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import {
  GITHUB_SLUG,
  GITHUB_ISSUES_API,
  GITHUB_NEW_ISSUE_URL,
} from './github.js';
import {
  initSentryMain,
  isSentryActive,
  resolveSentryDsn,
  sentryCaptureError,
  sentryAddBreadcrumb,
} from './sentryMain.js';
import { openExternalSafe } from './safeShell.js';

const require = createRequire(import.meta.url);

const MAX_REPORTS = 40;
const MAX_LOG_LINES = 200;
const FREEZE_MS = 15_000;
const HEARTBEAT_CHECK_MS = 5_000;

/** @type {string[]} */
const recentLogs = [];
/** @type {(() => object) | null} */
let contextProvider = null;
/** @type {() => object | null} */
let settingsProvider = () => null;
let lastHeartbeatAt = Date.now();
let freezeTimer = null;
let startedClean = false;
let reportingEnabled = true;

function pkgVersion() {
  try {
    return require('../package.json').version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function reportsDir() {
  return path.join(app.getPath('userData'), 'error-reports');
}

function sessionFlagPath() {
  return path.join(app.getPath('userData'), 'session.lock');
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

export function logBreadcrumb(message, extra = null) {
  const line = {
    at: new Date().toISOString(),
    message: String(message || '').slice(0, 500),
    extra: extra == null ? undefined : extra,
  };
  recentLogs.push(line);
  while (recentLogs.length > MAX_LOG_LINES) recentLogs.shift();
  sentryAddBreadcrumb(message, extra);
}

function collectSystemInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osType: os.type(),
    totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
    cpus: os.cpus()?.[0]?.model || 'unknown',
    cpuCount: os.cpus()?.length || 0,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    locale: app.getLocale?.() || '',
  };
}

function baseReport(kind, payload = {}) {
  const ctx = typeof contextProvider === 'function' ? contextProvider() : {};
  const settings = typeof settingsProvider === 'function' ? settingsProvider() : {};
  return {
    id: `err-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    kind,
    createdAt: new Date().toISOString(),
    app: {
      name: 'Aspera Hub',
      version: pkgVersion(),
      packaged: app.isPackaged,
    },
    system: collectSystemInfo(),
    context: ctx || {},
    settingsSnapshot: sanitizeSettings(settings),
    recentLogs: recentLogs.slice(-80),
    ...payload,
  };
}

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object') return {};
  const {
    lockPasswordHash,
    proxyRules,
    serviceConfigs,
    serviceLabels,
    errorReportGithubToken,
    sentryDsn,
    ...rest
  } = settings;
  return {
    ...rest,
    hasLock: !!lockPasswordHash,
    hasGithubToken: !!errorReportGithubToken || !!process.env.ASPERADOCK_GITHUB_TOKEN,
    hasSentryDsn: !!resolveSentryDsn({ sentryDsn }),
    serviceCount: Array.isArray(settings.serviceInstances)
      ? settings.serviceInstances.length
      : 0,
    profileCount: Array.isArray(settings.profiles) ? settings.profiles.length : 0,
  };
}

function pruneOldReports() {
  try {
    const dir = reportsDir();
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({
        f,
        m: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.m - a.m);
    for (const item of files.slice(MAX_REPORTS)) {
      try {
        fs.unlinkSync(path.join(dir, item.f));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function writeReport(report) {
  ensureDir(reportsDir());
  const file = path.join(reportsDir(), `${report.id}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  pruneOldReports();
  return file;
}

function resolveGithubRepo(settings) {
  const custom = String(settings.errorReportGithubRepo || '').trim();
  if (custom && custom.includes('/')) return custom;
  return GITHUB_SLUG;
}

function resolveGithubToken(settings) {
  return (
    String(settings.errorReportGithubToken || '').trim() ||
    String(process.env.ASPERADOCK_GITHUB_TOKEN || '').trim()
  );
}

function githubIssuesApi(settings) {
  const repo = resolveGithubRepo(settings);
  if (repo === GITHUB_SLUG) return GITHUB_ISSUES_API;
  return `https://api.github.com/repos/${repo}/issues`;
}

function formatIssueBody(report) {
  const summary = [
    `**Kind:** \`${report.kind}\``,
    `**Version:** ${report.app?.version || '?'} (Electron ${report.system?.electron || '?'})`,
    `**OS:** ${report.system?.platform || '?'} ${report.system?.arch || ''} · ${report.system?.osRelease || ''}`,
    `**When:** ${report.createdAt || ''}`,
    `**Report id:** \`${report.id}\``,
    '',
    report.message ? `### Message\n\`\`\`\n${String(report.message).slice(0, 2000)}\n\`\`\`` : '',
    '',
    '<details><summary>Full report (JSON)</summary>',
    '',
    '```json',
    JSON.stringify(report, null, 2).slice(0, 55_000),
    '```',
    '',
    '</details>',
  ]
    .filter(Boolean)
    .join('\n');
  return summary;
}

async function uploadToGithubIssues(report, filePath, settings) {
  const token = resolveGithubToken(settings);
  if (!token) return { uploaded: false, reason: 'no-github-token' };

  const title = `[auto] ${report.kind} · v${report.app?.version || '?'} · ${report.id}`;
  try {
    const res = await fetch(githubIssuesApi(settings), {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'AsperaDock-ErrorReporter',
      },
      body: JSON.stringify({
        title: title.slice(0, 200),
        body: formatIssueBody(report),
      }),
    });
    const ok = res.ok;
    if (ok) {
      let issueUrl = '';
      try {
        const data = await res.json();
        issueUrl = data.html_url || '';
      } catch {
        // ignore
      }
      try {
        const meta = {
          ...report,
          uploadedAt: new Date().toISOString(),
          uploadStatus: res.status,
          uploadTarget: 'github-issues',
          issueUrl,
        };
        fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
      } catch {
        // ignore
      }
      return { uploaded: true, status: res.status, issueUrl };
    }
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    return { uploaded: false, status: res.status, error: detail.slice(0, 300) };
  } catch (error) {
    return { uploaded: false, error: String(error?.message || error) };
  }
}

async function uploadToCustomUrl(report, filePath, settings) {
  const url = String(settings.errorReportUrl || '').trim();
  if (!url) return { uploaded: false, reason: 'no-url' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AsperaDock-Version': pkgVersion(),
        'X-AsperaDock-Kind': report.kind,
      },
      body: JSON.stringify(report),
    });
    const ok = res.ok;
    if (ok) {
      try {
        const meta = { ...report, uploadedAt: new Date().toISOString(), uploadStatus: res.status };
        fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
      } catch {
        // ignore
      }
    }
    return { uploaded: ok, status: res.status };
  } catch (error) {
    return { uploaded: false, error: String(error?.message || error) };
  }
}

async function uploadReport(report, filePath) {
  const settings = settingsProvider?.() || {};
  if (settings.errorReportingEnabled === false) return { uploaded: false };

  const target = String(settings.errorReportTarget || 'sentry');

  // Always try Sentry when a DSN is present (even if target is github/url as dual-ship).
  let sentryOk = false;
  if (resolveSentryDsn(settings) && (target === 'sentry' || target === 'github' || target === 'url')) {
    sentryOk = sentryCaptureError(report.kind, {
      ...report,
      error: report.error,
      stack: report.stack,
    });
    if (sentryOk) {
      try {
        const meta = {
          ...report,
          uploadedAt: new Date().toISOString(),
          uploadTarget: 'sentry',
        };
        fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
      } catch {
        // ignore
      }
    }
  }

  if (target === 'sentry') {
    return {
      uploaded: sentryOk,
      uploadTarget: sentryOk ? 'sentry' : undefined,
      reason: sentryOk ? undefined : 'no-sentry-dsn',
    };
  }
  if (target === 'none') return { uploaded: sentryOk, reason: 'disabled-target' };
  if (target === 'url') {
    const custom = await uploadToCustomUrl(report, filePath, settings);
    return { uploaded: custom.uploaded || sentryOk, ...custom };
  }
  const gh = await uploadToGithubIssues(report, filePath, settings);
  return { uploaded: gh.uploaded || sentryOk, ...gh };
}

/** Open a pre-filled GitHub issue in the browser (no token required). */
export function openReportOnGithub(report) {
  const settings = settingsProvider?.() || {};
  const repo = resolveGithubRepo(settings);
  const base =
    repo === GITHUB_SLUG
      ? GITHUB_NEW_ISSUE_URL
      : `https://github.com/${repo}/issues/new`;
  const title = encodeURIComponent(
    `[manual] ${report?.kind || 'error'} · v${report?.app?.version || pkgVersion()}`,
  );
  const body = encodeURIComponent(formatIssueBody(report || {}).slice(0, 6000));
  openExternalSafe(`${base}?title=${title}&body=${body}`);
}

/**
 * Record an error report, persist it, and try to upload.
 * @returns {Promise<{ id: string, file: string, uploaded: boolean }>}
 */
export async function reportError(kind, payload = {}) {
  const settings = settingsProvider?.() || {};
  if (settings.errorReportingEnabled === false) {
    return { id: null, file: null, uploaded: false, skipped: true };
  }

  const report = baseReport(kind, payload);
  let file = null;
  try {
    file = writeReport(report);
    logBreadcrumb(`report-saved:${kind}`, { id: report.id });
  } catch (error) {
    console.error('[errorReporter] write failed', error);
  }

  let uploaded = false;
  if (file) {
    const result = await uploadReport(report, file);
    uploaded = !!result.uploaded;
  }
  return { id: report.id, file, uploaded, report };
}

export function setErrorReporterContext(fn) {
  contextProvider = fn;
}

export function setErrorReporterSettingsProvider(fn) {
  settingsProvider = fn;
}

export function noteHeartbeat() {
  lastHeartbeatAt = Date.now();
}

export function listRecentReports(limit = 20) {
  try {
    const dir = reportsDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const full = path.join(dir, f);
        try {
          const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
          return {
            id: raw.id || f,
            kind: raw.kind,
            createdAt: raw.createdAt,
            message: raw.message || raw.reason || raw.error?.message || '',
            uploadedAt: raw.uploadedAt || null,
            dismissedAt: raw.dismissedAt || null,
            file: full,
          };
        } catch {
          return { id: f, kind: 'unknown', createdAt: null, file: full };
        }
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function markReportDismissed(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    raw.dismissedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

/** Mark every recent promptable report as dismissed (stops restart loops). */
export function dismissAllPendingReports() {
  for (const report of listRecentReports(40)) {
    if (report.dismissedAt) continue;
    if (
      report.kind === 'unclean-shutdown' ||
      report.kind === 'freeze' ||
      report.kind === 'uncaughtException' ||
      report.kind === 'render-process-gone' ||
      report.kind === 'unresponsive' ||
      report.kind === 'update-install'
    ) {
      markReportDismissed(report.file);
    }
  }
}

let freezePaused = false;
export function pauseFreezeWatch() {
  freezePaused = true;
  lastHeartbeatAt = Date.now();
}
export function resumeFreezeWatch() {
  freezePaused = false;
  lastHeartbeatAt = Date.now();
}

export function openReportsFolder() {
  ensureDir(reportsDir());
  return shell.openPath(reportsDir());
}

export function getReportsDir() {
  ensureDir(reportsDir());
  return reportsDir();
}

/** Start Electron crashReporter (native crashes). */
export function startNativeCrashReporter() {
  const settings = settingsProvider?.() || {};
  if (settings.errorReportingEnabled === false) return;

  const submitURL = String(settings.errorReportUrl || '').trim();
  try {
    crashReporter.start({
      productName: 'Aspera Hub',
      companyName: 'Aspera',
      submitURL: submitURL || 'https://127.0.0.1/disabled', // required by API; upload ignored if unreachable
      uploadToServer: Boolean(submitURL),
      compress: true,
      ignoreSystemCrashHandler: false,
      rateLimit: true,
      globalExtra: {
        _companyName: 'Aspera',
        _productName: 'Aspera Hub',
        _version: pkgVersion(),
      },
    });
  } catch (error) {
    console.error('[errorReporter] crashReporter.start failed', error);
  }
}

function markSessionStart() {
  ensureDir(app.getPath('userData'));
  try {
    if (fs.existsSync(sessionFlagPath())) {
      // Previous run did not clear the lock → likely crash / force-kill / freeze reboot.
      const stale = fs.readFileSync(sessionFlagPath(), 'utf8');
      reportError('unclean-shutdown', {
        message: 'Previous Aspera Hub session did not exit cleanly',
        reason: 'session.lock still present on startup',
        previousSession: (() => {
          try {
            return JSON.parse(stale);
          } catch {
            return { raw: stale };
          }
        })(),
      }).catch(() => {});
    }
    fs.writeFileSync(
      sessionFlagPath(),
      JSON.stringify({
        startedAt: new Date().toISOString(),
        pid: process.pid,
        version: pkgVersion(),
      }),
      'utf8',
    );
    startedClean = true;
  } catch (error) {
    console.error('[errorReporter] session lock failed', error);
  }
}

export function markCleanShutdown() {
  try {
    if (fs.existsSync(sessionFlagPath())) fs.unlinkSync(sessionFlagPath());
  } catch {
    // ignore
  }
}

function startFreezeWatch() {
  if (freezeTimer) return;
  freezeTimer = setInterval(() => {
    const settings = settingsProvider?.() || {};
    if (settings.errorReportingEnabled === false) return;
    if (freezePaused) {
      lastHeartbeatAt = Date.now();
      return;
    }
    const idle = Date.now() - lastHeartbeatAt;
    if (idle < FREEZE_MS) return;
    // Avoid spam: only one freeze report per freeze episode.
    if (idle > FREEZE_MS && idle < FREEZE_MS + HEARTBEAT_CHECK_MS + 500) {
      reportError('freeze', {
        message: `UI heartbeat stalled for ${Math.round(idle / 1000)}s`,
        reason: 'renderer-heartbeat-timeout',
        stalledMs: idle,
      }).catch(() => {});
    }
  }, HEARTBEAT_CHECK_MS);
  if (typeof freezeTimer.unref === 'function') freezeTimer.unref();
}

/** Install process-level handlers. Call once after app is ready enough for paths. */
export function installErrorReporting({ getSettings, getContext } = {}) {
  if (getSettings) settingsProvider = getSettings;
  if (getContext) contextProvider = getContext;

  const settings = settingsProvider?.() || {};
  reportingEnabled = settings.errorReportingEnabled !== false;

  initSentryMain(settings);
  startNativeCrashReporter();
  markSessionStart();
  noteHeartbeat();
  startFreezeWatch();

  process.on('uncaughtException', (error) => {
    console.error('[uncaughtException]', error);
    reportError('uncaughtException', {
      message: error?.message || String(error),
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    }).catch(() => {});
  });

  process.on('unhandledRejection', (reason) => {
    const error =
      reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
    console.error('[unhandledRejection]', error);
    reportError('unhandledRejection', {
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }).catch(() => {});
  });

  logBreadcrumb('error-reporter-ready');
}

/** Attach BrowserWindow / BrowserView crash listeners. */
export function watchWebContents(webContents, label = 'unknown') {
  if (!webContents || webContents.isDestroyed?.()) return;

  webContents.on('render-process-gone', (_event, details) => {
    reportError('render-process-gone', {
      message: `Renderer gone (${label}): ${details?.reason || 'unknown'}`,
      label,
      details,
    }).catch(() => {});
  });

  webContents.on('unresponsive', () => {
    reportError('unresponsive', {
      message: `WebContents unresponsive (${label})`,
      label,
    }).catch(() => {});
  });

  webContents.on('responsive', () => {
    logBreadcrumb(`responsive:${label}`);
    noteHeartbeat();
  });
}

export async function showPendingCrashDialog(mainWindow) {
  const reports = listRecentReports(10).filter(
    (r) =>
      !r.uploadedAt &&
      !r.dismissedAt &&
      (r.kind === 'unclean-shutdown' ||
        r.kind === 'uncaughtException' ||
        r.kind === 'render-process-gone'),
  );
  // Freeze/unresponsive prompts were looping every restart (false positives while
  // native update dialogs blocked the UI). Keep them on disk for Sentry; don't nag.
  if (!reports.length) return;

  const latest = reports[0];
  const age = latest.createdAt ? Date.now() - Date.parse(latest.createdAt) : Infinity;
  if (age > 24 * 60 * 60 * 1000) return;

  pauseFreezeWatch();
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Aspera Hub — error report',
    message: 'Aspera Hub hit a problem last time.',
    detail: `${latest.kind}: ${latest.message || 'No details'}\n\nA report was saved so we can fix it in the next build.`,
    buttons: ['Send report', 'Open reports folder', 'Dismiss'],
    defaultId: 2,
    cancelId: 2,
  });
  resumeFreezeWatch();

  if (result.response === 0) {
    try {
      const raw = JSON.parse(fs.readFileSync(latest.file, 'utf8'));
      const uploaded = await uploadReport(raw, latest.file);
      markReportDismissed(latest.file);
      if (uploaded.uploaded) {
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Report sent',
          message: uploaded.issueUrl
            ? `Thanks — opened as a GitHub issue.\n${uploaded.issueUrl}`
            : uploaded.uploadTarget === 'sentry' || isSentryActive()
              ? 'Thanks — the error report was sent to Sentry.'
              : 'Thanks — the error report was uploaded.',
          buttons: ['OK'],
        });
      } else if (resolveSentryDsn(settingsProvider?.() || {})) {
        // Sentry may still have received it via capture; don't re-prompt forever.
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Report saved',
          message: 'The report is saved locally. You will not be asked again for this issue.',
          buttons: ['OK'],
        });
      } else {
        openReportOnGithub(raw);
      }
    } catch (error) {
      console.error('[errorReporter] send failed', error);
      markReportDismissed(latest.file);
    }
  } else if (result.response === 1) {
    openReportsFolder();
    dismissAllPendingReports();
  } else {
    // Dismiss — clear the whole pending queue so restart doesn't nag again.
    dismissAllPendingReports();
  }
}

export { startedClean };
