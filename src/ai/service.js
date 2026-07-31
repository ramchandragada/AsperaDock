import {
  getAiProvider,
  normalizeAnthropicModel,
  resolveAiAttemptOrder,
} from './catalog.js';
import {
  getAiProviderKey,
  hasAiProviderKey,
  listConfiguredAiProviderIds,
} from './keys.js';
import {
  buildCatchMeUpPrompt,
  buildSuggestReplyPrompt,
  buildSummarizePrompt,
} from './skills.js';

/** Last provider that answered successfully — reuse until it fails/exhausts. */
let stickyProviderId = null;
/** Providers that failed this session — skip until app restart or key change. */
const exhaustedProviderIds = new Set();

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
      data?.error?.message || data?.message || `Provider HTTP ${res.status}`;
    throw new Error(msg);
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
    throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
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

export async function runAiCompletion({
  providerId,
  model,
  prompt,
}) {
  const provider = getAiProvider(providerId);
  const apiKey = getAiProviderKey(provider.id);
  if (!apiKey) {
    throw new Error(
      `Add your ${provider.name} API key in Settings → Aspera AI.`,
    );
  }
  const chosen = String(model || provider.defaultModel || '').trim();

  if (provider.id === 'gemini') {
    return callGemini({ apiKey, model: chosen, prompt });
  }
  if (provider.id === 'anthropic') {
    return callAnthropic({ apiKey, model: chosen, prompt });
  }
  if (provider.id === 'grok') {
    return callOpenAiCompatible({
      baseUrl: 'https://api.x.ai/v1',
      apiKey,
      model: chosen,
      prompt,
    });
  }
  if (provider.id === 'sambanova') {
    return callOpenAiCompatible({
      baseUrl: 'https://api.sambanova.ai/v1',
      apiKey,
      model: chosen,
      prompt,
    });
  }
  // openrouter (default fallback)
  return callOpenAiCompatible({
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey,
    model: chosen,
    prompt,
    extraHeaders: {
      'HTTP-Referer': 'https://asperahub.com',
      'X-Title': 'Aspera Hub',
    },
  });
}

/**
 * Call providers one at a time — never probe/scan other APIs first.
 *
 * Behavior (manual-like):
 * 1. If Gemini has a key and is not exhausted this session → call Gemini only.
 * 2. On success, stick to that provider for all later requests.
 * 3. On failure/exhaustion, mark it exhausted and try the next in order
 *    (Grok → SambaNova → OpenRouter → Anthropic).
 */
export async function runAiCompletionWithFailover(prompt) {
  // Lock onto Gemini as soon as a key exists (unless already exhausted this session).
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
    // Skip if key disappeared mid-session.
    if (!hasAiProviderKey(provider.id)) {
      exhaustedProviderIds.add(provider.id);
      if (stickyProviderId === provider.id) stickyProviderId = null;
      continue;
    }

    let model = provider.defaultModel;
    if (provider.id === 'openrouter' && model === 'openrouter/free') {
      model = 'google/gemini-2.0-flash-001';
    }

    try {
      // Single API call — do not touch other providers on success.
      const text = await runAiCompletion({
        providerId: provider.id,
        model,
        prompt,
      });
      stickyProviderId = provider.id;
      exhaustedProviderIds.delete(provider.id);
      return {
        text,
        providerId: provider.id,
        model,
        providerName: provider.name,
      };
    } catch (error) {
      const message = String(error?.message || error);
      errors.push(`${provider.name}: ${message}`);
      // Exhausted / failed → stop using this provider until restart or key change.
      exhaustedProviderIds.add(provider.id);
      if (stickyProviderId === provider.id) stickyProviderId = null;
      // Continue to the next provider only after this one failed.
    }
  }

  throw new Error(
    errors.length
      ? `All configured AI providers failed:\n${errors.join('\n')}`
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
  if (skill === 'catch-up') {
    return buildCatchMeUpPrompt(payload);
  }
  throw new Error('Unknown AI skill');
}
