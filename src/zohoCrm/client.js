/**
 * Zoho CRM API v8 client — Deals search + OAuth token refresh.
 */
import {
  ZOHO_CRM_OAUTH_SCOPES,
  resolveZohoCrmDc,
} from './dc.js';
import {
  buildDealsSearchCriteria,
  mapDealRecord,
  mapDealRecords,
  sanitizeDealQuery,
} from './deals.js';
import {
  getZohoCrmAuth,
  hasZohoCrmAuth,
  setZohoCrmAuth,
} from './keys.js';

export {
  buildDealsSearchCriteria,
  escapeZohoCriteriaValue,
  mapDealRecord,
  mapDealRecords,
  sanitizeDealQuery,
} from './deals.js';

const ACCESS_TOKEN_SKEW_MS = 10 * 60 * 1000; // refresh ~10 min early

/** @type {{ token: string, expiresAt: number, apiDomain: string } | null} */
let cachedAccess = null;

export function clearZohoCrmAccessCache() {
  cachedAccess = null;
}

async function postToken(accountsUrl, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${accountsUrl.replace(/\/$/, '')}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error || !json.access_token) {
    const msg =
      json.error_description ||
      json.message ||
      json.error ||
      `Token request failed (${res.status})`;
    throw new Error(String(msg));
  }
  return json;
}

/**
 * Exchange a one-time grant code for refresh + access tokens and persist secrets.
 */
export async function exchangeGrantCode({
  clientId,
  clientSecret,
  code,
  accountsUrl,
  apiDomain,
  dcId = 'in',
  redirectUri = '',
} = {}) {
  const dc = resolveZohoCrmDc(dcId);
  const accounts = String(accountsUrl || dc.accountsUrl).replace(/\/$/, '');
  const params = {
    grant_type: 'authorization_code',
    client_id: String(clientId || '').trim(),
    client_secret: String(clientSecret || '').trim(),
    code: String(code || '').trim(),
  };
  if (redirectUri) params.redirect_uri = String(redirectUri).trim();

  const json = await postToken(accounts, params);
  const refreshToken = String(json.refresh_token || '').trim();
  if (!refreshToken) {
    throw new Error(
      'No refresh_token returned. Use access_type=offline when generating the grant code.',
    );
  }

  setZohoCrmAuth({
    clientId: params.client_id,
    clientSecret: params.client_secret,
    refreshToken,
    accountsUrl: accounts,
    apiDomain: String(json.api_domain || apiDomain || dc.apiDomain).trim(),
    dcId: dc.id,
  });
  clearZohoCrmAccessCache();

  const expiresIn = Number(json.expires_in) || 3600;
  cachedAccess = {
    token: String(json.access_token),
    expiresAt: Date.now() + expiresIn * 1000,
    apiDomain: String(json.api_domain || apiDomain || dc.apiDomain),
  };

  return {
    ok: true,
    apiDomain: cachedAccess.apiDomain,
    scopes: ZOHO_CRM_OAUTH_SCOPES,
  };
}

export async function getAccessToken({ dcId = 'in' } = {}) {
  if (!hasZohoCrmAuth()) {
    throw new Error(
      'Zoho CRM is not connected. Open Settings → Integrations and add your API credentials.',
    );
  }

  if (
    cachedAccess?.token &&
    cachedAccess.expiresAt - ACCESS_TOKEN_SKEW_MS > Date.now()
  ) {
    return cachedAccess;
  }

  const auth = getZohoCrmAuth({ dcId });
  if (!auth.clientId || !auth.clientSecret || !auth.refreshToken) {
    throw new Error('Zoho CRM credentials are incomplete.');
  }

  const json = await postToken(auth.accountsUrl, {
    grant_type: 'refresh_token',
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    refresh_token: auth.refreshToken,
  });

  const expiresIn = Number(json.expires_in) || 3600;
  const apiDomain = String(json.api_domain || auth.apiDomain).trim();
  if (apiDomain && apiDomain !== auth.apiDomain) {
    setZohoCrmAuth({ apiDomain });
  }

  cachedAccess = {
    token: String(json.access_token),
    expiresAt: Date.now() + expiresIn * 1000,
    apiDomain,
  };
  return cachedAccess;
}

