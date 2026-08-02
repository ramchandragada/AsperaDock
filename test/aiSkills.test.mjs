import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ALLOWED_APP_IDS,
  AI_PROVIDER_TRY_ORDER,
  isAiAllowedAppId,
  languageInstruction,
  getAiProvider,
  normalizeAnthropicModel,
  normalizeGeminiModel,
  normalizeGrokModel,
  normalizeSarvamModel,
  geminiModelFallbackChain,
  aiProviderRouteOrder,
  aiProviderTryOrdinal,
  configuredProvidersInRouteOrder,
  effectiveAiProviderOrder,
  isDefaultAiProviderOrder,
  resolveAiAttemptOrder,
  sanitizeAiDisabledProviders,
  sanitizeAiProviderOrder,
} from '../src/ai/catalog.js';
import {
  buildCatchMeUpPrompt,
  buildRefineDraftPrompt,
  buildReviseReplyPrompt,
  buildSuggestReplyPrompt,
  buildSummarizePrompt,
} from '../src/ai/skills.js';
import { extractOpenAiCompatibleText } from '../src/ai/openaiText.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

test('providers include Gemini, Grok, SambaNova, DeepSeek, Sarvam, OpenRouter, Anthropic', () => {
  for (const id of [
    'gemini',
    'grok',
    'sambanova',
    'deepseek',
    'sarvam',
    'openrouter',
    'anthropic',
  ]) {
    assert.ok(getAiProvider(id));
  }
  assert.equal(getAiProvider('anthropic').freeTierFriendly, false);
  assert.equal(getAiProvider('deepseek').defaultModel, 'deepseek-chat');
  assert.equal(getAiProvider('deepseek').freeTierFriendly, true);
  assert.equal(getAiProvider('sarvam').defaultModel, 'sarvam-30b');
  assert.equal(getAiProvider('sarvam').freeTierFriendly, true);
  assert.ok(getAiProvider('sarvam').models.includes('sarvam-105b'));
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

test('revise-reply prompt is re-exported from skills', () => {
  const prompt = buildReviseReplyPrompt({
    replyText: 'Sure, 3pm works.',
    language: 'hi',
    selectionText: 'Can we meet at 3pm?',
    appName: 'Arattai',
  });
  assert.match(prompt, /Sure, 3pm works/);
  assert.match(prompt, /Hindi/);
});

test('refine-draft prompt polishes send-box text in EN HI MR', () => {
  const prompt = buildRefineDraftPrompt({
    text: 'if you want any new features do suggest, it if tech permits it will be implemented',
    appName: 'Arattai',
  });
  assert.match(prompt, /new features do suggest/);
  assert.match(prompt, /Refine a message/);
  assert.match(prompt, /Arattai/);
  assert.match(prompt, /## English/);
  assert.match(prompt, /## Hindi/);
  assert.match(prompt, /## Marathi/);
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

test('AI provider try order is Gemini → Grok → SambaNova → DeepSeek → Sarvam → OpenRouter → Anthropic', () => {
  assert.deepEqual(aiProviderRouteOrder().map((p) => p.id), [
    'gemini',
    'grok',
    'sambanova',
    'deepseek',
    'sarvam',
    'openrouter',
    'anthropic',
  ]);
  assert.deepEqual(
    configuredProvidersInRouteOrder([
      'anthropic',
      'openrouter',
      'sarvam',
      'deepseek',
      'gemini',
      'grok',
    ]).map((p) => p.id),
    ['gemini', 'grok', 'deepseek', 'sarvam', 'openrouter', 'anthropic'],
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
  assert.equal(getAiProvider('deepseek').defaultModel, 'deepseek-chat');
  assert.equal(getAiProvider('sarvam').defaultModel, 'sarvam-30b');
});

test('Sarvam normalizes retired chat model ids', () => {
  assert.equal(normalizeSarvamModel('sarvam-m'), 'sarvam-30b');
  assert.equal(normalizeSarvamModel('sarvam-30b-16k'), 'sarvam-30b');
  assert.equal(normalizeSarvamModel('sarvam-105b-32k'), 'sarvam-105b');
  assert.equal(normalizeSarvamModel('sarvam-105b'), 'sarvam-105b');
  assert.equal(normalizeSarvamModel(''), 'sarvam-30b');
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

test('sanitizeAiProviderOrder fills defaults and drops unknowns', () => {
  assert.deepEqual(sanitizeAiProviderOrder([]), [...AI_PROVIDER_TRY_ORDER]);
  assert.deepEqual(sanitizeAiProviderOrder(null), [...AI_PROVIDER_TRY_ORDER]);
  assert.deepEqual(
    sanitizeAiProviderOrder(['sarvam', 'gemini', 'nope', 'gemini']),
    [
      'sarvam',
      'gemini',
      ...AI_PROVIDER_TRY_ORDER.filter((id) => id !== 'sarvam' && id !== 'gemini'),
    ],
  );
  assert.equal(isDefaultAiProviderOrder([]), true);
  assert.equal(isDefaultAiProviderOrder(['sarvam', 'gemini']), false);
  assert.deepEqual(sanitizeAiDisabledProviders(['sarvam', 'nope', 'sarvam']), [
    'sarvam',
  ]);
  assert.equal(aiProviderTryOrdinal(0), '1st');
  assert.equal(aiProviderTryOrdinal(1), '2nd');
  assert.equal(aiProviderTryOrdinal(2), '3rd');
  assert.equal(aiProviderTryOrdinal(3), '4th');
});

test('custom provider order and disables reshape failover', () => {
  const custom = ['sarvam', 'deepseek', 'gemini'];
  assert.deepEqual(
    effectiveAiProviderOrder({
      order: custom,
      disabledIds: ['gemini'],
      includeDisabled: false,
    }).slice(0, 3),
    ['sarvam', 'deepseek', 'grok'],
  );
  assert.deepEqual(
    configuredProvidersInRouteOrder(
      ['gemini', 'sarvam', 'deepseek', 'anthropic'],
      { order: custom, disabledIds: ['gemini'] },
    ).map((p) => p.id),
    ['sarvam', 'deepseek', 'anthropic'],
  );
  assert.deepEqual(
    resolveAiAttemptOrder({
      configuredIds: ['gemini', 'sarvam', 'deepseek'],
      order: ['deepseek', 'sarvam', 'gemini'],
      disabledIds: ['gemini'],
    }),
    ['deepseek', 'sarvam'],
  );
  // Single-provider mode: only Sarvam enabled.
  assert.deepEqual(
    resolveAiAttemptOrder({
      configuredIds: ['gemini', 'sarvam', 'anthropic'],
      order: AI_PROVIDER_TRY_ORDER,
      disabledIds: AI_PROVIDER_TRY_ORDER.filter((id) => id !== 'sarvam'),
    }),
    ['sarvam'],
  );
  assert.deepEqual(
    aiProviderRouteOrder({
      order: ['anthropic', 'gemini'],
    }).map((p) => p.id).slice(0, 2),
    ['anthropic', 'gemini'],
  );
});

test('extractOpenAiCompatibleText reads string and part-array content', () => {
  assert.equal(
    extractOpenAiCompatibleText({
      choices: [{ message: { content: '  Hello  ' } }],
    }),
    'Hello',
  );
  assert.equal(
    extractOpenAiCompatibleText({
      choices: [{
        message: {
          content: [
            { type: 'text', text: 'Part ' },
            { type: 'text', text: 'two' },
          ],
        },
      }],
    }),
    'Part two',
  );
  assert.equal(
    extractOpenAiCompatibleText({
      choices: [{
        message: {
          content: '',
          reasoning_content: 'thinking hard…',
        },
        finish_reason: 'length',
      }],
    }),
    '',
  );
  assert.equal(
    extractOpenAiCompatibleText({
      choices: [{ message: { content: null, output_text: 'Fallback answer' } }],
    }),
    'Fallback answer',
  );
});

test('Sarvam path disables reasoning and raises max_tokens', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/ai/service.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /provider\.id === 'sarvam'/);
  assert.match(src, /reasoning_effort:\s*null/);
  assert.match(src, /maxTokens:\s*4096/);
});
