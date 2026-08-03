import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIOR_MESSAGE_COUNT,
  formatPriorMessagesForPrompt,
  sanitizePriorMessages,
  scrapeNearbyMessagesJs,
} from '../src/guestChatContext.js';

test('sanitizePriorMessages normalizes roles and caps count', () => {
  const cleaned = sanitizePriorMessages([
    { role: 'out', text: '  Hello there  ' },
    { role: 'in', text: 'Hi' },
    { role: 'me', text: '' },
    { role: 'weird', text: 'Maybe' },
    { role: 'them', text: 'Ok' },
    { role: 'them', text: 'Extra should drop when max=3' },
  ], { max: 3 });
  assert.deepEqual(cleaned, [
    { role: 'you', text: 'Hello there' },
    { role: 'them', text: 'Hi' },
    { role: 'unknown', text: 'Maybe' },
  ]);
  assert.equal(PRIOR_MESSAGE_COUNT, 5);
});

test('formatPriorMessagesForPrompt labels You/Them oldest-first', () => {
  const block = formatPriorMessagesForPrompt([
    { role: 'them', text: 'Need the deed' },
    { role: 'you', text: 'Courier today' },
  ]);
  assert.match(block, /Earlier conversation/);
  assert.match(block, /1\. \[Them\] Need the deed/);
  assert.match(block, /2\. \[You\] Courier today/);
  assert.equal(formatPriorMessagesForPrompt([]), '');
});

test('scrapeNearbyMessagesJs targets WhatsApp and Arattai message DOM', () => {
  const js = scrapeNearbyMessagesJs({
    selectionText: 'Bluedart delivered today',
    maxPrior: 5,
    clickX: 120,
    clickY: 240,
  });
  assert.match(js, /msg-container/);
  assert.match(js, /message-in|message-out/);
  assert.match(js, /art-chwindow/);
  assert.match(js, /elementsFromPoint|elementFromPoint/);
  assert.match(js, /Bluedart delivered today/);
  assert.match(js, /maxPrior = 5/);
  assert.match(js, /copyable-text|selectable-text/);
});
