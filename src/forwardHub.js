/**
 * Cross-account Forward helpers for WhatsApp / Arattai.
 * MVP: capture text/image/document → pick another Hub instance → stage for send.
 */

export const FORWARD_APP_IDS = Object.freeze(['whatsapp', 'arattai']);

/** Common document extensions employees forward across chats. */
export const FORWARD_DOCUMENT_EXTS = Object.freeze([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'rtf',
  'odt',
  'ods',
  'odp',
  'zip',
  'rar',
  '7z',
  'json',
  'xml',
]);

export function isForwardAppId(appId) {
  return FORWARD_APP_IDS.includes(String(appId || ''));
}

export function extensionOf(value) {
  const raw = String(value || '').split('?')[0].split('#')[0];
  const base = raw.includes('/') ? raw.split('/').pop() : raw;
  const m = String(base || '').match(/\.([a-z0-9]{1,8})$/i);
  return m ? m[1].toLowerCase() : '';
}

export function isDocumentExtension(ext) {
  return FORWARD_DOCUMENT_EXTS.includes(String(ext || '').toLowerCase());
}

/**
 * Strong evidence the target is a real document (PDF/Office), not a photo.
 * Soft UI chrome like a "Download" button is NOT enough — photos have that too.
 */
export function hasStrongDocumentEvidence(opts = {}) {
  const url = String(opts.url || opts.linkURL || opts.srcURL || '').trim();
  const name = String(opts.fileName || opts.titleText || opts.altText || opts.text || '').trim();
  const nearby = String(opts.nearbyText || '').trim();
  const mime = String(opts.mimeType || opts.mediaType || '').trim().toLowerCase();

  if (mime.includes('pdf') || mime.includes('msword') || mime.includes('officedocument')) {
    return true;
  }
  // Electron mediaType "file" is only strong with a document-ish name/url/nearby.
  if (mime === 'file' || mime.includes('document')) {
    if (
      isDocumentExtension(extensionOf(url)) ||
      isDocumentExtension(extensionOf(name)) ||
      /\b(pdf|document|attachment|\.docx?|\.xlsx?|\.pptx?)\b/i.test(name) ||
      /\b[\w.\- ()[\]]+\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)\b/i.test(nearby) ||
      /\bPDF\b/.test(nearby) ||
      opts.hasDocIcon ||
      opts.docLikely
    ) {
      return true;
    }
  }
  if (opts.hasDocIcon) return true;
  if (isDocumentExtension(extensionOf(url)) || isDocumentExtension(extensionOf(name))) {
    return true;
  }
  if (/\b(pdf|document|attachment|\.docx?|\.xlsx?|\.pptx?)\b/i.test(name)) {
    return true;
  }
  if (/\/pdf\b|\.pdf\b|application%2Fpdf|application\/pdf/i.test(url)) {
    return true;
  }
  // Chat bubbles often show "Something.pdf" / "PDF · 1.2 MB" next to a preview tile.
  // Arattai also uses "2 pages · 148 KB" under a truncated name (no .pdf visible).
  if (
    /\b[\w.\- ()[\]]+\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)\b/i.test(nearby) ||
    /\bPDF\b/.test(nearby) ||
    /\b(Document|Attachment)\b/i.test(nearby) ||
    /\b\d+\s*pages?\s*[·•|\-]\s*[\d.,]+\s*(KB|MB|GB)\b/i.test(nearby)
  ) {
    return true;
  }
  // docLikely from DOM inspect — only when not clearly an image click.
  if (opts.docLikely && !opts.hasImage) return true;
  return false;
}

/**
 * True when a URL/name/mime/nearby chat bubble looks like a document rather
 * than a photo. PDF chat previews often expose only an image thumbnail —
 * callers must prefer the real file and never paste that preview as a photo.
 *
 * Important: a Download button alone is NOT document evidence (photos have it).
 */
