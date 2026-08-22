/**
 * Resolve Chrome extension popup URLs for Hub's "Open extension" action.
 * Pure helpers — no Electron imports (unit-testable).
 */

/**
 * @param {object | null | undefined} manifest
 * @returns {string}
 */
export function resolveExtensionPopupPath(manifest) {
  if (!manifest || typeof manifest !== 'object') return '';
  const action =
    manifest.action || manifest.browser_action || manifest.page_action;
  return String(action?.default_popup || '').trim();
}

/**
 * @param {string} runtimeId
 * @param {string} popupPath
 * @param {{ popout?: boolean }} [opts]
 * @returns {string}
 */
export function buildExtensionPopupUrl(runtimeId, popupPath, { popout = true } = {}) {
  const id = String(runtimeId || '').trim();
  const rel = String(popupPath || '').trim().replace(/^\//, '');
  if (!id || !rel) return '';
  let url = `chrome-extension://${id}/${rel}`;
  if (popout && !url.includes('uilocation=')) {
    url += url.includes('?') ? '&uilocation=popout' : '?uilocation=popout';
  }
  return url;
}

/**
 * @param {{ path?: string, id?: string }[]} loaded
 * @param {string} extPath
 * @returns {string}
 */
export function findLoadedExtensionRuntimeId(loaded, extPath) {
  const target = String(extPath || '').trim();
  if (!target || !Array.isArray(loaded)) return '';
  const normalized = target.replace(/\\/g, '/');
  for (const entry of loaded) {
    const loadedPath = String(entry?.path || '').trim().replace(/\\/g, '/');
    if (loadedPath && loadedPath === normalized) {
      return String(entry?.id || '').trim();
    }
  }
  return '';
}

/**
 * @param {object | null | undefined} manifest
 * @returns {boolean}
 */
export function extensionHasOpenablePopup(manifest) {
  return Boolean(resolveExtensionPopupPath(manifest));
}
