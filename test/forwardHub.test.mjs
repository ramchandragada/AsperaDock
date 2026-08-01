import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOfferForward,
  describeForwardPayload,
  buildForwardClipboardText,
  isForwardAppId,
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

test('describe and clipboard helpers cover text image and links', () => {
  assert.match(
    describeForwardPayload({ text: 'Hello team', hasImage: true }),
    /Image/,
  );
  assert.equal(
    buildForwardClipboardText({
      text: 'Please review',
      linkURL: 'https://example.com/doc.pdf',
    }),
    'Please review\n\nhttps://example.com/doc.pdf',
  );
});
