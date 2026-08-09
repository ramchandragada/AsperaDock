import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_DEFAULT_EXTRA_LANGUAGES,
  AI_EXTRA_LANGUAGE_IDS,
  AI_LANGUAGES,
  aiOutputLanguageMeta,
  languageInstruction,
  promptHeadingsBlock,
  resolveAiOutputLanguages,
  sanitizeAiExtraLanguages,
} from '../src/ai/catalog.js';
import {
  buildRefineDraftPrompt,
  buildSummarizePrompt,
  buildSuggestReplyPrompt,
} from '../src/ai/skills.js';
import { parseRefinedDrafts } from '../src/ai/refineDraft.js';
import { parseSuggestedReplies } from '../src/ai/replyEditor.js';

test('catalog includes English and the seven new Indic languages', () => {
  const ids = AI_LANGUAGES.map((l) => l.id);
  assert.ok(ids.includes('en'));
  for (const id of ['bn', 'te', 'ta', 'gu', 'kn', 'or', 'ml']) {
    assert.ok(ids.includes(id), id);
    assert.ok(AI_EXTRA_LANGUAGE_IDS.includes(id), id);
  }
  assert.deepEqual([...AI_DEFAULT_EXTRA_LANGUAGES], ['hi', 'mr']);
});

test('sanitizeAiExtraLanguages defaults, caps, and drops English', () => {
  assert.deepEqual(sanitizeAiExtraLanguages(undefined), ['hi', 'mr']);
  assert.deepEqual(sanitizeAiExtraLanguages([]), []);
  assert.deepEqual(sanitizeAiExtraLanguages(['ta', 'bn', 'gu']), ['ta', 'bn']);
  assert.deepEqual(sanitizeAiExtraLanguages(['en', 'ta', 'ta', 'xx']), ['ta']);
});

test('resolveAiOutputLanguages always starts with English', () => {
  const langs = resolveAiOutputLanguages(['ml', 'te']);
  assert.equal(langs[0].id, 'en');
  assert.equal(langs[1].id, 'ml');
  assert.equal(langs[2].id, 'te');
  assert.equal(aiOutputLanguageMeta(langs), 'EN · ML · TE');
});

test('languageInstruction covers Tamil and Odia scripts', () => {
  assert.match(languageInstruction('ta'), /Tamil/);
  assert.match(languageInstruction('ta'), /Tamil script/);
  assert.match(languageInstruction('or'), /Odia/);
  assert.match(languageInstruction('en'), /English/i);
});

test('summarize prompt uses selected extras only', () => {
  const prompt = buildSummarizePrompt({
    text: 'Invoice due Friday',
    appName: 'WhatsApp',
    extraLanguages: ['ta', 'bn'],
  });
  assert.match(prompt, /## English/);
  assert.match(prompt, /## Tamil/);
  assert.match(prompt, /## Bengali/);
  assert.doesNotMatch(prompt, /## Hindi/);
  assert.doesNotMatch(prompt, /## Marathi/);
  assert.match(prompt, /Tamil script/);
});

test('suggest-reply and refine prompts follow extras', () => {
  const replies = buildSuggestReplyPrompt({
    text: 'Can we meet?',
    extraLanguages: ['gu'],
  });
  assert.match(replies, /## English replies/);
  assert.match(replies, /## Gujarati replies/);
  assert.doesNotMatch(replies, /## Hindi replies/);

  const refine = buildRefineDraftPrompt({
    text: 'pls confirm',
    extraLanguages: ['kn', 'ml'],
  });
  assert.match(refine, /## Kannada/);
  assert.match(refine, /## Malayalam/);
});

test('promptHeadingsBlock counts languages', () => {
  const block = promptHeadingsBlock(resolveAiOutputLanguages([]));
  assert.match(block, /ONE language/);
  assert.match(block, /## English/);
});

test('parsers split Tamil and Bengali sections', () => {
  const langs = resolveAiOutputLanguages(['ta', 'bn']);
  const refined = parseRefinedDrafts(
    `## English
Hello

## Tamil (தமிழ்)
வணக்கம்

## Bengali (বাংলা)
নমস্কার`,
    langs,
  );
  assert.equal(refined.length, 3);
  assert.equal(refined[1].id, 'ta');
  assert.match(refined[1].text, /வணக்கம்/);
  assert.match(refined[2].text, /নমস্কার/);

  const replies = parseSuggestedReplies(
    `## English replies
1) Thanks

## Tamil replies (தமிழ்)
1) நன்றி`,
    langs.slice(0, 2),
  );
  assert.equal(replies[0].items[0].text, 'Thanks');
  assert.equal(replies[1].items[0].text, 'நன்றி');
});
