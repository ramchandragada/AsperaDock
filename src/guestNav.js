/**
 * Guest navigation policy — pure helpers (unit-tested).
 * Fail closed: malformed URLs are never treated as in-dock.
 */
import { INTERNAL_HOSTS } from './services.js';

export function baseDomain(hostname) {
  return String(hostname || '')
    .split('.')
    .slice(-2)
    .join('.');
}

export function isInternalUrl(url, service, hosts = INTERNAL_HOSTS) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  let serviceHost = '';
  try {
    serviceHost = baseDomain(new URL(service.url).hostname);
  } catch {
    serviceHost = '';
  }
  const allowed = [serviceHost, ...hosts].filter(Boolean);
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Dangerous or non-web schemes must never navigate inside a guest. */
export function isForbiddenGuestNavigation(url) {
  try {
    const protocol = new URL(String(url || '')).protocol.toLowerCase();
    return !['http:', 'https:', 'about:', 'blob:', 'data:'].includes(protocol);
  } catch {
    return true;
  }
}

/** True for login / MFA / OAuth pages — never restore these as "home". */
export function isAuthOrLoginUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const pathName = u.pathname.toLowerCase();
    if (host.startsWith('accounts.')) return true;
    if (host.includes('accounts.google.')) return true;
    if (/\/signin|\/login|\/logout|\/oauth|\/oneauth|\/mfa|\/verify/i.test(pathName)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Gmail wraps outbound links as https://www.google.com/url?q=<external>.
 * Those must open in the system browser — never replace the Gmail tab.
 * @returns {string|null} external http(s) URL if this is a redirect wrapper
 */
export function extractGoogleOutboundUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    if (!host.endsWith('google.com') && host !== 'google.com') return null;
    const path = u.pathname.toLowerCase();
    if (path !== '/url' && !path.endsWith('/url')) return null;
    const target =
      u.searchParams.get('q') ||
      u.searchParams.get('url') ||
      u.searchParams.get('u');
    if (!target) return null;
    const decoded = decodeURIComponent(String(target).trim());
    if (!/^https?:\/\//i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Any first-party Google URL (google.com / googleusercontent.com / gstatic.com). */
export function isGoogleOwnedUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'gstatic.com' ||
      host.endsWith('.gstatic.com')
    );
  } catch {
    return false;
  }
}

/**
 * URLs allowed to load inside a Gmail Hub tab (inbox / auth only).
 * Everything else (news sites, gov portals, google.com/url wrappers) must leave.
 */
export function isAllowedGmailTabUrl(url) {
  if (!url || isForbiddenGuestNavigation(url)) return false;
  if (isAuthOrLoginUrl(url)) return true;
  if (extractGoogleOutboundUrl(url)) return false;
  try {
    const u = new URL(String(url));
    const host = u.hostname.toLowerCase();
    if (host === 'mail.google.com' || host.endsWith('.mail.google.com')) return true;
    if (host === 'inbox.google.com') return true;
    if (host === 'accounts.google.com' || host.endsWith('.accounts.google.com')) {
      return true;
    }
    if (host === 'accounts.youtube.com') return true;
    if (host === 'contacts.google.com') return true;
    if (host === 'ogs.google.com') return true;
    // Rare Gmail chrome frames
    if (host === 'workspace.google.com') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Zoho One deep embedded-app routes (CRM / Books / etc. under cxapp-spaces)
 * often paint a blank white pane when restored as a cold start URL. Prefer the
 * portal home and let the user open Sales → CRM again (session stays signed in).
 */
export function isFragileZohoOneDeepUrl(url) {
  try {
    const path = new URL(String(url || '')).pathname.toLowerCase();
    if (path.includes('/cxapp-spaces/')) return true;
    if (path.includes('/crm/') && /\/tab\//.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Safe cold-start URL for a service (avoids fragile deep SPA routes). */
export function safeStartUrlForService(service, candidate) {
  if (!service) return candidate || '';
  if (
    service.appId === 'zoho-one' &&
    candidate &&
    isFragileZohoOneDeepUrl(candidate)
  ) {
    return service.url;
  }
  return candidate || service.url;
}

/**
 * Only restore URLs that belong to this app (shared Zoho SSO can hop products).
 * Zoho One is a portal — allow any *.zoho.in / *.zoho.com host for that app.
 */
export function isUrlForService(service, url) {
  if (!service || !url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    let expected = '';
    try {
      expected = new URL(service.url).hostname.toLowerCase();
    } catch {
      return false;
    }
    if (!expected) return false;
    if (host === expected || host.endsWith(`.${expected}`)) return true;

    const product = expected.split('.')[0];
    const hostProduct = host.split('.')[0];
    if (
      product &&
      hostProduct === product &&
      (host.endsWith('.zoho.com') || host.endsWith('.zoho.in')) &&
      (expected.endsWith('.zoho.com') || expected.endsWith('.zoho.in'))
    ) {
      return true;
    }

    if (
      service.appId === 'zoho-one' &&
      (host.endsWith('.zoho.in') || host.endsWith('.zoho.com'))
    ) {
      return true;
    }

    if (
      service.appId === 'arattai' &&
      (host.endsWith('.arattai.in') || host === 'arattai.in')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