export function looksLikeDocument(opts = {}) {
  if (hasStrongDocumentEvidence(opts)) return true;
  // Legacy soft signal kept for non-image contexts (e.g. menu offer heuristics).
  // Callers forwarding an image must pass hasImage / use hasStrongDocumentEvidence.
  if (!opts.hasImage && (opts.hasDownload || opts.docLikely)) return true;
  const mime = String(opts.mimeType || opts.mediaType || '').trim().toLowerCase();
  if (!opts.hasImage && (mime === 'file' || mime.includes('document'))) return true;
  return false;
}

/**
 * Decide whether Forward should take the document capture path.
 * One menu action ("Forward with Aspera Hub") auto-detects: PDF/Office
 * bubbles use the document path; clear photos stay on the image path.
 * `forceDocument` remains for tests / internal callers only.
 */
export function shouldForwardAsDocument(opts = {}) {
  if (opts.forceDocument) return true;
  if (opts.hasImage && !hasStrongDocumentEvidence(opts)) return false;
  return looksLikeDocument(opts);
}

/**
 * Context menu: never offer a second "Forward document…" entry.
 * Hub decides image vs document behind one "Forward with Aspera Hub" action.
 */
export function shouldOfferDocumentForwardMenu(_opts = {}) {
  return false;
}

/** Normalized content kind for one shared Forward UX. */
export function forwardContentKind(payload = {}) {
  if (payload.isDocument) return 'document';
  if (payload.hasImage) return 'image';
  return 'text';
}

/** One-line steps shown in the account picker (same for every content type). */
export function forwardPickerSteps() {
  return '1) Choose account → 2) Search or open recipient → 3) Hub places it → 4) You Send';
}

export function forwardPickerHint(kind = 'text') {
  if (kind === 'document') {
    return 'Same flow as text and images. After you open the recipient, Hub attaches the document — then Send.';
  }
  if (kind === 'image') {
    return 'Same flow as text and documents. After you open the recipient, Hub pastes the image — then Send.';
  }
  return 'Same flow as images and documents. After you open the recipient, Hub pastes the text — then Send.';
}

export function forwardWaitMessage(kind, targetName, fileName = '') {
  const account = targetName || 'the account';
  const how =
    'search or open the recipient (or click the message box if that chat is already open)';
  if (kind === 'document') {
    const name = fileName ? `“${fileName}”` : 'the document';
    return `In ${account}, ${how} — then Hub will place ${name}.`;
  }
  if (kind === 'image') {
    return `In ${account}, ${how} — then Hub will place the image.`;
  }
  return `In ${account}, ${how} — then Hub will place the text.`;
}

export function forwardReadyMessage(kind, targetName, { ok = true, fileName = '' } = {}) {
  const account = targetName || 'the account';
  // Same cue for every direction / content type when Hub placed content.
  if (ok) {
    if (kind === 'document') {
      const name = fileName ? `“${fileName}”` : 'Document';
      return `${name} ready in ${account}. Review and Send.`;
    }
    if (kind === 'image') {
      return `Image ready in ${account}. Review and Send.`;
    }
    return `Text ready in ${account}. Review and Send.`;
  }
  // Fallback only when auto-place failed — still one consistent instruction.
  if (kind === 'document') {
    const name = fileName ? `“${fileName}”` : 'the document';
    return `Recipient ready in ${account}. Press Ctrl+V (or Attach → Document) for ${name}, then Send.`;
  }
  return `Recipient ready in ${account}. Press Ctrl+V to paste, then Send.`;
}

export function forwardTimeoutMessage(kind, targetName, fileName = '') {
  const account = targetName || 'the account';
  if (kind === 'document') {
    const name = fileName ? `“${fileName}”` : 'the document';
    return `Timed out waiting for a recipient in ${account}. Open the chat, then Attach → Document for ${name}.`;
  }
  return `Timed out waiting for a recipient in ${account}. Open the chat and press Ctrl+V to paste.`;
}

