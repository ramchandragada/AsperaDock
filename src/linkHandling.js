/**
 * Link handling modes — ONE Hub-wide rule for every app
 * (WhatsApp, Arattai, Gmail, Zoho, Books, …). No per-app overrides.
 *
 * - block:    known/internal hosts stay in the current app; unknown blocked
 * - external: known stay in Hub; unknown → system browser
 * - hub-tab:  outbound / new-window http(s) → new Hub app-bar tab
 *             (top bar, right of the last app — never a floating popup)
 * - ask:      prompt (browser vs Hub tab) + optional “remember for Hub”
 */

export const LINK_HANDLING_MODES = ['block', 'external', 'hub-tab', 'ask'];

export function normalizeLinkHandling(value, fallback = 'hub-tab') {
  if (value == null || value === '' || value === 'default') return fallback;
  const v = String(value);
  if (LINK_HANDLING_MODES.includes(v)) return v;
  return fallback;
}

/**
 * Resolve effective mode. Per-app config is ignored so every app matches Settings.
 * @param {{ linkHandling?: string|null }} [_appConfig] unused (kept for call-site compat)
 * @param {string} [globalLinkHandling]
 */
export function resolveLinkHandling(_appConfig, globalLinkHandling = 'hub-tab') {
  return normalizeLinkHandling(globalLinkHandling, 'hub-tab');
}

/** Unknown links may leave Hub without prompting (browser only). */
export function shouldOpenUnknownExternally(mode) {
  return normalizeLinkHandling(mode, 'block') === 'external';
}

/**
 * Outbound / new-window links should become a Hub app-bar tab
 * (same behavior for every catalog app).
 */
export function shouldOpenAsHubTab(mode) {
  return normalizeLinkHandling(mode, 'block') === 'hub-tab';
}

/** @deprecated Use shouldOpenAsHubTab — kept for older call sites/tests. */
export function shouldOpenInternalAsHubTab(mode) {
  return shouldOpenAsHubTab(mode);
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
