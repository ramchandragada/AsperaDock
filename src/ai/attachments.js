/**
 * Aspera AI file attachments (PDF / images) for the inbox popup.
 * Pure helpers where possible — unit-testable without Electron.
 */

import { randomUUID } from 'node:crypto';

export const AI_ATTACH_MAX_BYTES = 12 * 1024 * 1024; // 12 MB
export const AI_ATTACH_PDF_MAX_PAGES = 20;
export const AI_ATTACH_PDF_MAX_CHARS = 60_000;
export const AI_ATTACH_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

/**
 * @param {string} name
 * @param {string} mime
 * @returns {'pdf'|'image'|''}
 */
export function classifyAiAttachment(name = '', mime = '') {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  const n = String(name || '').toLowerCase();
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (IMAGE_MIME.has(m) || /\.(png|jpe?g|webp|gif)$/i.test(n)) return 'image';
  return '';
}

/**
 * Normalize image MIME for provider APIs.
 * @param {string} name
 * @param {string} mime
 */
export function normalizeImageMime(name = '', mime = '') {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  if (m === 'image/png' || m === 'image/webp' || m === 'image/gif') return m;
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

/**
 * @param {{ name?: string, mime?: string, byteLength?: number }} input
 * @returns {{ ok: true, kind: 'pdf'|'image', mime: string } | { ok: false, error: string }}
 */
export function validateAiAttachmentMeta(input = {}) {
  const name = String(input.name || 'file').trim() || 'file';
  const mimeIn = String(input.mime || '').trim();
  const kind = classifyAiAttachment(name, mimeIn);
  if (!kind) {
    return {
      ok: false,
      error: 'Only PDF or image files (PNG, JPEG, WebP, GIF) can be attached.',
    };
  }
  const size = Number(input.byteLength) || 0;
  if (size <= 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (kind === 'pdf' && size > AI_ATTACH_MAX_BYTES) {
    return {
      ok: false,
      error: `PDF is too large (max ${Math.floor(AI_ATTACH_MAX_BYTES / (1024 * 1024))} MB).`,
    };
  }
  if (kind === 'image' && size > AI_ATTACH_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image is too large (max ${Math.floor(AI_ATTACH_IMAGE_MAX_BYTES / (1024 * 1024))} MB).`,
    };
  }
  const mime =
    kind === 'pdf' ? 'application/pdf' : normalizeImageMime(name, mimeIn);
  return { ok: true, kind, mime, name: name.slice(0, 180) };
}

/**
 * Resolve pdf.js module + worker URLs.
 * Packaged builds load from `resources/pdfjs-runtime` (extraResource);
 * dev/tests resolve from node_modules.
 * @param {{ pdfjsDir?: string }} [opts]
 */
export async function resolvePdfjsUrls(opts = {}) {
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const dir = String(opts.pdfjsDir || '').trim();
  if (dir) {
    return {
      moduleUrl: pathToFileURL(path.join(dir, 'pdf.mjs')).href,
      workerSrc: pathToFileURL(path.join(dir, 'pdf.worker.mjs')).href,
    };
  }
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const modulePath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  return {
    moduleUrl: pathToFileURL(modulePath).href,
    workerSrc: pathToFileURL(workerPath).href,
  };
}

/**
 * Extract plain text from a PDF buffer (first N pages).
 * @param {Buffer|Uint8Array} buffer
 * @param {{ maxPages?: number, maxChars?: number, pdfjsDir?: string }} [opts]
 */
export async function extractPdfText(buffer, opts = {}) {
  const maxPages = Math.max(1, Number(opts.maxPages) || AI_ATTACH_PDF_MAX_PAGES);
  const maxChars = Math.max(1000, Number(opts.maxChars) || AI_ATTACH_PDF_MAX_CHARS);
  // pdfjs rejects Node Buffer — copy into a plain Uint8Array.
  const src =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer?.buffer || buffer || []);
  const data = new Uint8Array(src.byteLength);
  data.set(src);

  const { moduleUrl, workerSrc } = await resolvePdfjsUrls(opts);
  // Dynamic file URL — keeps pdfjs out of the Vite main bundle / asar.
  const pdfjs = await import(moduleUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  const numPages = Number(doc.numPages) || 0;
  const pageCount = Math.min(numPages, maxPages);
  const chunks = [];
  let total = 0;
  let pagesRead = 0;

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items || [])
      .map((item) => (item && item.str ? String(item.str) : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pagesRead = i;
    if (pageText) {
      chunks.push(pageText);
      total += pageText.length + 1;
    }
    if (total >= maxChars) break;
  }

  try {
    await doc.destroy?.();
  } catch {
    // ignore
  }

  const text = chunks.join('\n\n').trim().slice(0, maxChars);
  return {
    text,
    pagesRead,
    numPages,
    charCount: text.length,
  };
}

/** Enough extracted text to summarize without vision/PDF upload. */
export function pdfTextIsUsable(text) {
  const t = String(text || '').trim();
  // Scanned PDFs often yield almost nothing or garbage short strings.
  return t.length >= 80;
}

export function newAttachmentId() {
  return randomUUID();
}

/**
 * Prefer PNG for clipboard screenshots; fall back to JPEG when over the image cap.
 * @param {number} pngLength
 * @param {number} jpegLength
 * @param {number} [maxBytes]
 * @returns {'png'|'jpeg'|''}
 */
export function pickClipboardImageEncoding(
  pngLength,
  jpegLength,
  maxBytes = AI_ATTACH_IMAGE_MAX_BYTES,
) {
  const png = Number(pngLength) || 0;
  const jpg = Number(jpegLength) || 0;
  const max = Number(maxBytes) || AI_ATTACH_IMAGE_MAX_BYTES;
  if (png > 0 && png <= max) return 'png';
  if (jpg > 0 && jpg <= max) return 'jpeg';
  return '';
}

/** Stable display name for a clipboard screenshot attachment. */
export function clipboardScreenshotFileName(encoding = 'png', when = Date.now()) {
  const ext = encoding === 'jpeg' ? 'jpg' : 'png';
  const stamp = new Date(when).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `screenshot-${stamp}.${ext}`;
}