/** Extract a document-looking filename from free text (chat bubble labels). */
export function extractDocumentFileName(text) {
  const raw = String(text || '');
  const m = raw.match(
    /([\w.\- ()[\]]+\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv))\b/i,
  );
  if (m) return m[1].trim();
  // Arattai truncates long names: "Police_verification_report_52... PDF"
  const truncated = raw.match(
    /([A-Za-z0-9][\w.\- ()[\]]{2,80})\.\.\.(?:(?!\n).{0,80})?\bPDF\b/i,
  );
  if (truncated) return `${truncated[1].trim()}.pdf`;
  return '';
}

/** Build Arattai/Cliq UDS download URL (full file, not thumbnail). */
export function buildArattaiDownloadUrl(fileId, chatId, { thumbnail = false } = {}) {
  const id = String(fileId || '').trim();
  const chat = String(chatId || '').trim();
  if (!id || !chat) return '';
  const cliMsg = { chat_id: chat };
  if (thumbnail) cliMsg.thumbnail = true;
  return (
    `https://files.arattai.in/webdownload` +
    `?x-service=CLIQ` +
    `&event-id=${encodeURIComponent(id)}` +
    `&x-cli-msg=${encodeURIComponent(JSON.stringify(cliMsg))}`
  );
}

/**
 * Parse Arattai media URLs (webdownload / attachments) for file + chat ids.
 * Thumbnail URLs still expose event-id — callers should rebuild without thumbnail.
 */
