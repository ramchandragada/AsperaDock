/**
 * Hub link tabs / Canva SSO recovery helpers.
 *
 * Never interrupt OAuth handoffs. Only recover wiped about:blank documents.
 * Preserve canva.in vs canva.com hosts for cookie affinity.
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

/** Only wiped documents — never login/callback pages. */
export function isPostAuthStuckUrl(url) {
  return isBlankOrErrorGuestUrl(url);
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

/** True if URL should open as the Canva catalog app instead of a link tab. */
export function isCanvaAppUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return (
      host === 'canva.com' ||
      host.endsWith('.canva.com') ||
      host === 'canva.in' ||
      host.endsWith('.canva.in')
    );
  } catch {
    return false;
  }
}

/** Blank-only, delayed — give SSO and Canva hydrate time. */
export const LINK_TAB_POST_AUTH_CHECK_MS = [8000, 14000];
