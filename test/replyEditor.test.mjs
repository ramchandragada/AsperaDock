import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSuggestedReplies,
  serializeSuggestedReplies,
  buildReviseReplyPrompt,
} from '../src/ai/replyEditor.js';

const SAMPLE = `## English replies
1) I understand the policy risk and cannot share access.
2) Happy to help another way within policy.

## Hindi replies (हिन्दी)
1) नीति जोखिम के कारण पहुँच साझा नहीं कर सकता।
2) नीति के भीतर अन्य मदद कर सकता हूँ।

## Marathi replies (मराठी)
1) धोरण जोखमीमुळे प्रवेश देऊ शकत नाही.
2) धोरणाच्या मर्यादेत इतर मदत करू शकतो.`;

test('parseSuggestedReplies splits EN HI MR options', () => {
  const sections = parseSuggestedReplies(SAMPLE);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].id, 'en');
  assert.equal(sections[0].items.length, 2);
  assert.match(sections[0].items[0].text, /policy risk/);
  assert.equal(sections[1].id, 'hi');
  assert.equal(sections[1].items.length, 2);
  assert.equal(sections[2].id, 'mr');
  assert.equal(sections[2].items.length, 2);
});

test('serializeSuggestedReplies round-trips edited drafts', () => {
  const sections = parseSuggestedReplies(SAMPLE);
  sections[0].items[0].text = 'Edited English reply.';
  sections[0].items.push({ text: 'Third custom reply.' });
  const text = serializeSuggestedReplies(sections);
  assert.match(text, /## English replies/);
  assert.match(text, /1\) Edited English reply\./);
  assert.match(text, /3\) Third custom reply\./);
  assert.match(text, /## Hindi replies/);
  const again = parseSuggestedReplies(text);
  assert.equal(again[0].items[0].text, 'Edited English reply.');
  assert.equal(again[0].items[2].text, 'Third custom reply.');
});

test('buildReviseReplyPrompt keeps language and draft', () => {
  const prompt = buildReviseReplyPrompt({
    replyText: 'I cannot share access.',
    language: 'en',
    selectionText: 'Please give me the password',
    appName: 'WhatsApp',
  });
  assert.match(prompt, /cannot share access/);
  assert.match(prompt, /password/);
  assert.match(prompt, /WhatsApp/);
  assert.match(prompt, /English/);
});
