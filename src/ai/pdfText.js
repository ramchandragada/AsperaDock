/**
 * Extract plain text from a PDF buffer for Aspera AI summarize.
 * Uses pdf.js legacy build (Node / Electron main, no canvas/worker).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Soft caps — keep prompts inside typical free-tier context windows. */
export const PDF_SUMMARY_MAX_CHARS = 24_000;
export const PDF_SUMMARY_MAX_PAGES = 40;
export const PDF_SUMMARY_MAX_BYTES = 12 * 1024 * 1024;

/**
 * @param {Buffer|Uint8Array} input
 * @param {{ maxPages?: number, maxChars?: number }} [opts]
 * @returns {Promise<{ text: string, pageCount: number, pagesRead: number, truncated: boolean }>}
 */
export async function extractPdfTextFromBuffer(input, opts = {}) {
  const maxPages = Math.max(1, Number(opts.maxPages) || PDF_SUMMARY_MAX_PAGES);
  const maxChars = Math.max(500, Number(opts.maxChars) || PDF_SUMMARY_MAX_CHARS);
  // pdf.js rejects Node Buffer; copy into a plain Uint8Array.
  const raw = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  const bytes = new Uint8Array(raw.byteLength);
  bytes.set(raw);
  if (bytes.length < 5) {
    throw new Error('PDF file is empty or unreadable.');
  }
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new Error('Not a PDF file (missing %PDF header).');
  }
  if (bytes.length > PDF_SUMMARY_MAX_BYTES) {
    throw new Error('PDF is larger than 12 MB. Choose a smaller file.');
  }

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
    const pageCount = doc.numPages || 0;
    if (!pageCount) {
      throw new Error('PDF has no pages.');
    }
    const pagesRead = Math.min(pageCount, maxPages);
    const parts = [];
    let total = 0;
    let truncated = pageCount > maxPages;

    for (let i = 1; i <= pagesRead; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items || [])
        .map((item) => {
          if (!item || typeof item.str !== 'string') return '';
          return item.str + (item.hasEOL ? '\n' : ' ');
        })
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (pageText) {
        const chunk = `--- Page ${i} ---\n${pageText}`;
        if (total + chunk.length + 2 > maxChars) {
          const remain = maxChars - total - 2;
          if (remain > 80) parts.push(chunk.slice(0, remain));
          truncated = true;
          break;
        }
        parts.push(chunk);
        total += chunk.length + 2;
      }
    }

    const text = parts.join('\n\n').trim();
    if (!text) {
      throw new Error(
        'No extractable text in this PDF (it may be scanned images only). Aspera AI needs a text PDF for now.',
      );
    }
    return { text, pageCount, pagesRead, truncated };
  } finally {
    try {
      await doc?.destroy?.();
    } catch {
      // ignore
    }
  }
}

/**
 * @param {string} filePath
 * @param {{ maxPages?: number, maxChars?: number }} [opts]
 */
export async function extractPdfTextFromFile(filePath, opts = {}) {
  const abs = path.resolve(String(filePath || ''));
  if (!abs || !fs.existsSync(abs)) {
    throw new Error('PDF file not found.');
  }
  const st = fs.statSync(abs);
  if (!st.isFile()) {
    throw new Error('Path is not a file.');
  }
  if (st.size > PDF_SUMMARY_MAX_BYTES) {
    throw new Error('PDF is larger than 12 MB. Choose a smaller file.');
  }
  const buf = fs.readFileSync(abs);
  return extractPdfTextFromBuffer(buf, opts);
}
