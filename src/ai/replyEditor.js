/** Parse / serialize trilingual suggested-reply drafts for the AI result panel. */

export const REPLY_SECTIONS = [
  {
    id: 'en',
    heading: '## English replies',
    label: 'English',
  },
  {
    id: 'hi',
    heading: '## Hindi replies (हिन्दी)',
    label: 'Hindi (हिन्दी)',
  },
  {
    id: 'mr',
    heading: '## Marathi replies (मराठी)',
    label: 'Marathi (मराठी)',
  },
];

function matchHeading(line) {
  const t = String(line || '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const section of REPLY_SECTIONS) {
    if (t === section.heading || lower.startsWith(section.heading.toLowerCase())) {
      return section.id;
    }
  }
  if (/^##\s*english/i.test(t)) return 'en';
  if (/^##\s*hindi/i.test(t)) return 'hi';
  if (/^##\s*marathi/i.test(t)) return 'mr';
  return null;
}

function stripOptionPrefix(line) {
  return String(line || '')
    .replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '')
    .trim();
}

/**
 * @param {string} text
 * @returns {{ id: string, heading: string, label: string, items: { text: string }[] }[]}
 */
export function parseSuggestedReplies(text) {
  const base = REPLY_SECTIONS.map((s) => ({
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
    const headingId = matchHeading(line);
    if (headingId) {
      current = headingId;
      continue;
    }
    if (!current) {
      // Loose text before any heading → English
      current = 'en';
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    const item = stripOptionPrefix(trimmed);
    if (!item) continue;
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
 */
export function serializeSuggestedReplies(sections) {
  const list = Array.isArray(sections) && sections.length
    ? sections
    : REPLY_SECTIONS.map((s) => ({ ...s, items: [] }));

  return list
    .map((section) => {
      const meta =
        REPLY_SECTIONS.find((s) => s.id === section.id) ||
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
}) {
  const langLabel =
    REPLY_SECTIONS.find((s) => s.id === language)?.label ||
    String(language || 'English');
  const draft = String(replyText || '').trim().slice(0, 2_000);
  const context = String(selectionText || '').trim().slice(0, 4_000);
  return [
    'You are Aspera AI inside Aspera Hub, a company workspace for employees.',
    'Skill: Revise one reply draft — keep meaning, improve clarity and tone.',
    `App context: ${appName || 'Messaging / Mail'}.`,
    `Language for the revised reply: ${langLabel}.`,
    'Rules:',
    '- Output ONLY the revised reply text (1–2 sentences).',
    '- Same language as requested. Hindi/Marathi in Devanagari when applicable.',
    '- Do not invent facts. No preamble, labels, or quotation marks wrappers.',
    '',
    'Original draft to revise:',
    draft || '(empty — write a short polite reply from the message below)',
    '',
    'Message / selection being replied to:',
    context || '(none)',
  ].join('\n');
}
