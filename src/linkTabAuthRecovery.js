/**
 * Hub link tabs (Web Search → Canva, etc.): recover blank panes after SSO.
 *
 * IMPORTANT: never navigate away from OAuth callbacks or live /login handoffs —
 * doing so (v0.5.28) aborted Google SSO and bounced users back to “log in again”.
 * Only recover true blank/error documents; preserve the site’s own host (canva.in
 * must not be rewritten to canva.com).
 */

import {
  isAuthOrLoginUrl,
  isGoogleOwnedUrl,
  isIdentityProviderUrl,
  isOauthCallbackUrl,
} from './guestNav.js';

/**
 * Product home for a link-tab URL — keep the same site host/TLD so SSO cookies
 * (e.g. canva.in) are not abandoned by jumping to another domain.
 */
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

/**
 * True while an OAuth / login handoff must not be interrupted.
 */
export function isOauthHandoffUrl(url) {
  if (!url || !String(url).startsWith('http')) return false;
  if (isIdentityProviderUrl(url)) return true;
  if (isOauthCallbackUrl(url)) return true;
  // App login shells often finish the Google redirect — leave them alone.
  if (isAuthOrLoginUrl(url) && !isGoogleOwnedUrl(url)) return true;
  return false;
}

/**
 * Only wiped documents count as “stuck” for forced recovery.
 * Login pages and OAuth callbacks are NOT stuck — they are in progress.
 */
export function isPostAuthStuckUrl(url) {
  return isBlankOrErrorGuestUrl(url);
}

/**
 * Only adopt popup URLs into the Hub tab after the popup has visited an IdP,
 * and never fold login/callback shells (that aborts SSO).
 */
export function shouldAdoptLinkTabPopupUrlAfterIdp(popupUrl, { sawIdp = false } = {}) {
  const raw = String(popupUrl || '').trim();
  if (!raw.startsWith('http')) return false;
  if (isOauthHandoffUrl(raw)) return false;
  if (isGoogleOwnedUrl(raw)) return false;
  if (!sawIdp) return false;
  if (isAuthOrLoginUrl(raw)) return false;
  return true;
}

/** Blank-only checks — give SSO time to finish before any recovery. */
export const LINK_TAB_POST_AUTH_CHECK_MS = [5000, 9000, 14000];
