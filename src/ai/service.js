import {
  getAiProvider,
  normalizeAnthropicModel,
  normalizeGeminiModel,
  normalizeGrokModel,
  normalizeSarvamModel,
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
  buildRefineDraftPrompt,
  buildSuggestReplyPrompt,
  buildSummarizeAttachmentPrompt,
  buildSummarizePdfTextPrompt,
  buildSummarizePrompt,
} from './skills.js';
import { buildReviseReplyPrompt } from './replyEditor.js';
import { extractOpenAiCompatibleText } from './openaiText.js';

/** Providers that can accept image (and Gemini/OpenRouter often PDF) inline parts. */
const VISION_PROVIDER_IDS = new Set(['gemini', 'openrouter', 'anthropic', 'grok']);

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

function openAiUserContent(prompt, media) {
  if (!media?.base64 || !media?.mime) return prompt;
  // OpenAI-compatible vision: images via data URL. PDF usually unsupported here.
  if (media.kind === 'pdf') return prompt;
  return [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: `data:${media.mime};base64,${media.base64}` },
    },
  ];
}

async function callOpenAiCompatible({
  baseUrl,
  apiKey,
  model,
  prompt,
  media = null,
  extraHeaders = {},
  extraBody = {},
  maxTokens = 1600,
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
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: 'You are Aspera AI, a concise workplace assistant for employees.',
        },
        { role: 'user', content: openAiUserContent(prompt, media) },
      ],
      ...extraBody,
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
  const text = extractOpenAiCompatibleText(data);
  if (!text) {
    const finish = String(data?.choices?.[0]?.finish_reason || '');
    const hadReasoning = Boolean(
      String(data?.choices?.[0]?.message?.reasoning_content || '').trim(),
    );
    if (hadReasoning || finish === 'length') {
      throw new Error(
        'Empty response from provider (reasoning used up the token budget). Try again or pick another model.',
      );
    }
    throw new Error('Empty response from provider');
  }
  return text;
}

async function callGemini({ apiKey, model, prompt, media = null }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts = [];
  if (media?.base64 && media?.mime) {
    parts.push({
      inline_data: {
        mime_type: media.mime,
        data: media.base64,
      },
    });
  }
  parts.push({ text: prompt });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
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
  const outParts = data?.candidates?.[0]?.content?.parts || [];
  const text = outParts.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function callAnthropic({ apiKey, model, prompt, media = null }) {
  const resolved = normalizeAnthropicModel(model);
  let content = prompt;
  if (media?.base64 && media?.mime && media.kind === 'image') {
    content = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: media.mime,
          data: media.base64,
        },
      },
      { type: 'text', text: prompt },
    ];
  } else if (media?.kind === 'pdf') {
    throw new Error('Anthropic path does not accept PDF bytes — use text extract or Gemini.');
  }
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
      messages: [{ role: 'user', content }],
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
  if (providerId === 'sarvam') return normalizeSarvamModel(model);
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

