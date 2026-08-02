import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guestContextMenuActionOrder,
  shouldOfferPdfSummarizeMenu,
} from '../src/guestContextMenu.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('selected message menu is Summarize then Forward (no Pin)', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: true,
      canSummarize: true,
      canForward: true,
      canPin: true,
    }),
    ['summarize', 'forward'],
  );
});

test('chat-list menu without selection is Pin then Forward', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: false,
      canSummarize: false,
      canForward: true,
      canPin: true,
    }),
    ['pin', 'forward'],
  );
});

test('PDF bubble menu inserts Summarize PDF before Forward', () => {
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: false,
      canSummarize: false,
      canSummarizePdf: true,
      canForward: true,
      canPin: true,
    }),
    ['pin', 'summarize-pdf', 'forward'],
  );
  assert.deepEqual(
    guestContextMenuActionOrder({
      hasSelection: true,
      canSummarize: true,
      canSummarizePdf: true,
      canForward: true,
      canPin: true,
    }),
    ['summarize', 'summarize-pdf', 'forward'],
  );
});

test('PDF summarize menu is always offered on AI-allowed apps', () => {
  assert.equal(
    shouldOfferPdfSummarizeMenu({ aiEnabled: true, aiAllowed: true }),
    true,
  );
  assert.equal(
    shouldOfferPdfSummarizeMenu({ aiEnabled: false, aiAllowed: true }),
    false,
  );
  assert.equal(
    shouldOfferPdfSummarizeMenu({ aiEnabled: true, aiAllowed: false }),
    false,
  );
});

test('main guest context menu follows guestContextMenuActionOrder', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/main.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /guestContextMenuActionOrder/);
  assert.match(src, /shouldOfferPdfSummarizeMenu/);
  assert.match(src, /action === 'summarize'/);
  assert.match(src, /action === 'summarize-pdf'/);
  assert.match(src, /action === 'forward'/);
  assert.match(src, /action === 'pin'/);
  assert.match(src, /Summarize PDF with Aspera AI/);
  assert.match(src, /ASPERA_PDF_CTX_PREFIX|__ASPERA_DOCK_PDF_CTX__/);
  assert.match(src, /injectGuestPdfContextBridge/);
  assert.match(src, /runSummarizePdfFromGuest/);
  // Must not auto-popup a second Electron menu on WhatsApp right-click.
  assert.doesNotMatch(src, /popupGuestPdfActionsMenu/);
  assert.match(src, /action: 'summarize'/);
});
