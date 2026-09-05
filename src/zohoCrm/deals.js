/**
 * Pure Zoho CRM Deals search helpers (no Electron deps — safe for unit tests).
 */

const MAX_QUERY_LEN = 80;

/**
 * Prefer asking Zoho for these standard fields. Custom fields (Premise, State, …)
 * are still mapped if the API returns them; listing unknown API names breaks search.
 */
export const DEAL_LOOKUP_FIELDS = [
  'Deal_Name',
  'Stage',
  'Amount',
  'Closing_Date',
  'Account_Name',
  'Owner',
  'Probability',
  'Created_Time',
  'Modified_Time',
].join(',');

export function sanitizeDealQuery(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LEN);
}

/** Escape a value for Zoho CRM search criteria. */
export function escapeZohoCriteriaValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/:/g, '\\:');
}

export function buildDealsSearchCriteria(query) {
  const q = sanitizeDealQuery(query);
  if (!q) return '';
  const v = escapeZohoCriteriaValue(q);
  return `((Deal_Name:contains:${v})or(Account_Name:contains:${v}))`;
}

function nameOf(field) {
  if (!field) return '';
  if (typeof field === 'string') return field.trim();
  if (typeof field === 'object') {
    return String(field.name || field.Name || field.display_value || '').trim();
  }
  return '';
}

function scalarOf(field) {
  if (field == null || field === '') return '';
  if (
    typeof field === 'string' ||
    typeof field === 'number' ||
    typeof field === 'boolean'
  ) {
    return String(field).trim();
  }
  if (typeof field === 'object') {
    return String(
      field.name ||
        field.Name ||
        field.display_value ||
        field.value ||
        '',
    ).trim();
  }
  return '';
}

/** First matching field by exact API name (case-insensitive). */
export function pickField(raw, names = []) {
  if (!raw || typeof raw !== 'object') return '';
  const entries = Object.entries(raw);
  for (const want of names) {
    const target = String(want || '').toLowerCase();
    for (const [key, value] of entries) {
      if (String(key).toLowerCase() === target) {
        const text = scalarOf(value);
        if (text) return text;
      }
    }
  }
  return '';
}

/** First field whose API name matches a regex (e.g. /premise/i). */
export function pickFieldByPattern(raw, pattern) {
  if (!raw || typeof raw !== 'object' || !pattern) return '';
  for (const [key, value] of Object.entries(raw)) {
    if (!pattern.test(String(key))) continue;
    const text = scalarOf(value);
    if (text) return text;
  }
  return '';
}

export function formatZohoDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return raw;
  }
}

export function mapDealRecord(raw, { crmHost = 'https://crm.zoho.in' } = {}) {
  const id = String(raw?.id || '').trim();
  const name =
    String(raw?.Deal_Name || raw?.deal_name || '').trim() || 'Untitled deal';
  const stage = String(raw?.Stage || raw?.stage || '').trim();
  const amount = raw?.Amount ?? raw?.amount ?? null;
  const closingDate = String(
    raw?.Closing_Date || raw?.closing_date || '',
  ).trim();
  const accountName = nameOf(raw?.Account_Name || raw?.account_name);
  const ownerName = nameOf(raw?.Owner || raw?.owner);
  const probability =
    raw?.Probability ?? raw?.probability ?? raw?.$probability ?? null;
  const createdTimeRaw = pickField(raw, ['Created_Time', 'created_time']);
  const createdTime = formatZohoDateTime(createdTimeRaw) || createdTimeRaw;
  const state =
    pickField(raw, ['State', 'Billing_State', 'Shipping_State']) ||
    pickFieldByPattern(raw, /^state$/i);
  const premise =
    pickField(raw, [
      'Premise',
      'Premises',
      'Premise_Name',
      'Premise_Compliance',
      'Premise_Compliance_Code',
    ]) || pickFieldByPattern(raw, /premise/i);
  const webUrl =
    String(raw?.$web_url || raw?.web_url || '').trim() ||
    (id
      ? `${String(crmHost).replace(/\/$/, '')}/crm/EntityInfo.do?module=Deals&id=${encodeURIComponent(id)}`
      : '');

  return {
    id,
    name,
    stage,
    amount: amount == null || amount === '' ? null : Number(amount),
    closingDate,
    accountName,
    ownerName,
    probability:
      probability == null || probability === '' ? null : Number(probability),
    createdTime,
    state,
    premise,
    webUrl,
  };
}

export function mapDealRecords(payload, opts = {}) {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  return rows.map((row) => mapDealRecord(row, opts)).filter((d) => d.id);
}