export function parseArattaiMediaUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/(^|\.)arattai\.in$/i.test(u.hostname)) return null;
    let fileId = String(u.searchParams.get('event-id') || '').trim();
    let chatId = String(u.searchParams.get('chat_id') || '').trim();
    let thumbnail = false;
    const cliRaw = u.searchParams.get('x-cli-msg');
    if (cliRaw) {
      try {
        const cli = JSON.parse(cliRaw);
        chatId = String(cli.chat_id || cli.chatId || chatId || '').trim();
        thumbnail = !!cli.thumbnail;
      } catch {
        // ignore malformed cli msg
      }
    }
    if (!fileId) {
      const m = u.pathname.match(/\/v1\/attachments\/([^/?#]+)/i);
      if (m) fileId = decodeURIComponent(m[1]);
    }
    if (!fileId) return null;
    return { fileId, chatId, thumbnail, href: u.href };
  } catch {
    return null;
  }
}

/** Prefer a full-file Arattai download URL when any media URL/id is known. */
export function arattaiFullFileUrlFromAny(url, chatIdFallback = '') {
  const parsed = parseArattaiMediaUrl(url);
  if (!parsed?.fileId) return '';
  const chat = parsed.chatId || String(chatIdFallback || '').trim();
  if (!chat) {
    if (/\/v1\/attachments\//i.test(parsed.href) && !parsed.thumbnail) return parsed.href;
    return '';
  }
  return buildArattaiDownloadUrl(parsed.fileId, chat, { thumbnail: false });
}

/**
 * Whether the guest context menu should offer Forward.
 * On WhatsApp/Arattai with a target account, always offer the single Forward
 * action — Hub inspects the bubble and decides text / image / document.
 * Electron hit-tests often miss WA media (no hasImageContents), which used to
 * hide Forward entirely while WhatsApp's own menu still appeared.
 * @param {{
 *   appId?: string,
 *   hasSelection?: boolean,
 *   hasImage?: boolean,
 *   linkURL?: string,
 *   srcURL?: string,
 *   mediaType?: string,
 *   titleText?: string,
 *   targetCount?: number,
 *   alwaysOnMessaging?: boolean,
 * }} opts
 */
export function canOfferForward(opts = {}) {
  if (!isForwardAppId(opts.appId)) return false;
  if (Number(opts.targetCount) <= 0) return false;
  if (opts.alwaysOnMessaging !== false) return true;
  const hasSelection = !!opts.hasSelection;
  const hasImage = !!opts.hasImage;
  const linkURL = String(opts.linkURL || '').trim();
  const hasLink = !!linkURL && !linkURL.startsWith('javascript:');
  const hasDocument = looksLikeDocument(opts);
  return hasSelection || hasImage || hasLink || hasDocument;
}

/**
 * Links that must never be pasted alongside forwarded text.
 * Arattai mention/profile tiles and PDF thumbnails expose webdownload URLs
 * that look like "the message link" but are junk in WhatsApp.
 */
export function isJunkForwardLink(url) {
  const u = String(url || '').trim();
  if (!u || u.startsWith('javascript:')) return true;
  if (/^blob:/i.test(u) || /^data:/i.test(u)) return true;
  if (/files\.arattai\.in\/webdownload/i.test(u)) return true;
  if (/\/v1\/attachments\//i.test(u)) return true;
  if (/user_profile_picture|fallback_dp|thumbnail=true|"thumbnail":true/i.test(u)) {
    return true;
  }
  return false;
}

/** Link safe to include in a text forward clipboard payload. */
export function sanitizeForwardLinkURL(url) {
  const u = String(url || '').trim();
  if (!u || isJunkForwardLink(u)) return '';
  return u;
}

/**
 * @param {{ text?: string, hasImage?: boolean, linkURL?: string, fileName?: string, isDocument?: boolean }} payload
 */
export function describeForwardPayload(payload = {}) {
  const text = String(payload.text || '').trim();
  const linkURL = String(payload.linkURL || '').trim();
  const fileName = String(payload.fileName || '').trim();
  const parts = [];
  if (payload.isDocument || looksLikeDocument({ fileName, linkURL, text })) {
    parts.push(fileName ? `Document · ${fileName}` : 'Document');
  } else if (payload.hasImage) {
    parts.push('Image');
  } else if (fileName) {
    parts.push(fileName);
  } else if (linkURL) {
    parts.push('Link');
  }
  if (text && !fileName) {
    const preview = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    parts.push(preview);
  }
  if (!parts.length) return 'Selected content';
  return parts.join(' · ');
}

/**
 * Build clipboard staging text (includes link when useful).
 * Prefer not to dump local file paths into chat text when a real file is staged.
 * @param {{ text?: string, linkURL?: string, filePath?: string, isDocument?: boolean }} payload
 */
export function buildForwardClipboardText(payload = {}) {
  const text = String(payload.text || '').trim();
  const linkURL = sanitizeForwardLinkURL(payload.linkURL);
  const filePath = String(payload.filePath || '').trim();
  const chunks = [];
  if (text) chunks.push(text);
  if (linkURL && !text.includes(linkURL) && !payload.isDocument) {
    chunks.push(linkURL);
  }
  // Documents are staged as files — avoid pasting "File saved: …" into the chat.
  if (filePath && !payload.isDocument && !chunks.some((c) => c.includes(filePath))) {
    chunks.push(`File saved: ${filePath}`);
  }
  return chunks.join('\n\n').trim();
}

/**
 * Match a recently downloaded guest file to a forward candidate name.
 * Used when the user already tapped Download in chat before Forward.
 */
export function matchRecentDownload(recent = [], candidateName = '', nearbyText = '') {
  const list = Array.isArray(recent) ? recent : [];
  const want = String(candidateName || '').trim().toLowerCase();
  const nearby = String(nearbyText || '').toLowerCase();
  const now = Date.now();
  const fresh = list.filter((row) => row && row.path && now - Number(row.at || 0) < 15 * 60_000);
  if (!fresh.length) return '';
  const score = (row) => {
    const name = String(row.name || pathBasename(row.path)).toLowerCase();
    let s = 0;
    if (want && name === want) s += 100;
    if (want && want.length >= 6 && name.includes(want.replace(/\.pdf$/i, ''))) s += 60;
    if (want && name.endsWith('.pdf') && nearby.includes(name.replace(/\.pdf$/i, ''))) s += 40;
    if (/\.pdf$/i.test(name) && /\bpdf\b/i.test(nearby)) s += 10;
    if (isDocumentExtension(extensionOf(name))) s += 5;
    return s;
  };
  let best = null;
  let bestScore = 0;
  for (const row of fresh) {
    const s = score(row);
    if (s > bestScore) {
      best = row;
      bestScore = s;
    }
  }
  if (!best || bestScore < 10) return '';
  return String(best.path || '');
}

function pathBasename(filePath) {
  const s = String(filePath || '');
  const parts = s.split(/[/\\]/);
  return parts[parts.length - 1] || s;
}

export function sanitizeForwardFilename(name, fallbackExt = 'bin') {
  let base = String(name || '')
    .split(/[/\\]/)
    .pop()
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .replace(/_+/g, '_')
    .trim();
  if (!base || base === '.' || base === '..') {
    base = `document.${fallbackExt}`;
  }
  if (!extensionOf(base) && fallbackExt) {
    base = `${base}.${fallbackExt}`;
  }
  return base.slice(0, 180);
}

export function mimeForFilename(name) {
  const ext = extensionOf(name);
  const map = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    json: 'application/json',
    xml: 'application/xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

/** True when an <input accept> is photos/videos only (unsafe for PDF inject). */
export function isImageOnlyAccept(accept) {
  const a = String(accept || '').toLowerCase().trim();
  if (!a) return false;
  const hasDoc =
    /pdf|msword|officedocument|opendocument|\.docx?|\.xlsx?|\.pptx?|\.txt|\.csv|\.zip|text\/plain|application\//i.test(
      a,
    );
  if (hasDoc) return false;
  return (
    /image\//.test(a) ||
    /image\*/.test(a) ||
    /\.(png|jpe?g|gif|webp|bmp|heic|svg)/.test(a) ||
    (/video\//.test(a) && !hasDoc)
  );
}

/** True when an <input accept> can take a document/PDF. */
export function isDocumentAccept(accept) {
  const a = String(accept || '').toLowerCase().trim();
  if (isImageOnlyAccept(a)) return false;
  if (!a) return true; // unrestricted — OK for documents
  // Bare "*" means all files. Do NOT treat "image/*" as unrestricted (handled above).
  if (a === '*' || a === '*/*' || a.includes('*/*')) return true;
  return /pdf|msword|officedocument|opendocument|\.docx?|\.xlsx?|\.pptx?|\.txt|\.csv|\.zip|text\/plain|application\//i.test(
    a,
  );
}

/**
 * Sniff whether a downloaded forward artifact is a real document (not a PNG thumb).
 * @param {Uint8Array|Buffer} header first bytes of the file
 * @param {string} fileName
 */
export function classifyForwardFileBytes(header, fileName = '') {
  const bytes = header instanceof Uint8Array ? header : new Uint8Array(header || []);
  const ext = extensionOf(fileName);
  const asLatin = String.fromCharCode(...bytes.slice(0, Math.min(8, bytes.length)));
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ok: false, kind: 'image', error: 'Got a PNG preview instead of the document.' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: false, kind: 'image', error: 'Got a JPEG preview instead of the document.' };
  }
  if (bytes.length >= 5 && asLatin.startsWith('%PDF-')) {
    return { ok: true, kind: 'pdf' };
  }
  if (ext === 'pdf') {
    return { ok: false, kind: 'invalid', error: 'File is not a valid PDF.' };
  }
  // ZIP-based Office formats start with PK
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return { ok: true, kind: 'zip-office' };
  }
  if (isDocumentExtension(ext)) {
    return { ok: true, kind: 'document' };
  }
  return { ok: false, kind: 'unknown', error: 'Unsupported or unrecognized file type.' };
}

