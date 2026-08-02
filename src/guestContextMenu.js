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
