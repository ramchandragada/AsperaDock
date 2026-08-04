import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guestContextMenuActionOrder,
  canOfferHubPin,
} from '../src/guestContextMenu.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('selected message menu is Summarize, CRM lookup, then Forward (no Pin)', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: true,
      canSummarize: true,
      canForward: true,
      canPin: true,
      canCrmLookup: true,
    }),
    ['summarize', 'crm-lookup', 'forward'],
  );
});

test('selection menu can be CRM-only when AI is off', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: true,
      canSummarize: false,
      canForward: false,
      canPin: true,
      canCrmLookup: true,
    }),
    ['crm-lookup'],
  );
});

test('chat-list menu without selection is Pin then Forward', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: false,
      canSummarize: false,
      canForward: true,
      canPin: true,
      canCrmLookup: true,
    }),
    ['pin', 'forward'],
  );
});

test('chat-list can open Aspera AI clipboard panel without a selection', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: false,
      canSummarize: true,
      canForward: true,
      canPin: true,
    }),
    ['summarize', 'pin', 'forward'],
  );
});

test('menu order never includes summarize-pdf', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: false,
      canSummarize: false,
      canForward: true,
      canPin: true,
    }),
    ['pin', 'forward'],
  );
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: true,
      canSummarize: true,
      canForward: true,
      canPin: true,
      canCrmLookup: true,
    }),
    ['summarize', 'crm-lookup', 'forward'],
  );
});

test('canOfferHubPin allows chat-list rows only', () => {
  assert.equal(
    canOfferHubPin({ inboxApp: true, hasSelection: false }),
    true,
  );
  assert.equal(
    canOfferHubPin({ inboxApp: true, hasSelection: true }),
    false,
  );
  assert.equal(
    canOfferHubPin({
      inboxApp: true,
      hasSelection: false,
      hasImage: true,
    }),
    false,
  );
  assert.equal(
    canOfferHubPin({
      inboxApp: true,
      hasSelection: false,
      mediaType: 'image',
    }),
    false,
  );
  assert.equal(
    canOfferHubPin({
      inboxApp: true,
      hasSelection: false,
      mediaType: 'video',
    }),
    false,
  );
  assert.equal(
    canOfferHubPin({ inboxApp: false, hasSelection: false }),
    false,
  );
});

test('main guest context menu follows guestContextMenuActionOrder', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/main.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /guestContextMenuActionOrder/);
  assert.match(src, /canOfferHubPin/);
  assert.match(src, /action === 'summarize'/);
  assert.match(src, /action === 'crm-lookup'/);
  assert.match(src, /action === 'forward'/);
  assert.match(src, /action === 'pin'/);
  assert.match(src, /Aspera AI…/);
  assert.doesNotMatch(src, /Copy to Aspera AI…/);
  assert.match(src, /Lookup in Zoho CRM/);
  assert.match(src, /Forward with Aspera Hub/);
  assert.match(src, /FORWARD_WITH_HUB_ENABLED/);
  // PDF summarize feature removed — select text in the PDF preview instead.
  assert.doesNotMatch(src, /summarize-pdf/);
  assert.doesNotMatch(src, /shouldOfferPdfSummarizeMenu/);
  assert.doesNotMatch(src, /injectGuestPdfContextBridge/);
  assert.doesNotMatch(src, /runSummarizePdfFromGuest/);
  assert.doesNotMatch(src, /Summarize PDF with Aspera AI/);
  assert.doesNotMatch(src, /Summarize with Aspera AI/);
  // Forward capture helpers remain for when the feature is re-enabled.
  assert.match(src, /guestPdfBytesProbeJs/);
});
