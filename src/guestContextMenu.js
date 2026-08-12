/**
 * Guest-page context menu action order for Aspera Hub.
 *
 * Selected compose text → Polish, CRM lookup, then Forward (Pin is for chat rows only).
 * Selected message text (no polish) → CRM lookup, then Forward.
 * Chat list / no selection → Pin, then Forward.
 * Never offer Pin on images / media in an open chat — Pin is contacts only.
 *
 * @param {{
 *   hasSelection?: boolean,
 *   canSummarize?: boolean,
 *   canPolish?: boolean,
 *   canForward?: boolean,
 *   canPin?: boolean,
 *   canCrmLookup?: boolean,
 * }} opts
 * @returns {('summarize'|'polish'|'crm-lookup'|'forward'|'pin')[]}
 */
export function guestContextMenuActionOrder({
  hasSelection = false,
  canSummarize = false,
  canPolish = false,
  canForward = false,
  canPin = false,
  canCrmLookup = false,
} = {}) {
  const out = [];
  // Clipboard Summarize panel (when enabled) and compose Polish.
  if (canSummarize) out.push('summarize');
  if (canPolish) out.push('polish');
  if (hasSelection) {
    if (canCrmLookup) out.push('crm-lookup');
    if (canForward) out.push('forward');
    return out;
  }
  if (canPin) out.push('pin');
  if (canForward) out.push('forward');
  return out;
}

/**
 * Pin with Aspera Hub is for chat-list contacts only — not photos, PDF tiles,
 * or other media in an open thread (WhatsApp / Arattai).
 *
 * @param {{
 *   inboxApp?: boolean,
 *   hasSelection?: boolean,
 *   hasImage?: boolean,
 *   mediaType?: string,
 * }} opts
 */
export function canOfferHubPin({
  inboxApp = false,
  hasSelection = false,
  hasImage = false,
  mediaType = '',
} = {}) {
  if (!inboxApp) return false;
  if (hasSelection) return false;
  if (hasImage) return false;
  const media = String(mediaType || '').toLowerCase();
  if (media === 'image' || media.startsWith('image/')) return false;
  if (media === 'video' || media.startsWith('video/')) return false;
  return true;
}
