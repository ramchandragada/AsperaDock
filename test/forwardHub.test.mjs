import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOfferForward,
  describeForwardPayload,
  buildForwardClipboardText,
  extractDocumentFileName,
  isForwardAppId,
  looksLikeDocument,
  mimeForFilename,
  sanitizeForwardFilename,
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
  assert.equal(looksLikeDocument({ mediaType: 'file' }), true);
  assert.equal(looksLikeDocument({ nearbyText: 'Policy.pdf 1.2 MB PDF' }), true);
  assert.equal(looksLikeDocument({ docLikely: true }), true);
  assert.equal(
    looksLikeDocument({ srcURL: 'https://cdn.example/preview.png' }),
    false,
  );
  assert.equal(extractDocumentFileName('Shared Policy.pdf · 820 KB'), 'Shared Policy.pdf');
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
