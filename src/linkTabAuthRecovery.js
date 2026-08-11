/**
 * Hub link tabs / Canva SSO recovery helpers.
 *
 * Never interrupt OAuth handoffs. Recover wiped about:blank documents and
 * Canva Cloudflare “This design is private” (403 / Ray ID) after Google SSO.
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

/** Design / editor deep links that 403 when the Canva session is missing. */
export function isCanvaDesignUrl(url) {
  if (!isCanvaAppUrl(url)) return false;
  try {
    const path = new URL(String(url || '')).pathname.toLowerCase();
    return (
      /^\/design\//.test(path) ||
      /^\/folder\//.test(path) ||
      /^\/brand\//.test(path) ||
      /^\/projects\//.test(path)
    );
  } catch {
    return false;
  }
}

/**
 * Canva (via Cloudflare) “This design is private” / Error 403 · Ray ID …-BOM.
 * Match page text — the URL usually stays on /design/….
 */
export function pageTextLooksLikeCanvaPrivate403(text) {
  const t = String(text || '');
  if (/this design is private/i.test(t)) return true;
  if (/error code:\s*403/i.test(t) && /ray id/i.test(t)) return true;
  if (/go to home to keep designing/i.test(t) && /403|ray id/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Stuck after SSO: blank/error docs OR a Canva private-design 403 page.
 * Login/callback handoffs are never stuck.
 */
export function isPostAuthStuckUrl(url, { pageText = '' } = {}) {
  if (isOauthHandoffUrl(url)) return false;
  if (isBlankOrErrorGuestUrl(url)) return true;
  if (isCanvaAppUrl(url) && pageTextLooksLikeCanvaPrivate403(pageText)) {
    return true;
  }
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

/** Blank + Canva-403 checks — give SSO and Canva hydrate time. */
export const LINK_TAB_POST_AUTH_CHECK_MS = [3500, 8000, 14000];
