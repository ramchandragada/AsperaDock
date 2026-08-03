/**
 * Pure helpers for the fleet Zoho credentials endpoint (testable without Vercel).
 */
import crypto from 'node:crypto';

export function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function extractBearerToken(authorizationHeader) {
  const raw = String(authorizationHeader || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match ? match[1].trim() : '';
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {{ ok: true, body: object } | { ok: false, status: number, error: string }}
 */
export function buildZohoCredentialsResponse(env = {}) {
  const expected = String(env.FLEET_BEARER_TOKEN || '').trim();
  if (!expected) {
    return { ok: false, status: 503, error: 'Fleet token is not configured on the server.' };
  }

  const clientId = String(env.ZOHO_CRM_CLIENT_ID || '').trim();
  const clientSecret = String(env.ZOHO_CRM_CLIENT_SECRET || '').trim();
  const refreshToken = String(env.ZOHO_CRM_REFRESH_TOKEN || '').trim();
  const dc = String(env.ZOHO_CRM_DC || 'in').trim() || 'in';

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      ok: false,
      status: 503,
      error: 'Zoho CRM credentials are incomplete on the server.',
    };
  }

  return {
    ok: true,
    body: {
      clientId,
      clientSecret,
      refreshToken,
      dc,
    },
  };
}

/**
 * Authorize + build response for a request.
 * @param {{ authorization?: string }} headers
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function handleZohoCredentialsRequest(headers = {}, env = process.env) {
  const expected = String(env.FLEET_BEARER_TOKEN || '').trim();
  if (!expected) {
    return { status: 503, body: { error: 'Fleet token is not configured on the server.' } };
  }

  const provided = extractBearerToken(headers.authorization || headers.Authorization);
  if (!provided || !timingSafeEqualString(provided, expected)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const built = buildZohoCredentialsResponse(env);
  if (!built.ok) {
    return { status: built.status, body: { error: built.error } };
  }
  return { status: 200, body: built.body };
}
