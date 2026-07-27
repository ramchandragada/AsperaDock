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
