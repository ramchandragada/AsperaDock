/**
 * Hub link tabs (Web Search → Canva, etc.): recover blank panes after SSO.
 *
 * Same-tab Google OAuth often returns to a white shell (or about:blank) while
 * cookies are already set. Soft-reload is skipped for link tabs (white SPAs
 * look empty), so we explicitly navigate to the site home once after IdP.
 */

import {
  isAuthOrLoginUrl,
  isGoogleOwnedUrl,
  isIdentityProviderUrl,
  isOauthCallbackUrl,
} from './guestNav.js';

/** Prefer the product home after SSO — canva.in login often lands blank. */
export function linkTabSiteHome(url) {
  try {
    const u = new URL(String(url || ''));
    if (!/^https?:$/i.test(u.protocol)) return '';
    const host = u.hostname.toLowerCase();
    if (host === 'canva.com' || host.endsWith('.canva.com') || host === 'canva.in' || host.endsWith('.canva.in')) {
      return 'https://www.canva.com/';
    }
    if (host === 'notion.so' || host.endsWith('.notion.so')) {
      return 'https://www.notion.so/';
    }
    if (host === 'figma.com' || host.endsWith('.figma.com')) {
      return 'https://www.figma.com/';
    }
    return `${u.origin}/`;
  } catch {
    return '';
  }
}

export function isBlankOrErrorGuestUrl(url) {
  const u = String(url || '').trim();
  if (!u) return true;
  if (u === 'about:blank' || u.startsWith('about:blank')) return true;
  if (u.startsWith('chrome-error://') || u === 'chrome://blank/') return true;
  return false;
}

/**
 * After IdP, these URLs still mean "not usable yet" — recover to site home.
 */
export function isPostAuthStuckUrl(url) {
  if (isBlankOrErrorGuestUrl(url)) return true;
  if (isIdentityProviderUrl(url)) return true;
  if (isOauthCallbackUrl(url)) return true;
  if (isAuthOrLoginUrl(url) && !isGoogleOwnedUrl(url)) return true;
  return false;
}

/**
 * Only adopt popup URLs into the Hub tab after the popup has visited an IdP,
 * and prefer non-login destinations. Pre-IdP canva.com/login must stay in the
 * popup so Google OAuth can continue.
 */
export function shouldAdoptLinkTabPopupUrlAfterIdp(popupUrl, { sawIdp = false } = {}) {
  const raw = String(popupUrl || '').trim();
  if (!raw.startsWith('http')) return false;
  if (isIdentityProviderUrl(raw)) return false;
  if (isOauthCallbackUrl(raw)) return false;
  if (isGoogleOwnedUrl(raw)) return false;
  if (!sawIdp) return false;
  // After IdP, login shells are still fragile — prefer site home via recovery.
  if (isAuthOrLoginUrl(raw)) return false;
  return true;
}

export const LINK_TAB_POST_AUTH_CHECK_MS = [1600, 3200, 5200];
