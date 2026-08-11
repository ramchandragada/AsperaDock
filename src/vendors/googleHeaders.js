/**
 * Pure Google request-header rewrite (unit-tested).
 * Kept separate from Electron inject so CI stays lightweight.
 *
 * IMPORTANT: Firefox UA on accounts.google.com helps Gmail, but mid-OAuth for
 * Canva (consent / "signing back in") often has no "canva" in the URL/Referer.
 * Flipping Chrome→Firefox on Continue breaks SSO and Canva/Cloudflare sessions.
 * Prefer Chrome for third-party OAuth and keep it sticky for the whole journey.
 */

/** Third-party OAuth (Canva, etc.) must keep Chrome UA. */
export function isThirdPartyGoogleOauthRequest(url, headers = {}) {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    if (host !== 'accounts.google.com' && !host.endsWith('.accounts.google.com')) {
      return false;
    }
    const blob = [
      u.href,
      u.search,
      u.searchParams.get('continue') || '',
      u.searchParams.get('redirect_uri') || '',
      headers.Referer || headers.referer || '',
      headers.Origin || headers.origin || '',
    ].join(' ');
    if (/canva\.|notion\.|figma\.|dropbox\.|slack\.|zoom\./i.test(blob)) {
      return true;
    }
    // Consent / id steps after Canva OAuth often lack canva in URL — caller
    // should pass preferChromeAccounts / sticky from an earlier match.
    return false;
  } catch {
    return false;
  }
}

/** Google accounts OAuth paths that continue a sticky third-party journey. */
export function isGoogleAccountsOauthPath(url) {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    if (host !== 'accounts.google.com' && !host.endsWith('.accounts.google.com')) {
      return false;
    }
    return /\/(o\/oauth2|signin\/oauth|gsi|oauth|AccountChooser)/i.test(
      `${u.pathname}${u.search}`,
    );
  } catch {
    return false;
  }
}

/**
 * @param {Record<string,string>} headers
 * @param {string} url
 * @param {{
 *   chromeUA: string,
 *   firefoxAccountsUA: string,
 *   secChUa: string,
 *   enabled?: boolean,
 *   preferChromeAccounts?: boolean,
 * }} opts
 */
export function applyGoogleRequestHeaders(
  headers,
  url,
  {
    chromeUA,
    firefoxAccountsUA,
    secChUa,
    enabled = true,
    preferChromeAccounts = false,
  },
) {
  if (!enabled) return headers;
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return headers;
  }
  const next = { ...headers };
  const applyChrome = () => {
    next['User-Agent'] = chromeUA;
    next['sec-ch-ua'] = secChUa;
    next['sec-ch-ua-mobile'] = '?0';
    next['sec-ch-ua-platform'] = '"Linux"';
  };
  const applyFirefox = () => {
    next['User-Agent'] = firefoxAccountsUA;
    delete next['sec-ch-ua'];
    delete next['sec-ch-ua-mobile'];
    delete next['sec-ch-ua-platform'];
    delete next['Sec-CH-UA'];
    delete next['Sec-CH-UA-Mobile'];
    delete next['Sec-CH-UA-Platform'];
  };

  if (host === 'accounts.google.com' || host.endsWith('.accounts.google.com')) {
    if (
      preferChromeAccounts ||
      isThirdPartyGoogleOauthRequest(url, headers)
    ) {
      applyChrome();
    } else {
      applyFirefox();
    }
  } else {
    applyChrome();
    if (!next['User-Agent']) next['User-Agent'] = chromeUA;
  }
  return next;
}

export function assertHttpsUrl(url, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must be HTTPS`);
  }
  return parsed;
}