async function fetchDealsSearch(apiDomain, token, searchParams) {
  const url = new URL(`${apiDomain.replace(/\/$/, '')}/crm/v8/Deals/search`);
  for (const [k, v] of Object.entries(searchParams)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function fetchDealById(apiDomain, token, id) {
  const url = `${apiDomain.replace(/\/$/, '')}/crm/v8/Deals/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return Array.isArray(json?.data) ? json.data[0] : json?.data || null;
}

/**
 * Search often returns a thin field set. Pull full records when Stage metadata
 * (Created_Time / State / Premise) is missing so the popup can show them.
 */
async function hydrateDealDetails(deals, { apiDomain, token, crmHost }) {
  const need = (d) => d && (!d.createdTime || !d.state || !d.premise);
  const targets = deals.filter(need).slice(0, 8);
  if (!targets.length) return deals;

  const extras = await Promise.all(
    targets.map(async (deal) => {
      try {
        const raw = await fetchDealById(apiDomain, token, deal.id);
        if (!raw) return deal;
        const full = mapDealRecord(raw, { crmHost });
        return {
          ...deal,
          stage: deal.stage || full.stage,
          createdTime: deal.createdTime || full.createdTime,
          state: deal.state || full.state,
          premise: deal.premise || full.premise,
          accountName: deal.accountName || full.accountName,
          amount: deal.amount ?? full.amount,
          closingDate: deal.closingDate || full.closingDate,
          ownerName: deal.ownerName || full.ownerName,
          probability: deal.probability ?? full.probability,
          webUrl: deal.webUrl || full.webUrl,
        };
      } catch {
        return deal;
      }
    }),
  );
  const byId = new Map(extras.map((d) => [d.id, d]));
  return deals.map((d) => byId.get(d.id) || d);
}

/**
 * Search Deals by keyword (Deal_Name / Account_Name contains, then word search).
 */
export async function searchDeals(query, { dcId = 'in', limit = 15 } = {}) {
  const q = sanitizeDealQuery(query);
  if (!q) {
    return { ok: false, error: 'Select a keyword to look up.', deals: [] };
  }

  const auth = getZohoCrmAuth({ dcId });
  const access = await getAccessToken({ dcId });
  const criteria = buildDealsSearchCriteria(q);

  // Omit `fields` so Zoho returns custom columns (State, Premise, …) too.
  let { res, json } = await fetchDealsSearch(access.apiDomain, access.token, {
    criteria,
    per_page: String(Math.min(200, Math.max(1, limit))),
  });

  const noData =
    res.status === 204 ||
    res.status === 404 ||
    json?.code === 'NO_CONTENT' ||
    (!json?.data && res.ok);

  if (!res.ok || noData || !Array.isArray(json?.data) || !json.data.length) {
    const word = await fetchDealsSearch(access.apiDomain, access.token, {
      word: q,
      per_page: String(Math.min(200, Math.max(1, limit))),
    });
    if (word.res.ok && Array.isArray(word.json?.data) && word.json.data.length) {
      res = word.res;
      json = word.json;
    } else if (!res.ok && !word.res.ok) {
      const msg =
        json?.message ||
        word.json?.message ||
        json?.code ||
        `Zoho CRM search failed (${res.status || word.res.status})`;
      return { ok: false, error: String(msg), deals: [], query: q };
    }
  }

  let deals = mapDealRecords(json, { crmHost: auth.crmHost }).slice(0, limit);
  deals = await hydrateDealDetails(deals, {
    apiDomain: access.apiDomain,
    token: access.token,
    crmHost: auth.crmHost,
  });
  return { ok: true, deals, query: q };
}

/** Lightweight credential check used by Settings → Test connection. */
export async function testZohoCrmConnection({ dcId = 'in' } = {}) {
  try {
    const access = await getAccessToken({ dcId });
    return {
      ok: true,
      apiDomain: access.apiDomain,
      message: 'Connected — access token refreshed successfully.',
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}
