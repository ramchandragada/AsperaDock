import {
  languageInstruction,
  promptHeadingsBlock,
  resolveAiOutputLanguages,
  scriptInstructionsForLanguages,
  AI_DEFAULT_EXTRA_LANGUAGES,
} from './catalog.js';
import { formatPriorMessagesForPrompt } from '../guestChatContext.js';

function priorContextBlock(priorMessages) {
  const block = formatPriorMessagesForPrompt(priorMessages);
  return block ? `${block}\n` : '';
}

function outputLanguagesFrom(payload = {}) {
  if (Array.isArray(payload.languages) && payload.languages.length) {
    return payload.languages;
  }
  if (payload.extraLanguages !== undefined) {
    return resolveAiOutputLanguages(payload.extraLanguages);
  }
  return resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES);
}

export function buildSummarizePrompt({
  text,
  appName,
  priorMessages,
  languages,
  extraLanguages,
} = {}) {
  const body = String(text || '').trim().slice(0, 6_000);
  const prior = priorContextBlock(priorMessages);
  const langs = outputLanguagesFrom({ languages, extraLanguages });
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Summarize selection — be brief and fast.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    promptHeadingsBlock(langs, { replies: false }),
    'Under each heading: one short lead sentence (no label), then max 4 short bullets.',
    'Do not write TL;DR, Summary, or any other prefix before the lead sentence.',
    scriptInstructionsForLanguages(langs),
    'No invented facts. No preamble.',
    'If earlier conversation is provided, use it only to understand references,',
    'pronouns, and what the selected text is responding to — still center the summary on the selection.',
    '',
    prior,
    'Selected text:',
    body,
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

/** Summarize extracted PDF text (or note when user also attached the file). */
export function buildSummarizePdfTextPrompt({
  text,
  fileName,
  pagesRead,
  numPages,
  languages,
  extraLanguages,
} = {}) {
  const body = String(text || '').trim().slice(0, 12_000);
  const pages =
    pagesRead && numPages
      ? `Pages used: ${pagesRead} of ${numPages}.`
      : pagesRead
        ? `Pages used: ${pagesRead}.`
        : '';
  const langs = outputLanguagesFrom({ languages, extraLanguages });
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Summarize an uploaded PDF from its extracted text — be brief and fast.',
    `File name: ${fileName || 'document.pdf'}.`,
    pages,
    promptHeadingsBlock(langs, { replies: false }),
    'Under each heading: one short lead sentence (no label), then max 5 short bullets of the important points.',
    'Do not write TL;DR, Summary, or any other prefix before the lead sentence.',
    scriptInstructionsForLanguages(langs),
    'No invented facts. No preamble.',
    '',
    'Extracted PDF text:',
    body || '(no extractable text)',
  ].join('\n');
}

/** Vision / multimodal summarize for an image or PDF bytes. */
export function buildSummarizeAttachmentPrompt({
  kind,
  fileName,
  languages,
  extraLanguages,
} = {}) {
  const what =
    kind === 'pdf'
      ? 'an uploaded PDF document'
      : 'an uploaded image (photo, screenshot, or scan)';
  const langs = outputLanguagesFrom({ languages, extraLanguages });
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    `Skill: Summarize ${what} — be brief and fast.`,
    `File name: ${fileName || (kind === 'pdf' ? 'document.pdf' : 'image')}.`,
    promptHeadingsBlock(langs, { replies: false }),
    'Under each heading: one short lead sentence (no label), then max 5 short bullets.',
    'Do not write TL;DR, Summary, or any other prefix before the lead sentence.',
    'For images: describe what is visible and any readable text/numbers that matter for work.',
    'For PDFs: focus on purpose, key facts, amounts, dates, and action items.',
    scriptInstructionsForLanguages(langs),
    'No invented facts. No preamble.',
  ].join('\n');
}

export function buildSuggestReplyPrompt({
  text,
  appName,
  priorMessages,
  languages,
  extraLanguages,
} = {}) {
  const body = String(text || '').trim().slice(0, 6_000);
  const prior = priorContextBlock(priorMessages);
  const langs = outputLanguagesFrom({ languages, extraLanguages });
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Suggest short reply drafts — be brief and fast.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    promptHeadingsBlock(langs, { replies: true }),
    'Under each: exactly 2 options labeled 1) and 2), each 1–2 sentences.',
    '1) formal, 2) warmer/concise.',
    scriptInstructionsForLanguages(langs),
    'No invented facts. No preamble.',
    'Read earlier conversation first (like a human), then reply to the latest/selected message.',
    'Stay consistent with names, decisions, and open questions from the earlier thread.',
    '',
    prior,
    'Message / selection to reply to:',
    body,
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

/** Polish a message the employee typed in the send/compose box before sending. */
export function buildRefineDraftPrompt({
  text,
  appName,
  languages,
  extraLanguages,
} = {}) {
  const body = String(text || '').trim().slice(0, 6_000);
  const langs = outputLanguagesFrom({ languages, extraLanguages });
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Refine a message the employee is about to send.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    'Improve clarity, grammar, spelling, and professional tone.',
    promptHeadingsBlock(langs, { replies: false }),
    'Under each heading: ONLY the refined message text (same meaning/intent).',
    scriptInstructionsForLanguages(langs),
    'Do not invent facts or add commitments.',
    'Do not make it longer unless needed for clarity. No preamble outside the headings.',
    '',
    'Draft to refine:',
    body,
  ].join('\n');
}

export { parseRefinedDrafts, serializeRefinedDrafts } from './refineDraft.js';

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
