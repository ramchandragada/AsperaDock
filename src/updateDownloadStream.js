/**
 * Helpers for resilient Hub self-update downloads (resume + stall).
 * Pure — no Electron.
 */

/** Abort a stalled body read after this many ms without a chunk. */
export const DOWNLOAD_STALL_MS = 12_000;

/** More attempts — GitHub asset streams often drop mid-body from India. */
export const DOWNLOAD_STREAM_ATTEMPTS = 8;

/**
 * How many bytes of an existing .part file can be resumed.
 * Returns 0 when the part is missing, empty, or already complete/corrupt.
 */
export function partResumeOffset(existingBytes, expectedSize) {
  const n = Math.max(0, Math.floor(Number(existingBytes) || 0));
  const total = Math.max(0, Math.floor(Number(expectedSize) || 0));
  if (n <= 0) return 0;
  // Complete or oversize → restart clean (checksum will decide).
  if (total > 0 && n >= total) return 0;
  return n;
}

/** Headers for an HTTP Range resume (empty when starting from byte 0). */
export function rangeRequestHeaders(offset) {
  const start = Math.max(0, Math.floor(Number(offset) || 0));
  if (start <= 0) return {};
  return { Range: `bytes=${start}-` };
}

/**
 * Resolve the full artifact size from a fetch response + manifest size.
 */
export function resolveDownloadTotal({
  status,
  contentLength,
  contentRange,
  startAt = 0,
  expectedSize = 0,
} = {}) {
  const expected = Math.max(0, Number(expectedSize) || 0);
  const len = Math.max(0, Number(contentLength) || 0);
  const start = Math.max(0, Number(startAt) || 0);
  const rangeTotal = String(contentRange || '').match(/\/(\d+)\s*$/);
  if (rangeTotal) {
    const n = Number(rangeTotal[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (Number(status) === 206) return expected || start + len;
  return expected || len;
}

/** Drop the .part file only when the bytes themselves are untrustworthy. */
export function shouldDiscardPartialOnError(error) {
  const msg = String(error?.message || error || '');
  const code = error?.code;
  return (
    code === 'CHECKSUM_MISMATCH' ||
    /Checksum mismatch|missing a SHA-256/i.test(msg)
  );
}

export function isDownloadStallError(error) {
  const msg = String(error?.message || error || '');
  return error?.code === 'DOWNLOAD_STALL' || /Download stalled/i.test(msg);
}
