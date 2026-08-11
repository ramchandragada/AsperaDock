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
    return ![
      'http:',
      'https:',
      'about:',
      'blob:',
      'data:',
      'chrome-extension:',
    ].includes(protocol);
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

/** Any first-party Google URL (incl. YouTube accounts, APIs, country TLDs). */
export function isGoogleOwnedUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    if (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'gstatic.com' ||
      host.endsWith('.gstatic.com') ||
      host === 'googleapis.com' ||
      host.endsWith('.googleapis.com') ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'ggpht.com' ||
      host.endsWith('.ggpht.com') ||
      host === 'withgoogle.com' ||
      host.endsWith('.withgoogle.com') ||
      host === 'gmail.com' ||
      host.endsWith('.gmail.com')
    ) {
      return true;
    }
    // Country Google TLDs used during SSO (google.co.in, google.co.uk, …).
    if (/^google\.co(\.[a-z]{2})?$/.test(host) || /^([a-z0-9-]+\.)+google\.co(\.[a-z]{2})?$/.test(host)) {
      return true;
    }
    if (/^google\.[a-z]{2}$/.test(host) || /^([a-z0-9-]+\.)+google\.[a-z]{2}$/.test(host)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** OAuth client hosts must open as real popups — never as Hub link tabs / main Gmail. */
export function isGoogleOauthClientUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return host.endsWith('.apps.googleusercontent.com');
  } catch {
    return false;
  }
}

/**
 * Google URLs that must stay inside Hub's Chromium session.
 * Opening them in Chrome (no Hub cookies / incomplete SSO handoff) produces
 * the familiar "400. That’s an error." Google robot page.
 */
