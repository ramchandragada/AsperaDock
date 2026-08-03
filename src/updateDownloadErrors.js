/**
 * Transient network / Chromium stream failures worth retrying.
 * "terminated" is common on large GitHub asset streams mid-body.
 */
export function isRetryableDownloadError(message) {
  return /Download failed|fetch|network|ECONN|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|EPIPE|ECONNRESET|404|408|425|429|502|503|504|terminated|abort|UND_ERR|socket|TLS|SSL|disconnected|closed|reset|truncated/i.test(
    String(message || ''),
  );
}

/** Friendlier copy for cryptic Chromium/undici stream errors. */
export function formatDownloadErrorDetail(message) {
  const raw = String(message || 'Download failed').trim();
  if (
    /^terminated$/i.test(raw) ||
    /body.?stream|readable.?stream.*terminat|truncated/i.test(raw)
  ) {
    return (
      'The download connection closed early (common on large updates).\n' +
      'Aspera Hub will retry automatically — if it still fails, use Check for updates again.'
    );
  }
  return raw;
}
