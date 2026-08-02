import test from 'node:test';
import assert from 'node:assert/strict';
import { guestContextMenuActionOrder } from '../src/guestContextMenu.js';
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

test('main guest context menu follows guestContextMenuActionOrder', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/main.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /guestContextMenuActionOrder/);
  assert.match(src, /action === 'summarize'/);
  assert.match(src, /action === 'forward'/);
  assert.match(src, /action === 'pin'/);
});
