/**
 * Page-injection policy: settings.json alone must never enable injectJs/CSS.
 * Requires both allowPageInjection and ASPERADOCK_ADMIN=1 at runtime.
 */
export function isAdminEnv() {
  return process.env.ASPERADOCK_ADMIN === '1';
}

/**
 * @param {{ allowPageInjection?: boolean }} settings
 */
export function isPageInjectionEnabled(settings) {
  return !!(settings?.allowPageInjection && isAdminEnv());
}

/**
 * Stylish / remote CSS URLs must be https only (no http).
 * @returns {string|null} normalized https URL or null if empty/invalid
 */
export function normalizeStylishHttpsUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const u = new URL(text);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}
