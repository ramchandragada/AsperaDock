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

/** True when chosen basename matches the intended download name (case-insensitive). */
export function sameDownloadBasename(chosenPath, downloadName) {
  const chosenBase = sanitizeDownloadFilename(path.basename(String(chosenPath || '')));
  const intended = sanitizeDownloadFilename(
    downloadName || chosenBase,
  );
  return chosenBase.toLowerCase() === intended.toLowerCase();
}

/**
 * Natural save path for a download (no `(n)` suffix). Reserves the path so a
 * parallel download does not also claim it. Prefer this for Save As defaults
 * so re-downloads can ask Replace instead of pre-filling `(1)`.
 *
 * If another in-flight download already reserved the natural name, falls back
 * to {@link uniqueDownloadPath}.
 */
export function suggestDownloadPath(directory, filename) {
  const dir = String(directory || '').trim() || '.';
  const safeName = sanitizeDownloadFilename(filename);
  const candidate = path.join(dir, safeName);
  if (!reservedDownloadPaths.has(candidate)) {
    reservedDownloadPaths.add(candidate);
    return candidate;
  }
  return uniqueDownloadPath(dir, safeName);
}

/**
 * Pick a save path that does not already exist — used for "Keep both" and for
 * sticky-filename safety when the dialog points at a different existing file.
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
 * Move a completed download from an Electron claim path to the user's Save As
 * destination. `setSavePath` only sticks inside `will-download`, so Ask-every-
 * time saves to a temp claim first, then relocates here on `done`.
 *
 * Prefers rename (same volume); falls back to copy + unlink.
 * When `overwrite` is true, removes an existing final path first so Linux
 * `rename` can replace (rename fails if the destination exists).
 * @returns {string} Path that holds the file (final or claim on failure).
 */
export function moveDownloadClaim(claimPath, finalPath, { overwrite = false } = {}) {
  const claim = String(claimPath || '').trim();
  const final = String(finalPath || '').trim();
  if (!final) return claim;
  if (!claim || claim === final) return final;

  try {
    fs.mkdirSync(path.dirname(final), { recursive: true });
  } catch {
    // ignore — rename/copy will surface real errors
  }

  if (!fs.existsSync(claim)) {
    return fs.existsSync(final) ? final : claim;
  }

  if (overwrite && fs.existsSync(final)) {
    try {
      fs.unlinkSync(final);
    } catch {
      // rename/copy may still fail; surface via fallback return
    }
  }

  try {
    fs.renameSync(claim, final);
    return final;
  } catch {
    try {
      fs.copyFileSync(claim, final);
      try {
        fs.unlinkSync(claim);
      } catch {
        // ignore
      }
      return final;
    } catch {
      return claim;
    }
  }
}

/**
 * After the Save dialog returns a path:
 *
 * - Directory always comes from the user's dialog choice.
 * - If the chosen path is free, keep it (honors rename).
 * - If it exists and basename matches the download name:
 *   - `overwrite: true` → replace that file
 *   - otherwise → unique `(n)` ("Keep both")
 * - If it exists but basename differs (GTK sticky last-used name), never
 *   overwrite that other file — save under the real download filename (unique).
 *
 * Call {@link releaseDownloadPath} on the dialog suggestion first so the
 * suggested path is not treated as "taken" by its own reservation.
 */
export function resolveSavePathAfterPrompt(
  chosenPath,
  downloadName,
  { overwrite = false } = {},
) {
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

  const sameName = chosenBase.toLowerCase() === intended.toLowerCase();

  // Sticky GTK name pointing at a different existing file — never overwrite.
  if (!sameName) {
    return uniqueDownloadPath(dir, intended);
  }

  if (overwrite) {
    reservedDownloadPaths.add(chosen);
    return chosen;
  }

  // Same name exists and caller wants Keep both (or did not confirm replace).
  return uniqueDownloadPath(dir, intended);
}
