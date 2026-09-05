/** Parse / serialize multi-language Refine-with-Aspera-AI drafts. */

import {
  AI_DEFAULT_EXTRA_LANGUAGES,
  refineSectionsForLanguages,
  resolveAiOutputLanguages,
} from './catalog.js';

/** Default EN+HI+MR sections (backward compatible). */
export const REFINE_SECTIONS = refineSectionsForLanguages(
  resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES),
);

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionsFrom(languages) {
  if (Array.isArray(languages) && languages.length) {
    if (languages[0]?.id && (languages[0]?.heading || languages[0]?.name)) {
      return languages.map((s) => ({
        id: s.id,
        heading: s.heading || s.activeHeading || `## ${s.name || s.label || s.id}`,
        label: s.label || s.name || s.id,
        name: s.name || s.label || s.id,
      }));
    }
    return refineSectionsForLanguages(languages);
  }
  return REFINE_SECTIONS;
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
    if (new RegExp(`^##\\s*${escapeRegExp(name)}\\b`, 'i').test(t)) {
      return section.id;
    }
  }
  return null;
}

/**
 * @param {string} text
 * @param {object[]|string[]} [languages]
 * @returns {{ id: string, heading: string, label: string, text: string }[]}
 */
export function parseRefinedDrafts(text, languages) {
  const base = sectionsFrom(languages).map((s) => ({
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
    if (byId.en) {
      byId.en.text = raw.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    } else if (base[0]) {
      base[0].text = raw.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    }
    return base;
  }

  let current = null;
  const buckets = Object.fromEntries(base.map((s) => [s.id, []]));
  for (const line of raw.split('\n')) {
    const headingId = matchHeading(line, base);
    if (headingId) {
      current = headingId;
      continue;
    }
    if (!current) current = base[0]?.id || 'en';
    if (!buckets[current]) buckets[current] = [];
    buckets[current].push(line);
  }
  for (const id of Object.keys(buckets)) {
    if (!byId[id]) continue;
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
 * @param {object[]|string[]} [languages]
 */
export function serializeRefinedDrafts(sections, languages) {
  const catalog = sectionsFrom(languages);
  const list = Array.isArray(sections) && sections.length
    ? sections
    : catalog.map((s) => ({ ...s, text: '' }));
  return list
    .map((section) => {
      const meta =
        catalog.find((s) => s.id === section.id) ||
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
