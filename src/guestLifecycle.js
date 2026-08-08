/**
 * Guest lifecycle policy helpers (Phase 3 extract).
 * Warm-cap / hibernate math without touching Electron views.
 * Warm caps live in services.js — re-exported here for a single import path.
 */
export {
  MAX_WARM_VIEWS_DEFAULT,
  MAX_WARM_VIEWS_CAP,
} from './services.js';

/**
 * Convert hibernate minutes to milliseconds.
 * @param {number} minutes
 * @param {{ lowMemoryMode?: boolean }} [opts]
 */
export function hibernateMsFromSettings(minutes, opts = {}) {
  const raw = Number(minutes) || 0;
  if (opts.lowMemoryMode) {
    const mins = Math.min(3, Math.max(1, raw || 2));
    return mins * 60_000;
  }
  return Math.max(1, raw || 2) * 60_000;
}

/**
 * Whether an app id should default to keepWarm when unset.
 * Messaging + Zoho form apps — switching away must not wipe drafts.
 * @param {string} appId
 */
export function defaultKeepWarmForApp(appId) {
  return (
    appId === 'whatsapp' ||
    appId === 'arattai' ||
    appId === 'zoho-crm' ||
    appId === 'zoho-one' ||
    appId === 'zoho-books'
  );
}
