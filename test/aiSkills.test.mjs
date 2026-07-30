import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ALLOWED_APP_IDS,
  isAiAllowedAppId,
  languageInstruction,
  getAiProvider,
} from '../src/ai/catalog.js';
import { buildCatchMeUpPrompt, buildSummarizePrompt } from '../src/ai/skills.js';

test('AI skills allow only WhatsApp, Arattai, Gmail, Zoho Mail', () => {
  assert.deepEqual(AI_ALLOWED_APP_IDS, [
    'whatsapp',
    'arattai',
    'gmail',
    'zoho-mail',
  ]);
  assert.equal(isAiAllowedAppId('whatsapp'), true);
  assert.equal(isAiAllowedAppId('zoho-crm'), false);
});

test('providers include Gemini, Grok, SambaNova, OpenRouter, Anthropic', () => {
  for (const id of ['gemini', 'grok', 'sambanova', 'openrouter', 'anthropic']) {
    assert.ok(getAiProvider(id));
  }
  assert.equal(getAiProvider('anthropic').freeTierFriendly, false);
});

test('language instructions cover EN Hindi Marathi', () => {
  assert.match(languageInstruction('en'), /English/i);
  assert.match(languageInstruction('hi'), /Hindi/);
  assert.match(languageInstruction('mr'), /Marathi/);
});

test('summarize prompt includes selection and language', () => {
  const prompt = buildSummarizePrompt({
    text: 'Please send the invoice tomorrow',
    appName: 'WhatsApp',
    language: 'hi',
  });
  assert.match(prompt, /invoice tomorrow/);
  assert.match(prompt, /Hindi/);
  assert.match(prompt, /WhatsApp/);
});

test('catch-up prompt lists notification items', () => {
  const prompt = buildCatchMeUpPrompt({
    language: 'mr',
    items: [
      {
        appName: 'Gmail',
        unread: 3,
        title: 'Invoice',
        body: 'Due Friday',
      },
    ],
  });
  assert.match(prompt, /Marathi/);
  assert.match(prompt, /Gmail/);
  assert.match(prompt, /Invoice/);
});

test('OpenRouter default is not a dead gemini-2.0-flash-001 slug', () => {
  const openrouter = getAiProvider('openrouter');
  assert.equal(openrouter.id, 'openrouter');
  assert.notEqual(openrouter.defaultModel, 'google/gemini-2.0-flash-001');
  assert.ok(openrouter.defaultModel);
});
