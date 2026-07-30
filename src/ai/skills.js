import { languageInstruction } from './catalog.js';

export function buildSummarizePrompt({ text, appName }) {
  const body = String(text || '').trim().slice(0, 12_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Summarize selection.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Summarize the selected text for a busy employee.',
    'You MUST produce summaries in THREE languages, in this exact order and with these headings:',
    '',
    '## English',
    '## Hindi (हिन्दी)',
    '## Marathi (मराठी)',
    '',
    'Under each heading:',
    '- Start with one-line TL;DR.',
    '- Then 3–6 short bullets (action items, people, amounts, dates).',
    '- Hindi and Marathi must use Devanagari script.',
    '- Keep names and URLs as-is.',
    '- Do not invent facts that are not in the text.',
    '- No preamble like "Here is a summary".',
    '',
    'Selected text:',
    body,
  ].join('\n');
}

export function buildSuggestReplyPrompt({ text, appName }) {
  const body = String(text || '').trim().slice(0, 12_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Suggest reply drafts for this specific message/selection.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Give the employee rough reply ideas they can adapt — not final send-ready copy unless it is already perfect.',
    'You MUST produce reply drafts in THREE languages, in this exact order and with these headings:',
    '',
    '## English replies',
    '## Hindi replies (हिन्दी)',
    '## Marathi replies (मराठी)',
    '',
    'Under each heading:',
    '- Provide exactly 2 short reply options labeled 1) and 2).',
    '- Each option: 1–3 sentences, polite and professional workplace tone.',
    '- Hindi and Marathi must use Devanagari script.',
    '- Option 1: more formal / careful. Option 2: warmer / concise.',
    '- Do not invent commitments, amounts, or dates that are not in the message.',
    '- No preamble.',
    '',
    'Message / selection to reply to:',
    body,
  ].join('\n');
}

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
