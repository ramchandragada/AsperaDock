import { languageInstruction } from './catalog.js';

export function buildSummarizePrompt({ text, appName }) {
  const body = String(text || '').trim().slice(0, 6_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Summarize selection — be brief and fast.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Produce summaries in THREE languages with these exact headings, in order:',
    '## English',
    '## Hindi (हिन्दी)',
    '## Marathi (मराठी)',
    'Under each heading: one-line TL;DR, then max 4 short bullets.',
    'Hindi and Marathi use Devanagari. Keep names/URLs as-is. No invented facts. No preamble.',
    '',
    'Selected text:',
    body,
  ].join('\n');
}

export function buildSuggestReplyPrompt({ text, appName }) {
  const body = String(text || '').trim().slice(0, 6_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Suggest short reply drafts — be brief and fast.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Produce drafts in THREE languages with these exact headings, in order:',
    '## English replies',
    '## Hindi replies (हिन्दी)',
    '## Marathi replies (मराठी)',
    'Under each: exactly 2 options labeled 1) and 2), each 1–2 sentences.',
    '1) formal, 2) warmer/concise. Hindi/Marathi in Devanagari. No invented facts. No preamble.',
    '',
    'Message / selection to reply to:',
    body,
  ].join('\n');
}

/** Polish a message the employee typed in the send/compose box before sending. */
export function buildRefineDraftPrompt({ text, appName }) {
  const body = String(text || '').trim().slice(0, 6_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Refine a message the employee is about to send.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Improve clarity, grammar, spelling, and professional tone.',
    'Keep the same language as the draft (English, Hindi, or Marathi).',
    'Hindi/Marathi stay in Devanagari when the draft uses them.',
    'Keep the meaning and intent. Do not invent facts or add commitments.',
    'Do not make it longer unless needed for clarity.',
    'Output ONLY the refined message text — no preamble, labels, or quotation wrappers.',
    '',
    'Draft to refine:',
    body,
  ].join('\n');
}

export { buildReviseReplyPrompt } from './replyEditor.js';

export function buildCatchMeUpPrompt({ items, language }) {
  const lines = (items || [])
    .slice(0, 30)
    .map((item, i) => {
      const app = item.appName || item.appId || 'App';
      const unread = item.unread > 0 ? ` (${item.unread} unread)` : '';
      const title = String(item.title || '').slice(0, 120);
      const body = String(item.body || '').slice(0, 240);
      return `${i + 1}. [${app}${unread}] ${title}${body ? ` — ${body}` : ''}`;
    })
    .join('\n');

  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Catch me up (WhatsApp, Arattai, Gmail, Zoho Mail only).',
    languageInstruction(language),
    'Give a brief briefing of what needs attention.',
    'Rules:',
    '- Group by urgency: Urgent / Soon / FYI.',
    '- Max 10 bullets total.',
    '- Prefer actionable next steps.',
    '- If the list is empty or sparse, say so briefly and suggest checking those apps.',
    '- Do not invent conversations that are not listed.',
    '- No preamble.',
    '',
    'Recent notifications / unread signals:',
    lines || '(none)',
  ].join('\n');
}
