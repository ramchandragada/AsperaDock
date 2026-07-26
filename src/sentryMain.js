/**
 * Sentry bootstrap for Aspera Dock (main process).
 *
 * Preferred error sink when a DSN is configured (Settings or ASPERADOCK_SENTRY_DSN).
 * Native crashes + JS exceptions go to Sentry; we still keep local JSON reports.
 *
 * IMPORTANT: use a static import so Vite bundles @sentry into main.js.
 * Runtime require() fails in the packaged asar (no node_modules + OnlyLoadAppFromAsar).
 */

import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';

/**
 * Aspera Dock Sentry project (org: zarpat, project: asperadock).
 * A DSN is a write-only ingest key — safe to ship in the app so every company PC
 * reports automatically with no per-machine setup.
 */
export const DEFAULT_SENTRY_DSN =
  'https://dd355d556cdd20608f3659a57817aec4@o4511041705738240.ingest.de.sentry.io/4511797041102928';

let initialized = false;

function pkgVersion() {
  try {
    return app.getVersion() || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Precedence: env override → per-machine setting → built-in project DSN. */
export function resolveSentryDsn(settings = {}) {
  return (
    String(process.env.ASPERADOCK_SENTRY_DSN || '').trim() ||
    String(settings.sentryDsn || '').trim() ||
    DEFAULT_SENTRY_DSN
  );
}

/**
 * Init as early as possible in main. Safe to call multiple times.
 * @returns {boolean} whether Sentry is active
 */
export function initSentryMain(settings = {}) {
  const dsn = resolveSentryDsn(settings);
  if (!dsn) return false;
  if (initialized) return true;

  try {
    Sentry.init({
      dsn,
      release: `asperadock@${pkgVersion()}`,
      environment: app.isPackaged ? 'production' : 'development',
      // Keep light for older PCs — no performance traces by default.
      tracesSampleRate: 0,
      sendDefaultPii: false,
      maxBreadcrumbs: 50,
    });
    initialized = true;
    return true;
  } catch (error) {
    console.error('[sentry] init failed', error);
    return false;
  }
}

export function isSentryActive() {
  return initialized;
}

export function sentryCaptureError(kind, payload = {}) {
  if (!initialized) return false;
  try {
    const message = payload.message || kind;
    const err =
      payload.error instanceof Error
        ? payload.error
        : payload.stack
          ? Object.assign(new Error(message), { stack: payload.stack })
          : null;

    Sentry.withScope((scope) => {
      scope.setTag('asperadock.kind', kind);
      scope.setLevel(kind === 'freeze' || kind === 'unresponsive' ? 'warning' : 'error');
      if (payload.context) scope.setContext('dock', payload.context);
      if (payload.details) scope.setContext('details', payload.details);
      scope.setExtras({
        reason: payload.reason,
        label: payload.label,
        stalledMs: payload.stalledMs,
        reportId: payload.id,
      });
      if (err) Sentry.captureException(err);
      else Sentry.captureMessage(String(message), 'error');
    });
    return true;
  } catch {
    return false;
  }
}

export function sentryAddBreadcrumb(message, data) {
  if (!initialized) return;
  try {
    Sentry.addBreadcrumb({
      category: 'asperadock',
      message: String(message || '').slice(0, 200),
      data: data || undefined,
      level: 'info',
    });
  } catch {
    // ignore
  }
}

export { Sentry };
