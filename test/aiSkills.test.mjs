import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ALLOWED_APP_IDS,
  isAiAllowedAppId,
  languageInstruction,
  getAiProvider,
  normalizeAnthropicModel,
  aiProviderRouteOrder,
  configuredProvidersInRouteOrder,
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

test('Anthropic normalizes retired haiku model ids', () => {
  assert.equal(getAiProvider('anthropic').defaultModel, 'claude-haiku-4-5');
  assert.equal(
    normalizeAnthropicModel('claude-3-5-haiku-latest'),
    'claude-haiku-4-5',
  );
  assert.equal(
    normalizeAnthropicModel('claude-sonnet-4-20250514'),
    'claude-sonnet-4-6',
  );
});

test('AI provider auto-route puts free first and Anthropic last', () => {
  const order = aiProviderRouteOrder().map((p) => p.id);
  assert.equal(order[order.length - 1], 'anthropic');
  assert.ok(order.indexOf('gemini') < order.indexOf('anthropic'));
  assert.ok(order.indexOf('openrouter') < order.indexOf('anthropic'));
  assert.deepEqual(
    configuredProvidersInRouteOrder(['anthropic', 'gemini', 'openrouter']).map(
      (p) => p.id,
    ),
    ['gemini', 'openrouter', 'anthropic'],
  );
  assert.deepEqual(
    configuredProvidersInRouteOrder(['anthropic']).map((p) => p.id),
    ['anthropic'],
  );
});
