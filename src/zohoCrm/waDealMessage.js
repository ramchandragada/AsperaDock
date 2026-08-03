/**
 * WhatsApp-friendly deal status messages (plain text + *bold* markers).
 * Keep helpers self-contained — these are .toString()-injected into the float popup.
 */

/**
 * Single-deal message for pasting to a client in WhatsApp.
 */
export function formatDealWhatsAppMessage(deal = {}) {
  const name = String(deal.name || '').trim() || 'Deal';
  const row = (label, value) => {
    const v = String(value || '').trim();
    return v ? `*${label}:* ${v}` : '';
  };
  const parts = [
    `*Deal update*`,
    '',
    `*${name}*`,
    row('Stage', deal.stage),
    row('State', deal.state),
    row('Premise', deal.premise),
  ].filter((p, i, arr) => !(p === '' && arr[i - 1] === ''));

  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.join('\n');
}

/**
 * Digest of all visible deals — Name / Stage / State for WhatsApp.
 */
export function formatDealsWhatsAppDigest(deals = [], query = '') {
  const list = Array.isArray(deals) ? deals : [];
  const q = String(query || '').trim();
  const header = q ? `*Deal status — ${q}*` : `*Deal status*`;
  const countLine = `_${list.length} deal${list.length === 1 ? '' : 's'}_`;

  if (!list.length) {
    return [header, countLine, '', 'No matching deals.'].join('\n');
  }

  const blocks = list.map((deal, i) => {
    const name = String((deal && deal.name) || '').trim() || `Deal ${i + 1}`;
    const rows = [
      `${i + 1}. *${name}*`,
      deal && deal.stage ? `   Stage: ${String(deal.stage).trim()}` : '',
      deal && deal.state ? `   State: ${String(deal.state).trim()}` : '',
    ].filter(Boolean);
    return rows.join('\n');
  });

  return [header, countLine, '', ...blocks].join('\n');
}
