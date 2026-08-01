import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOfferForward,
  classifyForwardFileBytes,
  describeForwardPayload,
  buildForwardClipboardText,
  extractDocumentFileName,
  hasStrongDocumentEvidence,
  isDocumentAccept,
  isForwardAppId,
  isImageOnlyAccept,
  looksLikeDocument,
  mimeForFilename,
  sanitizeForwardFilename,
  shouldForwardAsDocument,
  shouldOfferDocumentForwardMenu,
} from '../src/forwardHub.js';

test('forward is only for WhatsApp and Arattai with targets', () => {
  assert.equal(isForwardAppId('whatsapp'), true);
  assert.equal(isForwardAppId('arattai'), true);
  assert.equal(isForwardAppId('gmail'), false);
  assert.equal(
    canOfferForward({
      appId: 'whatsapp',
      hasSelection: true,
      targetCount: 1,
    }),
    true,
  );
  assert.equal(
    canOfferForward({
      appId: 'whatsapp',
      hasSelection: true,
      targetCount: 0,
    }),
    false,
  );
  assert.equal(
    canOfferForward({
      appId: 'gmail',
      hasSelection: true,
      targetCount: 2,
    }),
    false,
  );
  assert.equal(
    canOfferForward({
      appId: 'arattai',
      hasImage: true,
      targetCount: 1,
    }),
    true,
  );
});

test('looksLikeDocument detects PDF names and URLs', () => {
  assert.equal(looksLikeDocument({ linkURL: 'https://cdn.example/a.pdf' }), true);
  assert.equal(looksLikeDocument({ fileName: 'Invoice Q1.pdf' }), true);
  assert.equal(looksLikeDocument({ titleText: 'report.PDF' }), true);
  assert.equal(looksLikeDocument({ mediaType: 'file', fileName: 'scan.pdf' }), true);
  assert.equal(looksLikeDocument({ nearbyText: 'Policy.pdf 1.2 MB PDF' }), true);
  assert.equal(looksLikeDocument({ docLikely: true }), true);
  assert.equal(
    looksLikeDocument({ srcURL: 'https://cdn.example/preview.png' }),
    false,
  );
  assert.equal(extractDocumentFileName('Shared Policy.pdf · 820 KB'), 'Shared Policy.pdf');
});

test('photo bubbles with Download are not treated as documents', () => {
  // Arattai/WhatsApp photos often expose a Download control — that alone must
  // not force the PDF capture path (user saw "Could not get the PDF/document").
  assert.equal(
    shouldForwardAsDocument({
      hasImage: true,
      hasDownload: true,
      mediaType: 'image',
      srcURL: 'blob:https://web.arattai.in/abc',
    }),
    false,
  );
  assert.equal(
    hasStrongDocumentEvidence({
      hasImage: true,
      hasDownload: true,
      mediaType: 'image',
    }),
    false,
  );
  assert.equal(
    shouldForwardAsDocument({
      hasImage: true,
      forceDocument: true,
      hasDownload: true,
    }),
    true,
  );
  assert.equal(
    shouldForwardAsDocument({
      hasImage: true,
      nearbyText: 'Policy.pdf · 820 KB PDF',
      hasDownload: true,
    }),
    true,
  );
  // Soft download signal still counts when not clearly an image click.
  assert.equal(looksLikeDocument({ hasDownload: true }), true);
  assert.equal(looksLikeDocument({ hasDownload: true, hasImage: true }), false);
});

test('context menu offers Forward document for image tiles and files', () => {
  // PDF chat tiles are exposed as images (Copy image…) — document action must stay.
  assert.equal(
    shouldOfferDocumentForwardMenu({
      hasImage: true,
      mediaType: 'image',
      srcURL: 'blob:https://web.arattai.in/x',
    }),
    true,
  );
  assert.equal(
    shouldOfferDocumentForwardMenu({
      mediaType: 'file',
      fileName: 'scan.pdf',
    }),
    true,
  );
  assert.equal(
    shouldOfferDocumentForwardMenu({
      hasImage: true,
      titleText: 'Invoice.pdf',
    }),
    true,
  );
  assert.equal(
    shouldOfferDocumentForwardMenu({
      linkURL: 'https://cdn.example/a.pdf',
    }),
    true,
  );
});

test('document forward description prefers Document label', () => {
  assert.match(
    describeForwardPayload({
      isDocument: true,
      fileName: 'policy.pdf',
      hasImage: true,
    }),
    /Document · policy\.pdf/,
  );
});

test('document clipboard text does not dump local file path into chat', () => {
  assert.equal(
    buildForwardClipboardText({
      isDocument: true,
      filePath: '/tmp/policy.pdf',
      text: '',
    }),
    '',
  );
  assert.equal(
    buildForwardClipboardText({
      text: 'Please review',
      linkURL: 'https://example.com/doc.pdf',
    }),
    'Please review\n\nhttps://example.com/doc.pdf',
  );
});

test('sanitizeForwardFilename keeps safe pdf names', () => {
  assert.equal(sanitizeForwardFilename('My Invoice.pdf'), 'My Invoice.pdf');
  assert.match(sanitizeForwardFilename('../../evil.pdf'), /evil\.pdf$/);
});

test('mimeForFilename maps pdf documents', () => {
  assert.equal(mimeForFilename('a.pdf'), 'application/pdf');
  assert.equal(mimeForFilename('sheet.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('WhatsApp Photos accept is image-only; Document accept is safe for PDF', () => {
  assert.equal(isImageOnlyAccept('image/*,video/mp4,video/3gpp,video/quicktime'), true);
  assert.equal(isDocumentAccept('image/*,video/mp4,video/3gpp,video/quicktime'), false);
  // Old bug: accept.includes("*") treated image/* as a document input.
  assert.equal(isDocumentAccept('image/*'), false);
  assert.equal(isDocumentAccept(''), true);
  assert.equal(isDocumentAccept('*'), true);
  assert.equal(isDocumentAccept('*/*'), true);
  assert.equal(isDocumentAccept('.pdf,.doc,.docx,application/pdf'), true);
  assert.equal(isImageOnlyAccept('.pdf,.doc'), false);
});

test('classifyForwardFileBytes rejects PNG thumbs and accepts %PDF', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(classifyForwardFileBytes(png, 'Policy.pdf').ok, false);
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
  assert.deepEqual(classifyForwardFileBytes(pdf, 'Policy.pdf'), { ok: true, kind: 'pdf' });
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  assert.equal(classifyForwardFileBytes(jpeg, 'scan.pdf').ok, false);
});
