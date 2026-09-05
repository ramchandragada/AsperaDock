/**
 * Pure Google request-header rewrite (unit-tested).
 *
 * accounts.google.com ALWAYS uses a Firefox UA in Hub. That is intentional:
 * Google shows “This browser or app may not be secure” for Electron when we
 * send a Chrome UA on the accounts host (especially first-time sign-in).
 * Firefox softens that gate for ALL Google sign-in — Gmail and third-party
 * OAuth alike.
 *
 * Never flip Chrome↔Firefox mid-OAuth. Destination sites still get Chrome + CH
 * elsewhere so CDNs are happy — only the accounts host is Firefox.
 */

/** True when Google blocked embedded sign-in (“browser may not be secure”). */
export function isGoogleInsecureBrowserErrorUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    if (host !== 'accounts.google.com' && !host.endsWith('.accounts.google.com')) {
      return false;
    }
    const path = u.pathname.toLowerCase();
    if (/rejected|deniedsigninrejected|signin\/rejected/i.test(path)) return true;
    if (/browser.?not.?secure|not.?secure/i.test(u.search)) return true;
    return false;
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
  if (host === 'accounts.google.com' || host.endsWith('.accounts.google.com')) {
    next['User-Agent'] = firefoxAccountsUA;
    delete next['sec-ch-ua'];
    delete next['sec-ch-ua-mobile'];
    delete next['sec-ch-ua-platform'];
    delete next['Sec-CH-UA'];
    delete next['Sec-CH-UA-Mobile'];
    delete next['Sec-CH-UA-Platform'];
  } else {
    next['User-Agent'] = next['User-Agent'] || chromeUA;
    next['sec-ch-ua'] = secChUa;
    next['sec-ch-ua-mobile'] = '?0';
    next['sec-ch-ua-platform'] = '"Linux"';
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
