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
 * Auto blank-pane recovery is only needed for Zoho portal spaces.
 * Arattai can look "blank enough" during fast tab restores.
 * @param {{ appId?: string }|null|undefined} service
 */
export function shouldRunPortalBlankRecovery(service) {
  const id = service?.appId;
  return id === 'zoho-one' || id === 'zoho-crm';
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
