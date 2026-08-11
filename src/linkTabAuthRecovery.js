/**
 * Hub link-tab SSO recovery helpers.
 *
 * Never interrupt OAuth handoffs. Recover wiped about:blank documents after
 * Google (or other IdP) SSO returns to a link tab. Preserve canva.in vs
 * canva.com hosts when mapping ad-hoc link-tab homes for cookie affinity.
 */

import {
  isAuthOrLoginUrl,
  isGoogleOwnedUrl,
  isIdentityProviderUrl,
  isOauthCallbackUrl,
} from './guestNav.js';

export function linkTabSiteHome(url) {
  try {
    const u = new URL(String(url || ''));
    if (!/^https?:$/i.test(u.protocol)) return '';
    const host = u.hostname.toLowerCase();
    if (host === 'canva.in' || host.endsWith('.canva.in')) {
      return 'https://www.canva.in/';
    }
    if (host === 'canva.com' || host.endsWith('.canva.com')) {
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

export function isOauthHandoffUrl(url) {
  if (!url || !String(url).startsWith('http')) return false;
  if (isIdentityProviderUrl(url)) return true;
  if (isOauthCallbackUrl(url)) return true;
  if (isAuthOrLoginUrl(url) && !isGoogleOwnedUrl(url)) return true;
  return false;
}

/**
 * Stuck after SSO: blank/error docs. Login/callback handoffs are never stuck.
 */
export function isPostAuthStuckUrl(url) {
  if (isOauthHandoffUrl(url)) return false;
  if (isBlankOrErrorGuestUrl(url)) return true;
  return false;
}

export function shouldAdoptLinkTabPopupUrlAfterIdp(popupUrl, { sawIdp = false } = {}) {
  const raw = String(popupUrl || '').trim();
  if (!raw.startsWith('http')) return false;
  if (isOauthHandoffUrl(raw)) return false;
  if (isGoogleOwnedUrl(raw)) return false;
  if (!sawIdp) return false;
  if (isAuthOrLoginUrl(raw)) return false;
  return true;
}

/** Blank / stuck checks after IdP returns to a link tab. */
export const LINK_TAB_POST_AUTH_CHECK_MS = [1200, 3500, 8000];