/**
 * CSS selectors used to find / focus an open chat compose box.
 * Detection uses {@link guestComposeDetectJs} so WhatsApp's search box is not
 * mistaken for a chat composer.
 */
export const GUEST_COMPOSE_SELECTORS = Object.freeze([
  '[data-testid="conversation-compose-box-input"]',
  'footer [contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][data-tab]',
  '[role="textbox"][contenteditable="true"]',
  'div[contenteditable="true"]',
  'textarea',
  '[role="textbox"]',
  '[placeholder*="Type your message" i]',
  '[data-placeholder*="Type your message" i]',
  '[placeholder*="message here" i]',
  '[data-placeholder*="message here" i]',
  '[aria-placeholder*="Type your message" i]',
]);

/** Comma-joined selector for focus / queryAll. */
export function guestComposeSelector() {
  return GUEST_COMPOSE_SELECTORS.join(', ');
}

/**
 * JS expression (IIFE body) that returns true when a real chat composer is open.
 * Covers Arattai ("Type your message here…") without matching list search boxes.
 */
export function guestComposeDetectJs() {
  return `(() => {
    if (document.querySelector('[data-testid="conversation-compose-box-input"]')) return true;
    if (document.querySelector('footer [contenteditable="true"]')) return true;
    if (document.querySelector('[contenteditable="true"][data-tab]')) return true;
    const nodes = document.querySelectorAll(
      '[contenteditable="true"], textarea, [role="textbox"], [placeholder], [data-placeholder], [aria-placeholder]',
    );
    const vh = window.innerHeight || 800;
    for (const n of nodes) {
      const ph = String(
        n.getAttribute('placeholder')
          || n.getAttribute('data-placeholder')
          || n.getAttribute('aria-placeholder')
          || n.getAttribute('aria-label')
          || '',
      ).toLowerCase();
      if (/type your message|message here|type a message/.test(ph)) return true;
      try {
        const r = n.getBoundingClientRect();
        const style = window.getComputedStyle(n);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        // Bottom composer: wide editable near the bottom of the viewport.
        if (r.width >= 120 && r.height >= 24 && r.top > vh * 0.55 && r.bottom <= vh + 4) {
          // Skip obvious search fields in the chat list column.
          if (/search/i.test(ph)) continue;
          if (n.closest && n.closest('[data-testid="chat-list"], [class*="chat-list" i], [class*="ChatList"]')) {
            continue;
          }
          return true;
        }
      } catch (e) {}
    }
    return false;
  })()`;
}

