/**
 * Link handling modes (global + per-app).
 *
 * - block:    known/internal hosts stay in Hub; unknown links stay blocked
 * - external: known stay in Hub; unknown → system browser
 * - hub-tab:  known/internal → prefer new Hub tab (shared-login apps);
 *             unknown → system browser
 * - ask:      prompt (browser vs Hub tab) + optional “remember for this app”
 */

export const LINK_HANDLING_MODES = ['block', 'external', 'hub-tab', 'ask'];

export function normalizeLinkHandling(value, fallback = 'block') {
  if (value == null || value === '' || value === 'default') return fallback;
  const v = String(value);
  if (LINK_HANDLING_MODES.includes(v)) return v;
  return fallback;
}

/**
 * @param {{ linkHandling?: string|null }} [appConfig]
 * @param {string} [globalLinkHandling]
 */
export function resolveLinkHandling(appConfig, globalLinkHandling = 'block') {
  const global = normalizeLinkHandling(globalLinkHandling, 'block');
  const perApp = appConfig?.linkHandling;
  if (perApp == null || perApp === '' || perApp === 'default') return global;
  return normalizeLinkHandling(perApp, global);
}

/** Unknown / third-party http(s) links may leave Hub without prompting. */
export function shouldOpenUnknownExternally(mode) {
  const m = normalizeLinkHandling(mode, 'block');
  return m === 'external' || m === 'hub-tab';
}

/** Internal window.open / Open link should become a Hub app-bar tab. */
export function shouldOpenInternalAsHubTab(mode) {
  return normalizeLinkHandling(mode, 'block') === 'hub-tab';
}

/** Prompt before opening outbound / new-window links. */
export function shouldAskLinkHandling(mode) {
  return normalizeLinkHandling(mode, 'block') === 'ask';
}

/**
 * Map a one-shot chooser answer to a persisted linkHandling mode.
 * @param {'browser'|'hub-tab'} choice
 */
export function rememberModeForChoice(choice) {
  return choice === 'browser' ? 'external' : 'hub-tab';
}
