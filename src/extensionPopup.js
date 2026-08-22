/**
 * Resolve Chrome extension popup URLs for Hub's "Open extension" action.
 * Pure helpers — no Electron imports (unit-testable).
 */

/** Bitwarden Chrome Web Store id — popup needs #/home in pop-out mode. */
export const BITWARDEN_CHROME_STORE_ID = 'nngceckbapebfimnlniiiahkandclblb';

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
 * @param {{ popout?: boolean, hash?: string, chromeStoreId?: string }} [opts]
 * @returns {string}
 */
export function buildExtensionPopupUrl(
  runtimeId,
  popupPath,
  { popout = true, hash = '', chromeStoreId = '' } = {},
) {
  const id = String(runtimeId || '').trim();
  const rel = String(popupPath || '').trim().replace(/^\//, '');
  if (!id || !rel) return '';
  let url = `chrome-extension://${id}/${rel}`;
  if (popout && !url.includes('uilocation=')) {
    url += url.includes('?') ? '&uilocation=popout' : '?uilocation=popout';
  }
  const route =
    String(hash || '').trim() ||
    (String(chromeStoreId || '').toLowerCase() === BITWARDEN_CHROME_STORE_ID
      ? '#/home'
      : '');
  if (route) {
    url += route.startsWith('#') ? route : `#${route}`;
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
  const normalizedTarget = target.replace(/\\/g, '/').replace(/\/+$/, '');
  for (const entry of loaded) {
    const loadedPath = String(entry?.path || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+$/, '');
    if (loadedPath && loadedPath === normalizedTarget) {
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

/**
 * @param {string} html
 * @returns {string}
 */
export function buildExtensionPopupFallbackDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(String(html || ''))}`;
}
