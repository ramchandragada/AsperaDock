import {
  getAiProvider,
  normalizeAnthropicModel,
  normalizeGeminiModel,
  normalizeGrokModel,
  resolveAiAttemptOrder,
} from './catalog.js';
import {
  getAiProviderKey,
  hasAiProviderKey,
  listConfiguredAiProviderIds,
} from './keys.js';
import {
  buildModelAttemptChain,
  getCachedAiModels,
  getProviderModelPreference,
  isRetryableModelError,
  listAiProviderModels,
  pickBestModelId,
} from './models.js';
import {
  buildCatchMeUpPrompt,
  buildSuggestReplyPrompt,
  buildSummarizePrompt,
} from './skills.js';
import { buildReviseReplyPrompt } from './replyEditor.js';

/** Last provider that answered successfully — reuse until it fails/exhausts. */
let stickyProviderId = null;
/** Providers that failed this session — skip until app restart or key change. */
const exhaustedProviderIds = new Set();

/** Optional settings reader injected from main (for per-provider model prefs). */
let readAiSettings = () => ({});

export function setAiSettingsReader(fn) {
  readAiSettings = typeof fn === 'function' ? fn : () => ({});
}

export function getStickyAiProviderId() {
  return stickyProviderId;
}

export function resetAiProviderSession({ preferGemini = true } = {}) {
  exhaustedProviderIds.clear();
  if (preferGemini && hasAiProviderKey('gemini')) {
    stickyProviderId = 'gemini';
  } else {
    stickyProviderId = null;
  }
}

export function onAiProviderKeyChanged(providerId, configured) {
  const id = String(providerId || '');
  if (!id) return;
  if (configured) {
    exhaustedProviderIds.delete(id);
    // Fresh Gemini key → lock onto Gemini immediately (manual-like).
    if (id === 'gemini') stickyProviderId = 'gemini';
    else if (!stickyProviderId) stickyProviderId = id;
    return;
  }
  exhaustedProviderIds.delete(id);
  if (stickyProviderId === id) stickyProviderId = null;
}

