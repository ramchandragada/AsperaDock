/**
 * Guest-page context menu action order for Aspera Hub.
 *
 * Selected message text → Summarize, optional Summarize PDF, then Forward.
 * Chat list / no selection → Pin, optional Summarize PDF, then Forward.
 *
 * @param {{
 *   hasSelection?: boolean,
 *   canSummarize?: boolean,
 *   canSummarizePdf?: boolean,
 *   canForward?: boolean,
 *   canPin?: boolean,
 * }} opts
 * @returns {('summarize'|'summarize-pdf'|'forward'|'pin')[]}
 */
export function guestContextMenuActionOrder({
  hasSelection = false,
  canSummarize = false,
  canSummarizePdf = false,
  canForward = false,
  canPin = false,
} = {}) {
  const out = [];
  if (hasSelection) {
    if (canSummarize) out.push('summarize');
    if (canSummarizePdf) out.push('summarize-pdf');
    if (canForward) out.push('forward');
    return out;
  }
  if (canPin) out.push('pin');
  if (canSummarizePdf) out.push('summarize-pdf');
  if (canForward) out.push('forward');
  return out;
}

/**
 * Whether to offer "Summarize PDF with Aspera AI" on the guest right-click menu.
 *
 * PDF chat bubbles rarely put ".pdf" in Electron context-menu params (the
 * preview tile is an image / blob). Always offer on AI-allowed apps when AI
 * is enabled so WhatsApp / Arattai PDF cards are never missing the action.
 */
export function shouldOfferPdfSummarizeMenu({
  aiEnabled = true,
  aiAllowed = false,
} = {}) {
  return aiEnabled !== false && !!aiAllowed;
}
