import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApplyComposeTextJs,
  pickComposeCandidate,
} from '../src/aiComposeInsert.js';
import { guestComposeSelector } from '../src/forwardHub.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('pickComposeCandidate prefers original-text match over first node', () => {
  const picked = pickComposeCandidate(
    [
      { text: 'hello search', searchy: false },
      { text: 'what is teh need of spelling check', searchy: false },
      { text: 'other', searchy: false },
    ],
    'what is teh need of spelling check',
  );
  assert.equal(picked.text, 'what is teh need of spelling check');
});

test('pickComposeCandidate skips searchy nodes and uses marked', () => {
  const picked = pickComposeCandidate(
    [
      { text: 'query', searchy: true },
      { text: 'draft here', marked: true },
    ],
    '',
  );
  assert.equal(picked.marked, true);
});

test('buildApplyComposeTextJs embeds text and WA compose selectors', () => {
  const js = buildApplyComposeTextJs({
    text: 'Polished sentence.',
    original: 'raw draft',
    composeSelector: guestComposeSelector(),
  });
  assert.match(js, /Polished sentence\./);
  assert.match(js, /raw draft/);
  assert.match(js, /conversation-compose-box-input/);
  assert.match(js, /data-aspera-ai-compose/);
  assert.match(js, /insertText/);
});

test('main applyTextToMarkedCompose uses shared insert helper + CDP fallback', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/main.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /buildApplyComposeTextJs/);
  assert.ok(src.includes("from './aiComposeInsert.js'"));
  assert.ok(src.includes('focusGuestCompose(wc)'));
  assert.ok(src.includes('cdpEvaluate(wc, expression'));
});
