/**
 * Pure Zoho CRM Deals search helpers (no Electron deps — safe for unit tests).
 */

const MAX_QUERY_LEN = 80;

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
    return String(field.name || field.Name || '').trim();
  }
  return '';
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
