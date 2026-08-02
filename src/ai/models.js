/**
 * Live model discovery for Aspera AI providers.
 * Fetch whatever the user's key can access — do not rely only on hardcoded IDs.
 */
import { AI_PROVIDERS, getAiProvider } from './catalog.js';

/** @type {Map<string, { at: number, models: { id: string, name: string }[] }>} */
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

export function invalidateAiModelCache(providerId = '') {
  const id = String(providerId || '').trim();
  if (!id) {
    cache.clear();
    return;
  }
  cache.delete(id);
}

export function getCachedAiModels(providerId) {
  const entry = cache.get(String(providerId || ''));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(String(providerId || ''));
    return null;
  }
  return entry.models;
}

function setCache(providerId, models) {
  cache.set(String(providerId), {
    at: Date.now(),
    models: models.map((m) => ({
      id: String(m.id),
      name: String(m.name || m.id),
    })),
  });
}

function stripModelsPrefix(id) {
  return String(id || '').replace(/^models\//, '').trim();
}

/** Heuristic: prefer fast/cheap chat models; push embeddings/image/audio down. */
export function scoreModelForWorkplace(modelId, providerId = '') {
  const m = String(modelId || '').toLowerCase();
  const provider = String(providerId || '');
  let score = 0;

  if (
    /embed|embedding|tts|whisper|audio|image|vision|imagen|veo|realtime|live|moderation|rerank/.test(
      m,
    )
  ) {
    score -= 500;
  }

  if (m.includes('flash-lite') || m.includes('flash_lite')) score += 120;
  else if (m.includes('lite') && !m.includes('pro')) score += 70;
  if (m.includes('flash')) score += 55;
  if (m.includes('haiku')) score += 110;
  if (m.includes('mini')) score += 80;
  if (m.includes('latest')) score += 25;
  if (m.includes('instruct')) score += 15;

  if (m.includes('opus')) score -= 40;
  if (/\bpro\b/.test(m) && !m.includes('flash')) score -= 15;
  if (m.includes('thinking') || m.includes('reason')) score -= 25;
  if (m.includes('preview') || m.includes('exp')) score -= 8;

  // OpenRouter free routes are fine but often slower — slight preference for named flash.
  if (provider === 'openrouter' && m.includes(':free')) score += 10;
  if (provider === 'openrouter' && m === 'openrouter/free') score -= 5;

  // SambaNova: prefer instruct chat models.
  if (provider === 'sambanova' && m.includes('llama')) score += 20;

  // DeepSeek: prefer fast chat over reasoner for workplace skills.
  if (provider === 'deepseek' && m === 'deepseek-chat') score += 40;
  if (provider === 'deepseek' && m.includes('reasoner')) score -= 10;

  // Sarvam: chat LLMs only — skip speech/translate model ids from /v1/models.
  if (provider === 'sarvam') {
    if (/^sarvam-30b\b/.test(m)) score += 45;
    else if (/^sarvam-105b\b/.test(m)) score += 25;
    else if (/^sarvam-m\b/.test(m)) score -= 20; // retired
    if (/saaras|saarika|bulbul|mayura|translate|translit|tts|stt/.test(m)) {
      score -= 500;
    }
  }

  return score;
}

export function rankModelIds(modelIds, providerId = '') {
  const unique = [...new Set((modelIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  return unique.sort((a, b) => {
    const diff =
      scoreModelForWorkplace(b, providerId) - scoreModelForWorkplace(a, providerId);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

export function pickBestModelId(modelIds, providerId = '') {
  const ranked = rankModelIds(modelIds, providerId);
  return ranked[0] || '';
}

/**
 * Build try-order: preferred (if set) first, then ranked live/catalog models.
 */
export function buildModelAttemptChain({
  providerId,
  preferred = '',
  liveIds = [],
  catalogIds = [],
} = {}) {
  const provider = getAiProvider(providerId);
  const catalog = (catalogIds.length ? catalogIds : provider.models || []).map(String);
  const live = (liveIds || []).map(String).filter(Boolean);
  const pool = live.length ? live : catalog;
  const ranked = rankModelIds(pool, provider.id);
  const pref = String(preferred || '').trim();
  const ordered = [];
  if (pref && pref !== 'auto') ordered.push(pref);
  for (const id of ranked) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  // Always keep catalog defaults as last-resort even when live list exists.
  for (const id of catalog) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  if (!ordered.length && provider.defaultModel) ordered.push(provider.defaultModel);
  return ordered;
}

export function isRetryableModelError(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('quota') ||
    m.includes('rate limit') ||
    m.includes('resource_exhausted') ||
    m.includes('limit: 0') ||
    m.includes('exceeded your current quota') ||
    m.includes('no longer available') ||
    m.includes('not available to new users') ||
    m.includes('not found') ||
    m.includes('is not found') ||
    m.includes('does not exist') ||
    m.includes('not supported') ||
    m.includes('unsupported model') ||
    m.includes('invalid model') ||
    m.includes('model_not_found') ||
    m.includes('unknown model') ||
    /\b404\b/.test(m) ||
    (m.includes('invalid') && m.includes('model'))
  );
}

async function listGeminiModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini list models HTTP ${res.status}`);
  }
  const models = [];
  for (const item of data?.models || []) {
    const methods = item?.supportedGenerationMethods || [];
    if (methods.length && !methods.includes('generateContent')) continue;
    const id = stripModelsPrefix(item.name || item.displayName || '');
    if (!id) continue;
    models.push({
      id,
      name: String(item.displayName || id),
    });
  }
  return models;
}

async function listOpenAiCompatibleModels(baseUrl, apiKey, extraHeaders = {}) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      (typeof data?.error === 'string' ? data.error : '') ||
      `List models HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  const raw = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return raw
    .map((item) => {
      const id = String(item?.id || item?.name || '').trim();
      if (!id) return null;
      return { id, name: String(item?.name || item?.id || id) };
    })
    .filter(Boolean);
}

async function listAnthropicModels(apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || {};
    throw new Error(
      err.message || data?.message || `Anthropic list models HTTP ${res.status}`,
    );
  }
  const raw = Array.isArray(data?.data) ? data.data : [];
  return raw
    .map((item) => {
      const id = String(item?.id || '').trim();
      if (!id) return null;
      return {
        id,
        name: String(item?.display_name || item?.id || id),
      };
    })
    .filter(Boolean);
}

/**
 * Fetch models the API key can use. Caches successful results.
 * On failure, returns catalog models (ok:false with fallback).
 */
export async function listAiProviderModels(providerId, apiKey, { force = false } = {}) {
  const provider = getAiProvider(providerId);
  const id = provider.id;
  if (!force) {
    const cached = getCachedAiModels(id);
    if (cached?.length) {
      return { ok: true, providerId: id, models: cached, source: 'cache' };
    }
  }

  const catalogModels = (provider.models || []).map((mid) => ({
    id: mid,
    name: mid,
  }));

  if (!apiKey) {
    return {
      ok: false,
      providerId: id,
      models: catalogModels,
      source: 'catalog',
      error: 'No API key',
    };
  }

  try {
    let models = [];
    if (id === 'gemini') {
      models = await listGeminiModels(apiKey);
    } else if (id === 'anthropic') {
      models = await listAnthropicModels(apiKey);
    } else if (id === 'grok') {
      models = await listOpenAiCompatibleModels('https://api.x.ai/v1', apiKey);
    } else if (id === 'sambanova') {
      models = await listOpenAiCompatibleModels('https://api.sambanova.ai/v1', apiKey);
    } else if (id === 'deepseek') {
      models = await listOpenAiCompatibleModels('https://api.deepseek.com/v1', apiKey);
    } else if (id === 'sarvam') {
      models = await listOpenAiCompatibleModels('https://api.sarvam.ai/v1', apiKey, {
        'api-subscription-key': apiKey,
      });
    } else if (id === 'openrouter') {
      models = await listOpenAiCompatibleModels('https://openrouter.ai/api/v1', apiKey, {
        'HTTP-Referer': 'https://asperahub.com',
        'X-Title': 'Aspera Hub',
      });
    } else {
      models = catalogModels;
    }

    // Dedupe + rank for UI.
    const byId = new Map();
    for (const m of models) {
      const mid = String(m.id || '').trim();
      if (!mid || byId.has(mid)) continue;
      byId.set(mid, { id: mid, name: String(m.name || mid) });
    }
    const rankedIds = rankModelIds([...byId.keys()], id);
    let ranked = rankedIds.map((mid) => byId.get(mid)).filter(Boolean);

    // OpenRouter returns thousands — keep a usable workplace-focused subset.
    if (id === 'openrouter' && ranked.length > 120) {
      ranked = ranked.slice(0, 120);
    }

    if (!ranked.length) {
      return {
        ok: false,
        providerId: id,
        models: catalogModels,
        source: 'catalog',
        error: 'Provider returned no chat models',
      };
    }

    setCache(id, ranked);
    return { ok: true, providerId: id, models: ranked, source: 'live' };
  } catch (error) {
    return {
      ok: false,
      providerId: id,
      models: catalogModels,
      source: 'catalog',
      error: String(error?.message || error),
    };
  }
}

/** Snapshot helpers for settings UI (cache + catalog). */
export function catalogModelsForProvider(providerId) {
  const provider = getAiProvider(providerId);
  return (provider.models || []).map((id) => ({ id, name: id }));
}

export function normalizeProviderModelChoice(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'auto') return 'auto';
  return raw;
}

/** Read per-provider model preference from settings object. */
export function getProviderModelPreference(settings, providerId) {
  const map =
    settings?.aiProviderModels && typeof settings.aiProviderModels === 'object'
      ? settings.aiProviderModels
      : {};
  const fromMap = normalizeProviderModelChoice(map[providerId]);
  if (fromMap !== 'auto') return fromMap;
  // Legacy single aiModel only applies to the active/default provider.
  const legacy = String(settings?.aiModel || '').trim();
  if (legacy && String(settings?.aiProvider || 'gemini') === String(providerId)) {
    return legacy;
  }
  return 'auto';
}

export function allProviderIds() {
  return AI_PROVIDERS.map((p) => p.id);
}