async function callProviderWithModelChain(
  providerId,
  prompt,
  preferredOverride,
  media = null,
) {
  const provider = getAiProvider(providerId);
  const apiKey = getAiProviderKey(provider.id);
  if (!apiKey) {
    throw new Error(
      `Add your ${provider.name} API key in Settings → Aspera AI.`,
    );
  }

  if (media) {
    if (provider.id === 'anthropic' && media.kind === 'pdf') {
      throw new Error('Anthropic cannot take PDF bytes in Hub — use Gemini or extract text.');
    }
    if (
      (provider.id === 'sambanova' ||
        provider.id === 'deepseek' ||
        provider.id === 'sarvam') &&
      media.kind
    ) {
      throw new Error(
        `${provider.name} has no vision/PDF path in Hub — use Gemini or extract text.`,
      );
    }
    if (provider.id === 'grok' && media.kind === 'pdf') {
      throw new Error('Grok path in Hub accepts images, not PDF bytes.');
    }
    if (provider.id === 'openrouter' && media.kind === 'pdf') {
      // OpenRouter image_url path is image-only here; PDF goes through Gemini.
      throw new Error('OpenRouter PDF bytes not used — prefer Gemini or text extract.');
    }
  }

  const chain = await resolveModelChain(provider.id, preferredOverride);
  const errors = [];

  for (const rawModel of chain) {
    const model = normalizeChosenModel(provider.id, rawModel);
    if (!model) continue;
    try {
      let text = '';
      if (provider.id === 'gemini') {
        text = await callGemini({ apiKey, model, prompt, media });
      } else if (provider.id === 'anthropic') {
        text = await callAnthropic({ apiKey, model, prompt, media });
      } else if (provider.id === 'grok') {
        text = await callOpenAiCompatible({
          baseUrl: 'https://api.x.ai/v1',
          apiKey,
          model,
          prompt,
          media: media?.kind === 'image' ? media : null,
        });
      } else if (provider.id === 'sambanova') {
        text = await callOpenAiCompatible({
          baseUrl: 'https://api.sambanova.ai/v1',
          apiKey,
          model,
          prompt,
        });
      } else if (provider.id === 'deepseek') {
        text = await callOpenAiCompatible({
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey,
          model,
          prompt,
        });
      } else if (provider.id === 'sarvam') {
        // Prefer api-subscription-key (docs primary); Bearer also accepted.
        // Sarvam thinking is ON by default and can consume max_tokens before any
        // visible content (empty replies after a successful summarize). Disable
        // reasoning for workplace skills and allow a larger completion budget.
        text = await callOpenAiCompatible({
          baseUrl: 'https://api.sarvam.ai/v1',
          apiKey,
          model,
          prompt,
          maxTokens: 4096,
          extraHeaders: {
            'api-subscription-key': apiKey,
          },
          extraBody: {
            reasoning_effort: null,
          },
        });
      } else if (provider.id === 'openrouter') {
        text = await callOpenAiCompatible({
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey,
          model,
          prompt,
          media: media?.kind === 'image' ? media : null,
          extraHeaders: {
            'HTTP-Referer': 'https://asperahub.com',
            'X-Title': 'Aspera Hub',
          },
        });
      } else {
        throw new Error(`Unsupported AI provider: ${provider.id}`);
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
 * Behavior:
 * 1. Effective order = custom settings order (or default) minus disabled.
 * 2. Sticky last-success is tried first when still enabled/configured.
 * 3. On failure/exhaustion, try the next provider in order; within a provider,
 *    walk live/catalog models until one works.
 */
export async function runAiCompletionWithFailover(prompt, { media = null } = {}) {
  const settings = readAiSettings() || {};
  const providerOrder = settings.aiProviderOrder;
  const disabledIds = settings.aiDisabledProviders;
  const configured = listConfiguredAiProviderIds();
  let attemptIds = resolveAiAttemptOrder({
    configuredIds: configured,
    stickyId: stickyProviderId,
    exhaustedIds: [...exhaustedProviderIds],
    order: providerOrder,
    disabledIds,
  });
  if (media) {
    // Prefer vision-capable providers when sending file bytes.
    const visionFirst = attemptIds.filter((id) => VISION_PROVIDER_IDS.has(id));
    const rest = attemptIds.filter((id) => !VISION_PROVIDER_IDS.has(id));
    attemptIds = [...visionFirst, ...rest];
    if (media.kind === 'pdf') {
      // Only Gemini accepts PDF bytes in our client today.
      attemptIds = attemptIds.filter((id) => id === 'gemini');
    } else if (media.kind === 'image') {
      attemptIds = attemptIds.filter((id) => VISION_PROVIDER_IDS.has(id));
    }
  }
  if (!attemptIds.length) {
    const hasAnyKey = configured.length > 0;
    if (media?.kind === 'pdf') {
      throw new Error(
        'PDF vision needs a Gemini API key (or attach a text-extractable PDF). Add Gemini in Settings → Aspera AI.',
      );
    }
    if (media?.kind === 'image') {
      throw new Error(
        'Image summarize needs a vision-capable key (Gemini recommended). Add one in Settings → Aspera AI.',
      );
    }
    throw new Error(
      hasAnyKey
        ? 'All AI providers with saved keys are disabled. Enable at least one in Settings → Aspera AI → Failover order.'
        : 'Add at least one AI API key in Settings → Aspera AI (Gemini recommended for speed).',
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
      const result = await callProviderWithModelChain(
        provider.id,
        prompt,
        undefined,
        media,
      );
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
  if (skill === 'summarize-file-text') {
    return buildSummarizePdfTextPrompt(payload);
  }
  if (skill === 'summarize-attachment') {
    return buildSummarizeAttachmentPrompt(payload);
  }
  if (skill === 'suggest-reply') {
    return buildSuggestReplyPrompt(payload);
  }
  if (skill === 'refine') {
    return buildRefineDraftPrompt(payload);
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
