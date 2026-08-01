/**
 * Cross-account Forward helpers for WhatsApp / Arattai.
 * MVP: capture text/image/link → pick another Hub instance → stage for send.
 */

export const FORWARD_APP_IDS = Object.freeze(['whatsapp', 'arattai']);

export function isForwardAppId(appId) {
  return FORWARD_APP_IDS.includes(String(appId || ''));
}

/**
 * Whether the guest context menu should offer Forward.
 * @param {{
 *   appId?: string,
 *   hasSelection?: boolean,
 *   hasImage?: boolean,
 *   linkURL?: string,
 *   targetCount?: number,
 * }} opts
 */
export function canOfferForward(opts = {}) {
  if (!isForwardAppId(opts.appId)) return false;
  if (Number(opts.targetCount) <= 0) return false;
  const hasSelection = !!opts.hasSelection;
  const hasImage = !!opts.hasImage;
  const linkURL = String(opts.linkURL || '').trim();
  const hasLink = !!linkURL && !linkURL.startsWith('javascript:');
  return hasSelection || hasImage || hasLink;
}

/**
 * @param {{ text?: string, hasImage?: boolean, linkURL?: string, fileName?: string }} payload
 */
export function describeForwardPayload(payload = {}) {
  const text = String(payload.text || '').trim();
  const linkURL = String(payload.linkURL || '').trim();
  const fileName = String(payload.fileName || '').trim();
  const parts = [];
  if (payload.hasImage) parts.push('Image');
  if (fileName) parts.push(fileName);
  else if (linkURL) parts.push('Link');
  if (text) {
    const preview = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    parts.push(preview);
  }
  if (!parts.length) return 'Selected content';
  return parts.join(' · ');
}

/**
 * Build clipboard staging text (includes link when useful).
 * @param {{ text?: string, linkURL?: string, filePath?: string }} payload
 */
export function buildForwardClipboardText(payload = {}) {
  const text = String(payload.text || '').trim();
  const linkURL = String(payload.linkURL || '').trim();
  const filePath = String(payload.filePath || '').trim();
  const chunks = [];
  if (text) chunks.push(text);
  if (linkURL && !text.includes(linkURL)) chunks.push(linkURL);
  if (filePath && !chunks.some((c) => c.includes(filePath))) {
    chunks.push(`File saved: ${filePath}`);
  }
  return chunks.join('\n\n').trim();
}
