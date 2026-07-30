import { languageInstruction } from './catalog.js';

export function buildSummarizePrompt({ text, appName, language }) {
  const body = String(text || '').trim().slice(0, 12_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Summarize selection.',
    languageInstruction(language),
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Summarize the selected text for a busy employee.',
    'Rules:',
    '- 4–8 short bullets max, plus one-line TL;DR at the top.',
    '- Keep people names, amounts, dates, and action items.',
    '- Do not invent facts that are not in the text.',
    '- No preamble like "Here is a summary".',
    '',
    'Selected text:',
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
