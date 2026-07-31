import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ALLOWED_APP_IDS,
  isAiAllowedAppId,
  languageInstruction,
  getAiProvider,
  normalizeAnthropicModel,
  normalizeGeminiModel,
  normalizeGrokModel,
  geminiModelFallbackChain,
  aiProviderRouteOrder,
  configuredProvidersInRouteOrder,
  resolveAiAttemptOrder,
} from '../src/ai/catalog.js';
import { buildCatchMeUpPrompt, buildSuggestReplyPrompt, buildSummarizePrompt } from '../src/ai/skills.js';

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

test('summarize prompt requests English Hindi and Marathi', () => {
  const prompt = buildSummarizePrompt({
    text: 'Please send the invoice tomorrow',
    appName: 'WhatsApp',
  });
  assert.match(prompt, /invoice tomorrow/);
  assert.match(prompt, /## English/);
  assert.match(prompt, /## Hindi/);
  assert.match(prompt, /## Marathi/);
  assert.match(prompt, /WhatsApp/);
});

test('suggest-reply prompt requests EN HI MR drafts', () => {
  const prompt = buildSuggestReplyPrompt({
    text: 'Can we meet at 3pm?',
    appName: 'Arattai',
  });
  assert.match(prompt, /meet at 3pm/);
  assert.match(prompt, /## English replies/);
  assert.match(prompt, /## Hindi replies/);
  assert.match(prompt, /## Marathi replies/);
  assert.match(prompt, /Arattai/);
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

test('AI provider try order is Gemini → Grok → SambaNova → OpenRouter → Anthropic', () => {
  assert.deepEqual(aiProviderRouteOrder().map((p) => p.id), [
    'gemini',
    'grok',
    'sambanova',
    'openrouter',
    'anthropic',
  ]);
  assert.deepEqual(
    configuredProvidersInRouteOrder([
      'anthropic',
      'openrouter',
      'gemini',
      'grok',
    ]).map((p) => p.id),
    ['gemini', 'grok', 'openrouter', 'anthropic'],
  );
  assert.deepEqual(
    configuredProvidersInRouteOrder(['openrouter', 'anthropic']).map((p) => p.id),
    ['openrouter', 'anthropic'],
  );
  assert.deepEqual(
    configuredProvidersInRouteOrder(['anthropic']).map((p) => p.id),
    ['anthropic'],
  );
  assert.equal(getAiProvider('openrouter').defaultModel, 'google/gemini-2.0-flash-001');
  assert.equal(getAiProvider('gemini').defaultModel, 'gemini-3.1-flash-lite');
  assert.equal(getAiProvider('grok').defaultModel, 'grok-4.5');
});

test('Gemini and Grok normalize retired model ids', () => {
  assert.equal(normalizeGeminiModel('gemini-2.0-flash'), 'gemini-3.1-flash-lite');
  assert.equal(normalizeGeminiModel('gemini-2.5-flash-lite'), 'gemini-3.1-flash-lite');
  assert.equal(normalizeGrokModel('grok-2-latest'), 'grok-4.5');
  assert.ok(geminiModelFallbackChain('gemini-2.5-flash-lite').includes('gemini-flash-lite-latest'));
  assert.equal(geminiModelFallbackChain('gemini-2.5-flash-lite')[0], 'gemini-3.1-flash-lite');
});

test('resolveAiAttemptOrder sticks to Gemini and only advances after exhaustion', () => {
  const configured = ['gemini', 'grok', 'openrouter', 'anthropic'];
  assert.deepEqual(
    resolveAiAttemptOrder({ configuredIds: configured }),
    ['gemini', 'grok', 'openrouter', 'anthropic'],
  );
  assert.deepEqual(
    resolveAiAttemptOrder({
      configuredIds: configured,
      stickyId: 'gemini',
    }),
    ['gemini', 'grok', 'openrouter', 'anthropic'],
  );
  // After Gemini exhausted, sticky Grok — do not re-check Gemini.
  assert.deepEqual(
    resolveAiAttemptOrder({
      configuredIds: configured,
      stickyId: 'grok',
      exhaustedIds: ['gemini'],
    }),
    ['grok', 'openrouter', 'anthropic'],
  );
  assert.deepEqual(
    resolveAiAttemptOrder({
      configuredIds: configured,
      stickyId: 'openrouter',
      exhaustedIds: ['gemini', 'grok'],
    }),
    ['openrouter', 'anthropic'],
  );
});
