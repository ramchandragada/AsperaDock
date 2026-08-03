/**
 * Format release notes for update prompts so users know what to check after updating.
 * Pure helpers — no Electron.
 */

/** Strip install boilerplate from GitHub release bodies for dialog display. */
export function extractWhatsNewNotes(rawNotes = '') {
  let text = String(rawNotes || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) return '';

  // Drop trailing Install / packaging boilerplate from publish-update.mjs.
  text = text.replace(/\n##\s*Install[\s\S]*$/i, '').trim();
  text = text.replace(/\n_?Electron runtime is bundled[\s\S]*$/i, '').trim();

  // If the body starts with a "What's new" heading, keep the rest.
  text = text.replace(/^#+\s*what'?s\s*new\s*/i, '').trim();

  const lines = text
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line && !/^install$/i.test(line));

  // Prefer bullet lines; otherwise keep short prose paragraphs.
  const bullets = lines.filter((line) => line.length > 0);
  return bullets.join('\n').trim();
}

export function formatNotesAsBullets(notes, { maxItems = 8, maxChars = 700 } = {}) {
  const cleaned = extractWhatsNewNotes(notes);
  if (!cleaned) return '';

  let items = cleaned
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // Single long paragraph → keep as one item.
  if (items.length === 1 && !/[.!?]\s/.test(items[0])) {
    // already one line
  } else if (items.length === 1) {
    items = items[0]
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  items = items.slice(0, maxItems);
  let body = items.map((item) => `• ${item}`).join('\n');
  if (body.length > maxChars) {
    body = `${body.slice(0, maxChars - 1).trim()}…`;
  }
  return body;
}

/**
 * Build dialog detail text with a clear What's new section.
 * @param {{ version?: string, notes?: string, phase?: 'available'|'ready'|'mandatory' }} opts
 */
export function formatUpdatePromptDetail(opts = {}) {
  const version = String(opts.version || '').trim();
  const bullets = formatNotesAsBullets(opts.notes || '');
  const phase = opts.phase || 'available';

  const parts = [];
  if (bullets) {
    parts.push(version ? `What's new in ${version}` : "What's new");
    parts.push(bullets);
  } else {
    parts.push(
      version
        ? `Version ${version} includes the latest Aspera Hub improvements.`
        : 'This update includes the latest Aspera Hub improvements.',
    );
  }

  parts.push('');
  if (phase === 'mandatory') {
    parts.push('This is a required update and will install now.');
  } else if (phase === 'ready') {
    parts.push('Restart to apply — then try the new items above.');
  } else {
    parts.push('Download to get these improvements.');
  }
  return parts.join('\n');
}
