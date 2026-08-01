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
  if (
    /\b[\w.\- ()[\]]+\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)\b/i.test(nearby) ||
    /\bPDF\b/.test(nearby) ||
    /\b(Document|Attachment)\b/i.test(nearby)
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
 * Right-click on a clear photo must stay on the image path unless the user
 * explicitly chose "Forward document" or strong PDF/Office evidence exists.
 */
export function shouldForwardAsDocument(opts = {}) {
  if (opts.forceDocument) return true;
  if (opts.hasImage && !hasStrongDocumentEvidence(opts)) return false;
  return looksLikeDocument(opts);
}

/**
 * Whether the context menu should offer "Forward document with Aspera Hub".
 *
 * PDF chat tiles are usually exposed to Electron as images (Copy image…), so
 * when hasImage is true we still offer the explicit document path. Ordinary
 * photo Forward uses the default "Forward with Aspera Hub" item.
 */
export function shouldOfferDocumentForwardMenu(opts = {}) {
  const mediaType = String(opts.mediaType || '').toLowerCase();
  if (mediaType === 'file') return true;
  // PDF preview bubbles look like images — keep the document action available.
  if (opts.hasImage || opts.hasImageContents) return true;
  if (String(opts.linkURL || '').trim()) return true;
  return hasStrongDocumentEvidence({
    ...opts,
    hasImage: false,
  });
}

/** Extract a document-looking filename from free text (chat bubble labels). */
export function extractDocumentFileName(text) {
  const m = String(text || '').match(
    /([\w.\- ()[\]]+\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv))\b/i,
  );
  return m ? m[1].trim() : '';
}

/**
 * Whether the guest context menu should offer Forward.
 * @param {{
 *   appId?: string,
 *   hasSelection?: boolean,
 *   hasImage?: boolean,
 *   linkURL?: string,
 *   srcURL?: string,
 *   mediaType?: string,
 *   titleText?: string,
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
  const hasDocument = looksLikeDocument(opts);
  return hasSelection || hasImage || hasLink || hasDocument;
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
  const linkURL = String(payload.linkURL || '').trim();
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
