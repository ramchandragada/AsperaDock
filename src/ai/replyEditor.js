/** Parse / serialize multi-language suggested-reply drafts for the AI result panel. */

import { formatPriorMessagesForPrompt } from '../guestChatContext.js';
import {
  AI_DEFAULT_EXTRA_LANGUAGES,
  getAiLanguage,
  replySectionsForLanguages,
  resolveAiOutputLanguages,
} from './catalog.js';

/** Default EN+HI+MR sections (backward compatible). */
export const REPLY_SECTIONS = replySectionsForLanguages(
  resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES),
);

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionsFrom(languages) {
  if (Array.isArray(languages) && languages.length) {
    if (languages[0]?.id && (languages[0]?.heading || languages[0]?.repliesHeading || languages[0]?.name)) {
      return languages.map((s) => ({
        id: s.id,
        heading:
          s.repliesHeading ||
          s.activeHeading ||
          s.heading ||
          `## ${s.name || s.label || s.id} replies`,
        label: s.label || s.name || s.id,
        name: s.name || s.label || s.id,
      }));
    }
    return replySectionsForLanguages(languages);
  }
  return REPLY_SECTIONS;
}

function matchHeading(line, sections) {
  const t = String(line || '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const section of sections) {
    if (t === section.heading || lower.startsWith(String(section.heading || '').toLowerCase())) {
      return section.id;
    }
  }
  for (const section of sections) {
    const name = section.name || String(section.label || '').split('(')[0].trim();
    if (!name) continue;
    if (new RegExp(`^##\\s*${escapeRegExp(name)}(?:\\s+replies)?\\b`, 'i').test(t)) {
      return section.id;
    }
  }
  return null;
}

function stripOptionPrefix(line) {
  return String(line || '')
    .replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '')
    .trim();
}

/**
 * @param {string} text
 * @param {object[]|string[]} [languages]
 * @returns {{ id: string, heading: string, label: string, items: { text: string }[] }[]}
 */
export function parseSuggestedReplies(text, languages) {
  const base = sectionsFrom(languages).map((s) => ({
    id: s.id,
    heading: s.heading,
    label: s.label,
    items: [],
  }));
  const byId = Object.fromEntries(base.map((s) => [s.id, s]));
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return base;

  let current = null;
  for (const line of raw.split('\n')) {
    const headingId = matchHeading(line, base);
    if (headingId) {
      current = headingId;
      continue;
    }
    if (!current) {
      current = base[0]?.id || 'en';
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    const item = stripOptionPrefix(trimmed);
    if (!item) continue;
    if (!byId[current]) continue;
    byId[current].items.push({ text: item });
  }

  for (const section of base) {
    if (!section.items.length) {
      section.items.push({ text: '' });
    }
  }
  return base;
}

/**
 * @param {{ id?: string, heading?: string, label?: string, items?: { text?: string }[] }[]} sections
 * @param {object[]|string[]} [languages]
 */
export function serializeSuggestedReplies(sections, languages) {
  const catalog = sectionsFrom(languages);
  const list = Array.isArray(sections) && sections.length
    ? sections
    : catalog.map((s) => ({ ...s, items: [] }));

  return list
    .map((section) => {
      const meta =
        catalog.find((s) => s.id === section.id) ||
        {
          heading: section.heading || '## Replies',
          label: section.label || 'Replies',
        };
      const items = (section.items || [])
        .map((item) => String(item?.text || '').trim())
        .filter(Boolean);
      if (!items.length) return '';
      const body = items.map((t, i) => `${i + 1}) ${t}`).join('\n');
      return `${meta.heading}\n${body}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function buildReviseReplyPrompt({
  replyText,
  language,
  selectionText,
  appName,
  priorMessages,
}) {
  const lang = getAiLanguage(language);
  const langLabel =
    lang.id === 'en' ? 'English' : `${lang.name} (${lang.native})`;
  const draft = String(replyText || '').trim().slice(0, 2_000);
  const context = String(selectionText || '').trim().slice(0, 4_000);
  const prior = formatPriorMessagesForPrompt(priorMessages);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Revise one reply draft — keep meaning, improve clarity and tone.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    `Language for the revised reply: ${langLabel}.`,
    'Rules:',
    '- Output ONLY the revised reply text (1–2 sentences).',
    `- Same language as requested. Use ${lang.script} when applicable.`,
    '- Do not invent facts. No preamble, labels, or quotation marks wrappers.',
    '- Use earlier conversation only for consistency with the thread.',
    '',
    prior ? `${prior}\n` : '',
    'Original draft to revise:',
    draft || '(empty — write a short polite reply from the message below)',
    '',
    'Message / selection being replied to:',
    context || '(none)',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}
