/** Parse / serialize trilingual Refine-with-Aspera-AI drafts. */

export const REFINE_SECTIONS = [
  { id: 'en', heading: '## English', label: 'English' },
  { id: 'hi', heading: '## Hindi (हिन्दी)', label: 'Hindi (हिन्दी)' },
  { id: 'mr', heading: '## Marathi (मराठी)', label: 'Marathi (मराठी)' },
];

function matchHeading(line) {
  const t = String(line || '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const section of REFINE_SECTIONS) {
    if (t === section.heading || lower.startsWith(section.heading.toLowerCase())) {
      return section.id;
    }
  }
  if (/^##\s*english\b/i.test(t)) return 'en';
  if (/^##\s*hindi\b/i.test(t)) return 'hi';
  if (/^##\s*marathi\b/i.test(t)) return 'mr';
  return null;
}

/**
 * @param {string} text
 * @returns {{ id: string, heading: string, label: string, text: string }[]}
 */
export function parseRefinedDrafts(text) {
  const base = REFINE_SECTIONS.map((s) => ({
    id: s.id,
    heading: s.heading,
    label: s.label,
    text: '',
  }));
  const byId = Object.fromEntries(base.map((s) => [s.id, s]));
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return base;

  // Single-language model output with no headings → treat as English.
  if (!/^##\s+/m.test(raw)) {
    byId.en.text = raw.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    return base;
  }

  let current = null;
  const buckets = { en: [], hi: [], mr: [] };
  for (const line of raw.split('\n')) {
    const headingId = matchHeading(line);
    if (headingId) {
      current = headingId;
      continue;
    }
    if (!current) current = 'en';
    buckets[current].push(line);
  }
  for (const id of Object.keys(buckets)) {
    byId[id].text = buckets[id]
      .join('\n')
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .trim();
  }
  return base;
}

/**
 * @param {{ id?: string, heading?: string, label?: string, text?: string }[]} sections
 */
export function serializeRefinedDrafts(sections) {
  const list = Array.isArray(sections) && sections.length
    ? sections
    : REFINE_SECTIONS.map((s) => ({ ...s, text: '' }));
  return list
    .map((section) => {
      const meta =
        REFINE_SECTIONS.find((s) => s.id === section.id) ||
        {
          heading: section.heading || '## Draft',
          label: section.label || 'Draft',
        };
      const body = String(section?.text || '').trim();
      if (!body) return '';
      return `${meta.heading}\n${body}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