export function mustKeepGoogleUrlInApp(url) {
  if (!url) return false;
  try {
    const u = new URL(String(url));
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.endsWith('.apps.googleusercontent.com')) return true;
    if (!isGoogleOwnedUrl(url)) return false;
    if (host === 'accounts.google.com' || host.endsWith('.accounts.google.com')) {
      return true;
    }
    if (host === 'accounts.youtube.com') return true;
    if (path === '/url' || path.endsWith('/url')) return true;
    if (
      /\/(oauth|consent|signin|login|logout|accountchooser|setosid|servicelogin|continue|gsi)\b/i.test(
        path,
      )
    ) {
      return true;
    }
    if (/[?&](continue|rapt|oauth|client_id|scope)=/i.test(u.search)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * External IdP / SSO hosts that must stay in a real popup — never fold into
 * a Hub link tab (would break opener handoff and one-time OAuth codes).
 */
export function isIdentityProviderUrl(url) {
  if (!url) return false;
  if (isGoogleOauthClientUrl(url)) return true;
  if (mustKeepGoogleUrlInApp(url)) return true;
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    if (host.startsWith('accounts.')) return true;
    if (host === 'login.microsoftonline.com' || host.endsWith('.login.microsoftonline.com')) {
      return true;
    }
    if (host === 'login.live.com' || host.endsWith('.login.live.com')) return true;
    if (host === 'appleid.apple.com' || host.endsWith('.appleid.apple.com')) return true;
    if (host === 'auth0.com' || host.endsWith('.auth0.com')) return true;
    if (host === 'okta.com' || host.endsWith('.okta.com')) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * OAuth redirect that still carries an authorization code / id_token.
 * The popup must consume these; loadURL into the parent would double-spend.
 */
export function isOauthCallbackUrl(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.searchParams.has('code') || u.searchParams.has('id_token')) return true;
    if (
      u.searchParams.has('state') &&
      /\/(oauth|callback|redirect|authorize)/i.test(u.pathname)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Hub link tabs (Web Search → Canva, etc.): when should we fold a popup URL
 * back into the dock tab?
 *
 * Unlike isAuthOrLoginUrl (used for "don't restore as home"), third-party
 * paths like canva.com/login/... are adoptable once they leave the IdP —
 * that is where OAuth often finishes while the parent tab stays blank.
 */
export function shouldAdoptLinkTabPopupUrl(popupUrl) {
  const raw = String(popupUrl || '').trim();
  if (!raw.startsWith('http')) return false;
  if (isIdentityProviderUrl(raw)) return false;
  if (isOauthCallbackUrl(raw)) return false;
  // Keep Google Search / Maps / etc. in the popup until a third-party app lands.
  if (isGoogleOwnedUrl(raw)) return false;
  return true;
}

/**
 * Link-tab window.open policy: real popup for IdP/Google auth; otherwise
 * stay in the same Hub tab. Google /url wrappers unwrap to the destination.
 * @returns {'popup'|'in-tab'} 
 */
export function linkTabWindowOpenAction(url) {
  const raw = String(url || '').trim();
  if (!raw || raw === 'about:blank' || raw.startsWith('about:blank')) {
    return 'popup';
  }
  if (!raw.startsWith('http')) return 'in-tab';
  const outbound = extractGoogleOutboundUrl(raw);
  if (outbound) {
    // Organic search results → load destination in the same tab (no floating popup).
    if (isIdentityProviderUrl(outbound) || mustKeepGoogleUrlInApp(outbound)) {
      return 'popup';
    }
    return 'in-tab';
  }
  if (isIdentityProviderUrl(raw)) return 'popup';
  if (isAuthOrLoginUrl(raw) && isGoogleOwnedUrl(raw)) return 'popup';
  if (mustKeepGoogleUrlInApp(raw)) return 'popup';
  return 'in-tab';
}

/**
 * True only for http(s) links that are safe to hand to the OS browser.
 * Blocks Google session/SSO URLs that 400 outside Hub.
 */
export function shouldOpenInSystemBrowser(url) {
  if (!url || isForbiddenGuestNavigation(url)) return false;
  try {
    const protocol = new URL(String(url)).protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return false;
  } catch {
    return false;
  }
  if (mustKeepGoogleUrlInApp(url)) return false;
  if (extractGoogleOutboundUrl(url)) {
    // Never open the wrapper itself; caller should unwrap first.
    return false;
  }
  return true;
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
    // OAuth client IDs (e.g. 2507573.apps.googleusercontent.com) need a popup.
    if (host.endsWith('.apps.googleusercontent.com')) return false;
    // Attachment previews / downloads
    if (host.endsWith('.googleusercontent.com') || host === 'googleusercontent.com') return true;
    // Google Drive / Docs viewers (linked files in emails)
    if (host === 'drive.google.com' || host === 'docs.google.com') return true;
    if (host === 'sheets.google.com' || host === 'slides.google.com') return true;
    // Rare Gmail chrome frames / Workspace shell
    if (host === 'workspace.google.com') return true;
    if (host === 'chat.google.com' || host === 'mail.google.com') return true;
    if (host === 'calendar.google.com') return true;
    if (host === 'meet.google.com') return true;
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
/** Zoho first-party hosts (Books/CRM/Mail/One CDN/SSO). */
export function isZohoOwnedUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return (
      host === 'zoho.com' ||
      host.endsWith('.zoho.com') ||
      host === 'zoho.in' ||
      host.endsWith('.zoho.in') ||
      host.includes('zohocdn.') ||
      host.includes('zohostatic.') ||
      host.includes('zohopublic.') ||
      host.includes('zohowebstatic.')
    );
  } catch {
    return false;
  }
}

/** Static/CDN hosts — never become Hub app-bar tabs. */
export function isZohoAssetHost(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return (
      host.includes('zohocdn.') ||
      host.includes('zohostatic.') ||
      host.includes('zohowebstatic.') ||
      host.includes('zohopublic.')
    );
  } catch {
    return true;
  }
}

/**
 * Zoho CRM / Books / One multi-screen workflows need shared-login Hub tabs —
 * like WhatsApp/Arattai third-party links. CDN/auth URLs stay out of the
 * app bar (those caused blank/reload loops when mistaken for deep links).
 */
export function shouldOpenZohoSharedDeepLinkAsHubTab(service, url) {
  const appId = String(service?.appId || '');
  if (appId !== 'zoho-crm' && appId !== 'zoho-books' && appId !== 'zoho-one') {
    return false;
  }
  const href = String(url || '');
  if (!href.startsWith('http')) return false;
  if (isAuthOrLoginUrl(href)) return false;
  if (isZohoAssetHost(href)) return false;
  // Zoho One fragile portal deep routes stay in-place (blank/reload loops).
  if (appId === 'zoho-one' && isFragileZohoOneDeepUrl(href)) return false;
  if (!isZohoOwnedUrl(href) && !isInternalUrl(href, service)) return false;
  return true;
}

/** @deprecated Use shouldOpenZohoSharedDeepLinkAsHubTab */
export function shouldOpenZohoCrmDeepLinkAsHubTab(service, url) {
  return shouldOpenZohoSharedDeepLinkAsHubTab(service, url);
}

/** WhatsApp / Arattai — messengers must never be replaced by Drive/Docs/etc. */
export function isMessagingAppId(appId) {
  const id = String(appId || '');
  return id === 'whatsapp' || id === 'arattai';
}

/**
 * URLs allowed to load inside a WhatsApp or Arattai guest tab.
 * Everything else (Google Drive, Docs, news, Canva, …) opens as a Hub tab.
 * Do NOT use isInternalUrl here — that allowlist includes google.com for Gmail.
 */
export function isAllowedMessagingTabUrl(service, url) {
  if (!service || !url || isForbiddenGuestNavigation(url)) return false;
  if (!isMessagingAppId(service.appId)) return false;
  try {
    const u = new URL(String(url));
    const protocol = u.protocol.toLowerCase();
    if (protocol === 'about:' || protocol === 'blob:' || protocol === 'data:') {
      return true;
    }
    const host = u.hostname.toLowerCase();
    if (service.appId === 'arattai') {
      return host === 'arattai.in' || host.endsWith('.arattai.in');
    }
    if (service.appId === 'whatsapp') {
      return (
        host === 'whatsapp.com' ||
        host.endsWith('.whatsapp.com') ||
        host === 'whatsapp.net' ||
        host.endsWith('.whatsapp.net')
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * How Gmail should treat window.open / outbound targets under Hub-tab mode.
 *
 * Gmail often opens `about:blank` first (then navigates). That must stay a
 * brief real popup so the opener script can assign a URL — a later adopt
 * folds it into a Hub tab. OAuth/SSO client hosts also need a real popup.
 * Every other http(s) link becomes a Hub app-bar tab (never a blank floating
 * Aspera Hub window left on screen).
 *
 * @returns {'blank-popup'|'oauth-popup'|'hub-tab'|'deny'}
 */
export function gmailWindowOpenAction(url) {
  const raw = String(url || '');
  if (!raw || raw === 'about:blank' || raw.startsWith('about:blank')) {
    return 'blank-popup';
  }
  if (!/^https?:\/\//i.test(raw)) return 'deny';

  let target = raw;
  try {
    const unwrapped = extractGoogleOutboundUrl(raw);
    if (unwrapped) target = unwrapped;
  } catch {
    // ignore
  }

  if (isGoogleOauthClientUrl(target)) return 'oauth-popup';
  if (isAuthOrLoginUrl(target) && isGoogleOwnedUrl(target)) return 'oauth-popup';
  return 'hub-tab';
}

/**
 * Same product/ecosystem as the catalog app — must stay in that Hub tab
 * (or a real auth popup). Never becomes a surprise top-bar link tab.
 * Exception: Zoho CRM/Books/One deep links may open as shared Hub tabs (see
 * shouldOpenZohoSharedDeepLinkAsHubTab).
 */
export function isSameEcosystemUrl(service, url) {
  if (!service || !url) return false;
  // WhatsApp / Arattai: only first-party messenger hosts — never Google via
  // INTERNAL_HOSTS (that list exists for Gmail and was swallowing Drive clicks).
  if (isMessagingAppId(service.appId)) {
    return isAllowedMessagingTabUrl(service, url);
  }
  if (isInternalUrl(url, service)) return true;
  const appId = String(service.appId || '');
  if (appId === 'gmail' && isGoogleOwnedUrl(url)) return true;
  if (appId === 'canva') {
    try {
      const host = new URL(String(url || '')).hostname.toLowerCase();
      if (
        host === 'canva.com' ||
        host.endsWith('.canva.com') ||
        host === 'canva.in' ||
        host.endsWith('.canva.in')
      ) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  if (appId.startsWith('zoho') && isZohoOwnedUrl(url)) return true;
  return false;
}

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
  // Canva design deep-links 403 (“This design is private” / Ray ID …-BOM)
  // when the session is missing — never cold-start or Home onto them.
  if (service.appId === 'canva' && candidate) {
    try {
      const path = new URL(String(candidate)).pathname.toLowerCase();
      if (/^\/(design|folder|brand|projects)\//.test(path)) {
        return service.url || 'https://www.canva.com/';
      }
    } catch {
      // fall through
    }
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
