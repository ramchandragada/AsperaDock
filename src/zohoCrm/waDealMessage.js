/**
 * WhatsApp-friendly deal status messages (plain text + *bold* markers).
 */

function line(label, value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return `*${label}:* ${v}`;
}

/**
 * Single-deal message for pasting to a client in WhatsApp.
 */
export function formatDealWhatsAppMessage(deal = {}) {
  const name = String(deal.name || '').trim() || 'Deal';
  const parts = [
    `*Deal update*`,
    '',
    `*${name}*`,
    line('Stage', deal.stage),
    line('State', deal.state),
    line('Premise', deal.premise),
  ].filter((p, i, arr) => !(p === '' && arr[i - 1] === ''));

  // Drop trailing blank
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.join('\n');
}

/**
 * Digest of all visible deals — Name / Stage / State for WhatsApp.
 */
export function formatDealsWhatsAppDigest(deals = [], query = '') {
  const list = Array.isArray(deals) ? deals : [];
  const q = String(query || '').trim();
  const header = q
    ? `*Deal status — ${q}*`
    : `*Deal status*`;
  const countLine = `_${list.length} deal${list.length === 1 ? '' : 's'}_`;

  if (!list.length) {
    return [header, countLine, '', 'No matching deals.'].join('\n');
  }

  const blocks = list.map((deal, i) => {
    const name = String(deal?.name || '').trim() || `Deal ${i + 1}`;
    const rows = [
      `${i + 1}. *${name}*`,
      deal?.stage ? `   Stage: ${String(deal.stage).trim()}` : '',
      deal?.state ? `   State: ${String(deal.state).trim()}` : '',
    ].filter(Boolean);
    return rows.join('\n');
  });

  return [header, countLine, '', ...blocks].join('\n');
}
