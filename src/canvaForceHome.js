/**
 * Hard Canva home redirects — title / HTTP 403 based (no fragile scraping).
 * Canva’s private-design page title is reliable; OAuth “continue” URLs often
 * bounce Hub straight back onto the same /design/ 403 after Google sign-in.
 */

import {
  isCanvaAppUrl,
  isCanvaDesignUrl,
  linkTabSiteHome,
  pageTextLooksLikeCanvaPrivate403,
} from './linkTabAuthRecovery.js';

export { pageTextLooksLikeCanvaPrivate403 };

export function isCanvaPrivateDesignTitle(title) {
  return /this design is private/i.test(String(title || ''));
}

export function canvaCatalogHome(urlOrServiceUrl = '') {
  return linkTabSiteHome(urlOrServiceUrl) || 'https://www.canva.com/';
}

/** True when Hub should refuse to stay on this Canva URL. */
export function shouldForceCanvaHome({
  url = '',
  title = '',
  pageText = '',
  httpStatus = 0,
} = {}) {
  if (title && isCanvaPrivateDesignTitle(title)) return true;
  if (pageText && pageTextLooksLikeCanvaPrivate403(pageText)) return true;
  if (Number(httpStatus) === 403 && isCanvaAppUrl(url)) return true;
  if (Number(httpStatus) === 403 && isCanvaDesignUrl(url)) return true;
  return false;
}

export function isAlreadyCanvaHome(url) {
  try {
    const u = new URL(String(url || ''));
    if (!isCanvaAppUrl(u.href)) return false;
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return path === '/' || path === '';
  } catch {
    return false;
  }
}
