/**
 * Detect dangerous Hub/AI text that must never linger in a chat send box.
 * WhatsApp keeps drafts per chat — a stray Ctrl+V becomes a permanent landmine.
 */

const POLLUTION_PATTERNS = [
  /Could not read this PDF/i,
  /Summarize PDF again/i,
  /Keep the PDF preview open/i,
  /Getting PDF from this chat/i,
  /Aspera Hub will not paste the preview/i,
  /Select text, an image, or a document to forward/i,
  /Press Ctrl\+V to paste, then Send/i,
  /Timed out waiting for a recipient/i,
  /Forward with Aspera Hub/i,
  /Aspera AI · Summarize PDF/i,
];

/**
 * @param {string} text
 * @param {{ stagedClipboard?: string, systemClipboard?: string, allowClipboardMatch?: boolean }} [opts]
 */
export function isHubComposePollution(
  text,
  { stagedClipboard = '', systemClipboard = '', allowClipboardMatch = true } = {},
) {
  const t = String(text || '');
  if (!t.trim()) return false;
  for (const re of POLLUTION_PATTERNS) {
    if (re.test(t)) return true;
  }
  const staged = String(stagedClipboard || '');
  if (staged && t === staged) return true;
  if (
    allowClipboardMatch &&
    systemClipboard &&
    t === String(systemClipboard) &&
    String(systemClipboard).trim().length >= 12
  ) {
    return true;
  }
  return false;
}

export { POLLUTION_PATTERNS };
