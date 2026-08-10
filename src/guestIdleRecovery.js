/**
 * Idle / blank / portal health recovery policy (Phase 3 extract).
 * Timing constants + which apps get automatic blank-pane recovery.
 */

/** Zoho portals: only recover when the content pane is actually blank. */
export const PORTAL_STALE_MS = 10 * 60_000;
export const PORTAL_RELOAD_COOLDOWN_MS = 20_000;
export const PORTAL_RELOAD_COOLDOWN_SALES_MS = 8000;
export const PORTAL_HEALTH_CHECK_MS = 3500;
export const PORTAL_HEALTH_RETRY_MS = 6500;
export const ZOHO_SALES_RECOVERY_DELAYS_MS = [1500, 3500, 5500, 8000];

/**
 * Auto blank-pane recovery with reload is only for Zoho One portal spaces
 * (Sales → CRM iframes that paint empty).
 *
 * Zoho CRM / Books record pages are legitimately white-heavy. Treating them as
 * blank caused a second reload ~3–4s after first paint and wiped typed notes.
 * @param {{ appId?: string }|null|undefined} service
 */
export function shouldRunPortalBlankRecovery(service) {
  return service?.appId === 'zoho-one';
}

/**
 * Apps that must never be soft-reloaded by pixel/DOM blank heuristics
 * (white forms / sparse dashboards look empty).
 * @param {{ appId?: string }|null|undefined} service
 */
export function shouldSkipBlankHeuristicReload(service) {
  const id = service?.appId;
  return id === 'zoho-crm' || id === 'zoho-books';
}

/**
 * Extra blank-check delays after long idle (screensaver / lunch).
 * @param {number} awayMs
 * @param {string} reason
 * @returns {number[]}
 */
export function portalHealthCheckDelays(awayMs, reason = 'idle') {
  const delays = [450, 1200];
  if (awayMs >= 15 * 60_000 || reason === 'power-resume') delays.push(2800);
  return delays;
}

/** Away long enough to warrant a recovery pass. */
export function shouldRecoverAfterAway(awayMs) {
  return Number(awayMs) >= 45_000;
}
