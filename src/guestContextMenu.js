/**
 * Guest-page context menu action order for Aspera Hub.
 *
 * Selected message text → Summarize, then Forward (Pin is for chat rows only).
 * Chat list / no selection → Pin, then Forward.
 *
 * @param {{
 *   hasSelection?: boolean,
 *   canSummarize?: boolean,
 *   canForward?: boolean,
 *   canPin?: boolean,
 * }} opts
 * @returns {('summarize'|'forward'|'pin')[]}
 */
export function guestContextMenuActionOrder({
  hasSelection = false,
  canSummarize = false,
  canForward = false,
  canPin = false,
} = {}) {
  const out = [];
  if (hasSelection) {
    if (canSummarize) out.push('summarize');
    if (canForward) out.push('forward');
    return out;
  }
  if (canPin) out.push('pin');
  if (canForward) out.push('forward');
  return out;
}
