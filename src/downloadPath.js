import fs from 'node:fs';
import path from 'node:path';

/** In-flight save targets — avoids two parallel downloads picking the same path. */
const reservedDownloadPaths = new Set();

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

function isPathTaken(candidate) {
  return reservedDownloadPaths.has(candidate) || fs.existsSync(candidate);
}

/**
 * Pick a save path that does not already exist — avoids GTK "file already
 * exists, replace?" when the same document name was downloaded before.
 */
export function uniqueDownloadPath(directory, filename) {
  const dir = String(directory || '').trim() || '.';
  const safeName = sanitizeDownloadFilename(filename);
  let candidate = path.join(dir, safeName);
  if (!isPathTaken(candidate)) {
    reservedDownloadPaths.add(candidate);
    return candidate;
  }

  const ext = path.extname(safeName);
  const stem = ext ? safeName.slice(0, -ext.length) : safeName;
  for (let n = 1; n < 10000; n++) {
    const next = path.join(dir, `${stem} (${n})${ext}`);
    if (!isPathTaken(next)) {
      reservedDownloadPaths.add(next);
      return next;
    }
  }
  const fallback = path.join(dir, `${stem}-${Date.now()}${ext}`);
  reservedDownloadPaths.add(fallback);
  return fallback;
}

/** Drop a reservation when a suggestion is unused or a download ends. */
export function releaseDownloadPath(filePath) {
  const abs = String(filePath || '').trim();
  if (abs) reservedDownloadPaths.delete(abs);
}

/**
 * After the Save dialog returns a path, never clobber an existing file — and
 * never let GTK's sticky last-used name save Maharashtra into Karnataka.pdf.
 *
 * Call {@link releaseDownloadPath} on the dialog suggestion first so the
 * suggested unique path is not treated as "taken" by its own reservation.
 *
 * - Directory always comes from the user's dialog choice.
 * - If the chosen path is free, keep it (honors rename).
 * - If it already exists on disk, save under the real download filename (unique).
 */
export function resolveSavePathAfterPrompt(chosenPath, downloadName) {
  const chosen = String(chosenPath || '').trim();
  if (!chosen) {
    return uniqueDownloadPath('.', sanitizeDownloadFilename(downloadName));
  }
  const dir = path.dirname(chosen);
  const chosenBase = sanitizeDownloadFilename(path.basename(chosen));
  const intended = sanitizeDownloadFilename(downloadName || chosenBase);

  // Free path (not on disk): honor the dialog choice, including renames.
  if (!fs.existsSync(chosen)) {
    reservedDownloadPaths.add(chosen);
    return chosen;
  }

  // Existing file on disk: never overwrite. Prefer the download's real name so
  // a sticky "REG Karnataka.pdf" dialog does not eat a Maharashtra save.
  return uniqueDownloadPath(dir, intended);
}