/**
 * Chat-list / search-result click targets for recipient picking.
 * Includes Arattai / Zoho-style list rows, not only WhatsApp testids.
 */
export const FORWARD_RECIPIENT_CLICK_SELECTORS = Object.freeze([
  '[data-testid="cell-frame-container"]',
  '[data-testid="list-item"]',
  '[data-testid="chat"]',
  '[data-testid="chat-list"] [role="listitem"]',
  '[data-testid="contact"]',
  '[role="listitem"]',
  'div[role="row"]',
  'a[href*="chat"]',
  'a[href*="send"]',
  '[class*="ChatList"] [tabindex]',
  '[class*="chat-list"] [tabindex]',
  '[class*="conversation"] [tabindex]',
  '[class*="chatlist" i] [tabindex]',
  '[class*="ChatListItem" i]',
  '[class*="chat-list-item" i]',
  '[class*="Roster" i] [tabindex]',
  '[class*="roster" i] [tabindex]',
  '[class*="lhs" i] [tabindex]',
  '[class*="chats-list" i] > *',
  '[class*="ChatsList" i] > *',
]);

/**
 * Clicking these affirms "use the already-open chat" (compose / conversation panel).
 * Needed when Arattai already has Pocket (or any chat) open — title does not change.
 */
export const FORWARD_RECIPIENT_CONFIRM_SELECTORS = Object.freeze([
  '[data-testid="conversation-compose-box-input"]',
  '[data-testid="conversation-panel-wrapper"]',
  '[data-testid="conversation-panel-body"]',
  '#main',
  'footer',
  'textarea',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[placeholder*="Type your message" i]',
  '[data-placeholder*="Type your message" i]',
  '[placeholder*="message here" i]',
  '[data-placeholder*="message here" i]',
  '[class*="composer" i]',
  '[class*="Composer"]',
  '[class*="message-input" i]',
  '[class*="MessageInput" i]',
  '[class*="chat-content" i]',
  '[class*="ChatContent" i]',
  '[class*="conversation-panel" i]',
]);

export function forwardRecipientClickSelector() {
  return FORWARD_RECIPIENT_CLICK_SELECTORS.join(', ');
}

export function forwardRecipientConfirmSelector() {
  return FORWARD_RECIPIENT_CONFIRM_SELECTORS.join(', ');
}
