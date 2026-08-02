import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModelAttemptChain,
  getProviderModelPreference,
  isRetryableModelError,
  pickBestModelId,
  rankModelIds,
  scoreModelForWorkplace,
} from '../src/ai/models.js';

test('scoreModelForWorkplace prefers flash-lite / haiku over opus', () => {
  assert.ok(
    scoreModelForWorkplace('gemini-3.1-flash-lite', 'gemini') >
      scoreModelForWorkplace('gemini-2.5-pro', 'gemini'),
  );
  assert.ok(
    scoreModelForWorkplace('claude-haiku-4-5', 'anthropic') >
      scoreModelForWorkplace('claude-opus-4-6', 'anthropic'),
  );
  assert.ok(scoreModelForWorkplace('text-embedding-004', 'gemini') < 0);
});

test('rankModelIds puts best workplace models first', () => {
  const ranked = rankModelIds(
    [
      'gemini-2.5-pro',
      'text-embedding-004',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ],
    'gemini',
  );
  assert.equal(ranked[0], 'gemini-3.1-flash-lite');
  assert.ok(ranked.indexOf('text-embedding-004') > ranked.indexOf('gemini-flash-latest'));
});

test('buildModelAttemptChain puts preferred first then ranked live', () => {
  const chain = buildModelAttemptChain({
    providerId: 'gemini',
    preferred: 'gemini-2.5-flash',
    liveIds: ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'],
    catalogIds: ['gemini-3.1-flash-lite'],
  });
  assert.equal(chain[0], 'gemini-2.5-flash');
  assert.ok(chain.includes('gemini-3.1-flash-lite'));
  assert.ok(chain.includes('gemini-flash-latest'));
});

test('pickBestModelId chooses a lite/flash model', () => {
  assert.equal(
    pickBestModelId(
      ['claude-opus-4-6', 'claude-haiku-4-5', 'claude-sonnet-4-6'],
      'anthropic',
    ),
    'claude-haiku-4-5',
  );
});

test('Sarvam scoring prefers chat LLMs over speech models', () => {
  assert.ok(
    scoreModelForWorkplace('sarvam-30b', 'sarvam') >
      scoreModelForWorkplace('sarvam-105b', 'sarvam'),
  );
  assert.ok(
    scoreModelForWorkplace('sarvam-30b', 'sarvam') >
      scoreModelForWorkplace('saaras:v3', 'sarvam'),
  );
  assert.equal(
    pickBestModelId(['bulbul:v3', 'sarvam-105b', 'sarvam-30b', 'saaras:v3'], 'sarvam'),
    'sarvam-30b',
  );
});

test('isRetryableModelError covers retired and missing models', () => {
  assert.equal(
    isRetryableModelError(
      'This model models/gemini-2.5-flash-lite is no longer available to new users',
    ),
    true,
  );
  assert.equal(isRetryableModelError('model_not_found'), true);
  assert.equal(isRetryableModelError('API key is invalid'), false);
});

test('getProviderModelPreference reads per-provider map and legacy aiModel', () => {
  assert.equal(
    getProviderModelPreference(
      { aiProviderModels: { gemini: 'gemini-flash-latest' } },
      'gemini',
    ),
    'gemini-flash-latest',
  );
  assert.equal(
    getProviderModelPreference(
      { aiProvider: 'gemini', aiModel: 'gemini-2.5-flash' },
      'gemini',
    ),
    'gemini-2.5-flash',
  );
  assert.equal(
    getProviderModelPreference({ aiProviderModels: {} }, 'grok'),
    'auto',
  );
});
