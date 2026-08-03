/**
 * Pure helpers for Hub → Vercel fleet Zoho credential pull (no Electron).
 */

export function normalizeFleetApiUrl(raw) {
  const text = String(raw || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  let url;
  try {
    url = new URL(text);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:') return '';
  return url.origin + (url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, ''));
}

export function buildFleetCredentialsUrl(baseUrl) {
  const base = normalizeFleetApiUrl(baseUrl);
  if (!base) return '';
  if (/\/api\/zoho-credentials$/i.test(base)) return base;
  return `${base}/api/zoho-credentials`;
}

/**
 * Validate JSON body from the fleet API.
 * @returns {{ ok: true, clientId: string, clientSecret: string, refreshToken: string, dc: string } | { ok: false, error: string }}
 */
export function parseFleetCredentialsBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Fleet API returned an invalid response.' };
  }
  if (body.error) {
    return { ok: false, error: String(body.error) };
  }
  const clientId = String(body.clientId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim();
  const refreshToken = String(body.refreshToken || '').trim();
  const dc = String(body.dc || body.zohoCrmDc || 'in').trim() || 'in';
  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, error: 'Fleet API response is missing Zoho credentials.' };
  }
  return { ok: true, clientId, clientSecret, refreshToken, dc };
}