async function callOpenAiCompatible({
  baseUrl,
  apiKey,
  model,
  prompt,
  extraHeaders = {},
}) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 1600,
      messages: [
        {
          role: 'system',
          content: 'You are Aspera AI, a concise workplace assistant for employees.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.code ||
      (typeof data?.error === 'string' ? data.error : '') ||
      data?.message ||
      `Provider HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from provider');
  return String(text).trim();
}

async function callGemini({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1600 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.model = model;
    throw err;
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function callAnthropic({ apiKey, model, prompt }) {
  const resolved = normalizeAnthropicModel(model);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: resolved,
      max_tokens: 1600,
      temperature: 0.3,
      system: 'You are Aspera AI, a concise workplace assistant for employees.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || {};
    const detail =
      err.message ||
      (typeof err === 'string' ? err : '') ||
      data?.message ||
      '';
    const type = err.type ? ` (${err.type})` : '';
    throw new Error(
      detail
        ? `Anthropic${type}: ${detail}`
        : `Anthropic HTTP ${res.status} for model ${resolved}`,
    );
  }
  const text = (data?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

function normalizeChosenModel(providerId, model) {
  if (providerId === 'gemini') return normalizeGeminiModel(model);
  if (providerId === 'grok') return normalizeGrokModel(model);
  if (providerId === 'anthropic') return normalizeAnthropicModel(model);
  if (providerId === 'openrouter' && model === 'openrouter/free') {
    return 'google/gemini-flash-latest';
  }
  return String(model || '').trim();
}

async function resolveModelChain(providerId, preferredOverride) {
  const provider = getAiProvider(providerId);
  const apiKey = getAiProviderKey(provider.id);
  const settings = readAiSettings() || {};
  const preferredRaw =
    preferredOverride !== undefined && preferredOverride !== null
      ? String(preferredOverride || '').trim() || 'auto'
      : getProviderModelPreference(settings, provider.id);
  const preferred =
    preferredRaw === 'auto' ? '' : normalizeChosenModel(provider.id, preferredRaw);

  let live = getCachedAiModels(provider.id) || [];
  if (!live.length && apiKey) {
    const listed = await listAiProviderModels(provider.id, apiKey, { force: false });
    live = listed.models || [];
  }

  const liveIds = live.map((m) => m.id);
  return buildModelAttemptChain({
    providerId: provider.id,
    preferred,
    liveIds,
    catalogIds: provider.models || [],
  });
}

async function callProviderWithModelChain(providerId, prompt, preferredOverride) {
  const provider = getAiProvider(providerId);
  const apiKey = getAiProviderKey(provider.id);
  if (!apiKey) {
    throw new Error(
      `Add your ${provider.name} API key in Settings → Aspera AI.`,
    );
  }

  const chain = await resolveModelChain(provider.id, preferredOverride);
  const errors = [];

  for (const rawModel of chain) {
    const model = normalizeChosenModel(provider.id, rawModel);
    if (!model) continue;
    try {
      let text = '';
      if (provider.id === 'gemini') {
        text = await callGemini({ apiKey, model, prompt });
      } else if (provider.id === 'anthropic') {
        text = await callAnthropic({ apiKey, model, prompt });
      } else if (provider.id === 'grok') {
        text = await callOpenAiCompatible({
          baseUrl: 'https://api.x.ai/v1',
          apiKey,
          model,
          prompt,
        });
      } else if (provider.id === 'sambanova') {
        text = await callOpenAiCompatible({
          baseUrl: 'https://api.sambanova.ai/v1',
          apiKey,
          model,
          prompt,
        });
      } else {
        text = await callOpenAiCompatible({
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey,
          model,
          prompt,
          extraHeaders: {
            'HTTP-Referer': 'https://asperahub.com',
            'X-Title': 'Aspera Hub',
          },
        });
      }
      return { text, model, providerId: provider.id, providerName: provider.name };
    } catch (error) {
      const message = String(error?.message || error);
      errors.push(`${model}: ${message}`);
      if (!isRetryableModelError(message)) {
        throw error;
      }
      // Try next live/catalog model for this provider.
    }
  }

  throw new Error(
    errors.length
      ? `${provider.name} failed for available models:\n${errors.join('\n')}`
      : `${provider.name} unavailable`,
  );
}

export async function runAiCompletion({
  providerId,
  model,
  prompt,
}) {
  const result = await callProviderWithModelChain(
    providerId,
    prompt,
    model ? String(model) : undefined,
  );
  return result.text;
}

/**
 * Call providers one at a time — never probe/scan other APIs first.
 *
 * Behavior (manual-like):
 * 1. If Gemini has a key and is not exhausted this session → call Gemini only.
 * 2. On success, stick to that provider for all later requests.
 * 3. On failure/exhaustion, try next provider; within a provider, walk all
 *    live/catalog models until one works.
 */
export async function runAiCompletionWithFailover(prompt) {
  if (
    hasAiProviderKey('gemini') &&
    !exhaustedProviderIds.has('gemini') &&
    stickyProviderId !== 'gemini'
  ) {
    stickyProviderId = 'gemini';
  }

  const configured = listConfiguredAiProviderIds();
  const attemptIds = resolveAiAttemptOrder({
    configuredIds: configured,
    stickyId: stickyProviderId,
    exhaustedIds: [...exhaustedProviderIds],
  });
  if (!attemptIds.length) {
    throw new Error(
      'Add at least one AI API key in Settings → Aspera AI (Gemini recommended for speed).',
    );
  }

  const errors = [];
  for (const providerId of attemptIds) {
    const provider = getAiProvider(providerId);
    if (!hasAiProviderKey(provider.id)) {
      exhaustedProviderIds.add(provider.id);
      if (stickyProviderId === provider.id) stickyProviderId = null;
      continue;
    }

    try {
      const result = await callProviderWithModelChain(provider.id, prompt);
      stickyProviderId = provider.id;
      exhaustedProviderIds.delete(provider.id);
      return {
        text: result.text,
        providerId: provider.id,
        model: result.model,
        providerName: provider.name,
      };
    } catch (error) {
      const message = String(error?.message || error);
      errors.push(`${provider.name}: ${message}`);
      exhaustedProviderIds.add(provider.id);
      if (stickyProviderId === provider.id) stickyProviderId = null;
    }
  }

  const hint =
    !configured.includes('anthropic')
      ? '\n\nTip: This PC has no Anthropic key saved. Add one in Settings → Aspera AI (works on your other PC), or fix Gemini/Grok keys.'
      : '';
  throw new Error(
    errors.length
      ? `All configured AI providers failed:\n${errors.join('\n')}${hint}`
      : 'No AI provider available',
  );
}

export function promptForSkill(skill, payload) {
  if (skill === 'summarize') {
    return buildSummarizePrompt(payload);
  }
  if (skill === 'suggest-reply') {
    return buildSuggestReplyPrompt(payload);
  }
  if (skill === 'revise-reply') {
    return buildReviseReplyPrompt(payload);
  }
  if (skill === 'catch-up') {
    return buildCatchMeUpPrompt(payload);
  }
  throw new Error('Unknown AI skill');
}

export { pickBestModelId };
