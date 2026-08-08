import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ATTACH_IMAGE_MAX_BYTES,
  classifyAiAttachment,
  clipboardScreenshotFileName,
  normalizeImageMime,
  pdfTextIsUsable,
  pickClipboardImageEncoding,
  resolvePdfjsUrls,
  validateAiAttachmentMeta,
} from '../src/ai/attachments.js';
import {
  buildSummarizeAttachmentPrompt,
  buildSummarizePdfTextPrompt,
} from '../src/ai/skills.js';

test('classifyAiAttachment detects pdf and images', () => {
  assert.equal(classifyAiAttachment('a.PDF', ''), 'pdf');
  assert.equal(classifyAiAttachment('x', 'application/pdf'), 'pdf');
  assert.equal(classifyAiAttachment('shot.png', ''), 'image');
  assert.equal(classifyAiAttachment('x', 'image/jpeg'), 'image');
  assert.equal(classifyAiAttachment('notes.txt', 'text/plain'), '');
});

test('validateAiAttachmentMeta enforces types and size', () => {
  assert.equal(
    validateAiAttachmentMeta({
      name: 'doc.pdf',
      mime: 'application/pdf',
      byteLength: 1200,
    }).ok,
    true,
  );
  assert.equal(
    validateAiAttachmentMeta({
      name: 'pic.jpg',
      mime: 'image/jpeg',
      byteLength: 2048,
    }).kind,
    'image',
  );
  assert.match(
    validateAiAttachmentMeta({
      name: 'huge.png',
      mime: 'image/png',
      byteLength: AI_ATTACH_IMAGE_MAX_BYTES + 1,
    }).error,
    /too large/i,
  );
  assert.match(
    validateAiAttachmentMeta({
      name: 'a.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      byteLength: 100,
    }).error,
    /Only PDF or image/i,
  );
});

test('normalizeImageMime maps jpg aliases', () => {
  assert.equal(normalizeImageMime('a.jpg', 'image/jpg'), 'image/jpeg');
  assert.equal(normalizeImageMime('a.png', ''), 'image/png');
});

test('pdfTextIsUsable rejects tiny extracts', () => {
  assert.equal(pdfTextIsUsable('hi'), false);
  assert.equal(pdfTextIsUsable('x'.repeat(80)), true);
});

test('pickClipboardImageEncoding prefers PNG under the image cap', () => {
  assert.equal(pickClipboardImageEncoding(1200, 800), 'png');
  assert.equal(
    pickClipboardImageEncoding(AI_ATTACH_IMAGE_MAX_BYTES + 1, 900_000),
    'jpeg',
  );
  assert.equal(
    pickClipboardImageEncoding(
      AI_ATTACH_IMAGE_MAX_BYTES + 1,
      AI_ATTACH_IMAGE_MAX_BYTES + 2,
    ),
    '',
  );
  assert.match(clipboardScreenshotFileName('png', Date.parse('2026-08-08T12:00:00Z')), /\.png$/);
  assert.match(clipboardScreenshotFileName('jpeg', Date.parse('2026-08-08T12:00:00Z')), /\.jpg$/);
});

test('resolvePdfjsUrls finds node_modules builds', async () => {
  const urls = await resolvePdfjsUrls();
  assert.match(urls.moduleUrl, /pdf\.mjs$/);
  assert.match(urls.workerSrc, /pdf\.worker\.mjs$/);
  assert.match(urls.moduleUrl, /^file:/);
});

test('attachment summarize prompts stay trilingual and forbid TL;DR labels', () => {
  const pdf = buildSummarizePdfTextPrompt({
    text: 'Invoice total 1000',
    fileName: 'inv.pdf',
    pagesRead: 1,
    numPages: 2,
  });
  assert.match(pdf, /## English/);
  assert.match(pdf, /## Hindi/);
  assert.match(pdf, /## Marathi/);
  assert.match(pdf, /inv\.pdf/);
  assert.match(pdf, /Do not write TL;DR/);
  assert.doesNotMatch(pdf, /one-line TL;DR/);

  const img = buildSummarizeAttachmentPrompt({
    kind: 'image',
    fileName: 'shot.png',
  });
  assert.match(img, /uploaded image/);
  assert.match(img, /## English/);
  assert.match(img, /Do not write TL;DR/);
});
