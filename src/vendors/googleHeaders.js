/**
 * Pure Google request-header rewrite (unit-tested).
 * Kept separate from Electron inject so CI stays lightweight.
 */
export function applyGoogleRequestHeaders(
  headers,
  url,
  { chromeUA, firefoxAccountsUA, secChUa, enabled = true },
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
