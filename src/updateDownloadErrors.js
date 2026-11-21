/**
 * Transient network / Chromium stream failures worth retrying.
 * "terminated" is common on large GitHub asset streams mid-body.
 */
export function isRetryableDownloadError(message) {
  return /Download failed|fetch|network|ECONN|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|EPIPE|ECONNRESET|404|408|425|429|502|503|504|terminated|abort|UND_ERR|socket|TLS|SSL|disconnected|closed|reset|truncated|stalled|DOWNLOAD_STALL/i.test(
    String(message || ''),
  );
}

/** Friendlier copy for cryptic Chromium/undici stream errors. */
export function formatDownloadErrorDetail(message) {
  const raw = String(message || 'Download failed').trim();
  if (/Download stalled|DOWNLOAD_STALL/i.test(raw)) {
    return (
      'The download stalled (no data for several seconds).\n' +
      'Aspera Hub resumes from where it left off — leave it open, or download the .deb in Chrome and install manually.'
    );
  }
  if (
    /^terminated$/i.test(raw) ||
    /body.?stream|readable.?stream.*terminat|truncated/i.test(raw)
  ) {
    return (
      'The download connection closed early (common on large GitHub updates).\n' +
      'Aspera Hub resumes automatically — if it still fails, download the .deb in Chrome and install with apt.'
    );
  }
  return raw;
}
