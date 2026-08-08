import fs from 'node:fs';
import path from 'node:path';

/** Safe basename for a guest download (no directory components). */
export function sanitizeDownloadFilename(name) {
  let base = String(name || 'download')
    .split(/[/\\]/)
    .pop()
    .replace(/[\0\r\n]/g, '')
    .trim();
  if (!base || base === '.' || base === '..') base = 'download';
  return base.slice(0, 200);
}

/**
 * Pick a save path that does not already exist — avoids GTK "file already
 * exists, replace?" when the same document name was downloaded before.
 */
export function uniqueDownloadPath(directory, filename) {
  const dir = String(directory || '').trim() || '.';
  const safeName = sanitizeDownloadFilename(filename);
  let candidate = path.join(dir, safeName);
  if (!fs.existsSync(candidate)) return candidate;

  const ext = path.extname(safeName);
  const stem = ext ? safeName.slice(0, -ext.length) : safeName;
  for (let n = 1; n < 10000; n++) {
    const next = path.join(dir, `${stem} (${n})${ext}`);
    if (!fs.existsSync(next)) return next;
  }
  return path.join(dir, `${stem}-${Date.now()}${ext}`);
}
