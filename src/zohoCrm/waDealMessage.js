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
    `*Work Update*`,
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

/**
 * Compact fact sheet for the AI prep prompt (not paste-ready itself).
 * Self-contained — no imports; safe if ever stringified.
 */
export function dealFactsForPrompt(deal = {}) {
  const lines = [];
  const add = (label, value) => {
    const v = String(value ?? '').trim();
    if (v) lines.push(`${label}: ${v}`);
  };
  add('Deal name', deal.name);
  add('Stage', deal.stage);
  add('State', deal.state);
  add('Premise', deal.premise);
  add('Account', deal.accountName);
  if (deal.amount != null && deal.amount !== '') add('Amount', deal.amount);
  add('Closing date', deal.closingDate);
  add('Owner', deal.ownerName);
  if (deal.probability != null && deal.probability !== '') {
    add('Probability', `${deal.probability}%`);
  }
  add('Created', deal.createdTime);
  return lines.join('\n');
}

/** Strip model fluff so clipboard text is paste-ready for WhatsApp. */
export function sanitizePreparedWhatsAppMessage(text, fallback = '') {
  let out = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!out) return String(fallback || '').trim();

  // Drop markdown fences if the model wrapped the message.
  out = out.replace(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/m, '$1').trim();
  // Drop common preambles.
  out = out
    .replace(
      /^(here(?:'s| is) (?:your |the )?(?:prepared |rewritten |humanized )?(?:whatsapp )?message[:\s-]*)/i,
      '',
    )
    .replace(/^(sure[,!]?\s*)/i, '')
    .trim();

  // Reject empty or suspiciously short non-fallback results.
  if (out.length < 8) return String(fallback || '').trim();
  return out;
}

/**
 * Prompt: rewrite a single deal note for WhatsApp (main process only).
 */
export function buildDealWhatsAppPrepPrompt(deal = {}) {
  const facts = dealFactsForPrompt(deal);
  const fallback = formatDealWhatsAppMessage(deal);
  return [
    'You are Aspera AI inside Aspera Hub, helping an employee paste a short',
    'WhatsApp note about a Zoho CRM deal to a colleague or client.',
    'Rewrite the deal facts into a warm, clear, human WhatsApp message.',
    'Rules:',
    '- Use ONLY the facts provided. Do not invent amounts, dates, stages, codes, or names.',
    '- Keep every provided fact that is relevant (name, stage, state, premise).',
    '- Lead with *Work Update* as the title (exact casing). Do not say "Deal update".',
    '- Sound like a helpful colleague — not a CRM export or corporate robot.',
    '- WhatsApp formatting: short lines, *bold* sparingly for names/labels. No markdown fences.',
    '- Light emoji only if natural (0–2). No emoji walls.',
    '- Output ONLY the paste-ready message. No preamble, no quotes around the whole message.',
    '',
    'Deal facts:',
    facts || '(none)',
    '',
    'Deterministic draft (improve this; keep facts accurate):',
    fallback,
  ].join('\n');
}

/**
 * Prompt: rewrite a multi-deal digest for WhatsApp (main process only).
 */
export function buildDealsWhatsAppDigestPrepPrompt(deals = [], query = '') {
  const list = Array.isArray(deals) ? deals : [];
  const fallback = formatDealsWhatsAppDigest(list, query);
  const factBlocks = list
    .slice(0, 12)
    .map((deal, i) => `--- Deal ${i + 1} ---\n${dealFactsForPrompt(deal)}`)
    .join('\n\n');
  const q = String(query || '').trim();
  return [
    'You are Aspera AI inside Aspera Hub, helping an employee paste a short',
    'WhatsApp digest of Zoho CRM deals to a colleague.',
    'Rewrite the deal list into a clear, human WhatsApp message.',
    'Rules:',
    '- Use ONLY the facts provided. Do not invent amounts, dates, stages, codes, or names.',
    '- Cover every deal in the list (name + stage + state when present).',
    '- Sound like a helpful colleague — not a CRM export.',
    '- WhatsApp formatting: short lines, *bold* sparingly. No markdown fences.',
    '- Light emoji only if natural (0–2). No emoji walls.',
    '- Output ONLY the paste-ready message. No preamble.',
    q ? `Search query context: ${q}` : '',
    '',
    'Deal facts:',
    factBlocks || '(none)',
    '',
    'Deterministic draft (improve this; keep facts accurate):',
    fallback,
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
}
