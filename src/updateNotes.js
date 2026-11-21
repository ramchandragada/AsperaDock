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
  let cleaned = bullets.join('\n').trim();
  // Deploy sometimes stores the merge commit subject as notes — hide that.
  if (/^Merge pull request #\d+\b/i.test(cleaned) && !/\n/.test(cleaned)) {
    return '';
  }
  return cleaned;
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
 * Human-readable download progress for update dialogs / status.
 * @param {{ percent?: number, received?: number, total?: number, retrying?: boolean }|null} progress
 */
export function formatDownloadProgressLine(progress) {
  if (!progress || typeof progress !== 'object') {
    return 'Download in progress…';
  }
  if (progress.retrying) {
    const attempt = Number(progress.attempt) || 0;
    return attempt
      ? `Retrying download (attempt ${attempt})…`
      : 'Retrying download…';
  }
  const received = Math.max(0, Number(progress.received) || 0);
  const total = Math.max(0, Number(progress.total) || 0);
  const percent = Math.max(
    0,
    Math.min(100, Math.round(Number(progress.percent) || 0)),
  );
  const mb = (n) => `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (total > 0) {
    const pct = percent || Math.round((received / total) * 100);
    return `${pct}% · ${mb(received)} / ${mb(total)}`;
  }
  if (received > 0) return `${mb(received)} downloaded…`;
  return 'Download starting…';
}

/**
 * Build dialog detail text with a clear What's new section.
 * @param {{ version?: string, notes?: string, phase?: 'available'|'ready'|'mandatory'|'downloading', progress?: object }} opts
 */
export function formatUpdatePromptDetail(opts = {}) {
  const version = String(opts.version || '').trim();
  const bullets = formatNotesAsBullets(opts.notes || '');
  const phase = opts.phase || 'available';

  const parts = [];
  if (phase === 'downloading') {
    parts.push(formatDownloadProgressLine(opts.progress));
    parts.push('');
    parts.push(
      'The package is about 85 MB (Electron is bundled). On office internet this can take a few minutes.',
    );
    parts.push('Click OK and wait — Hub will prompt Install & restart when ready.');
    if (bullets) {
      parts.push('');
      parts.push(version ? `What's new in ${version}` : "What's new");
      parts.push(bullets);
    }
    return parts.join('\n');
  }

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
