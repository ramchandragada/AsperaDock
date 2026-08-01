/** Apps where Aspera AI skills are allowed. */
export const AI_ALLOWED_APP_IDS = Object.freeze([
  'whatsapp',
  'arattai',
  'gmail',
  'zoho-mail',
]);

export const AI_LANGUAGES = Object.freeze([
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi (हिन्दी)' },
  { id: 'mr', label: 'Marathi (मराठी)' },
]);

/**
 * Fixed try order for speed (also UI order):
 * Gemini → Grok → SambaNova → DeepSeek → OpenRouter → Anthropic.
 * Only providers with a saved key are tried; stop at the first success.
 */
export const AI_PROVIDER_TRY_ORDER = Object.freeze([
  'gemini',
  'grok',
  'sambanova',
  'deepseek',
  'openrouter',
  'anthropic',
]);

/**
 * BYOK providers for employees.
 * `models` / `defaultModel` are seed fallbacks only — runtime prefers the live
 * model list returned by each provider for the user's API key.
 */
export const AI_PROVIDERS = Object.freeze([
  {
    id: 'gemini',
    name: 'Google Gemini',
    freeTierFriendly: true,
    // 2.5-flash-lite is blocked for many new AI Studio keys — use 3.1 Flash-Lite.
    defaultModel: 'gemini-3.1-flash-lite',
    models: [
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ],
    keyHint: 'AI Studio API key (aistudio.google.com)',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    freeTierFriendly: true,
    // grok-2-latest is retired and returns HTTP 400 on many keys.
    defaultModel: 'grok-4.5',
    models: ['grok-4.5', 'grok-4.3', 'grok-3-mini'],
    keyHint: 'console.x.ai API key',
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    freeTierFriendly: true,
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    models: ['Meta-Llama-3.3-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct'],
    keyHint: 'cloud.sambanova.ai API key',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    freeTierFriendly: true,
    // OpenAI-compatible API — deepseek-chat is the fast workplace default.
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'platform.deepseek.com API key',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    freeTierFriendly: true,
    // Prefer a fast Flash model — openrouter/free often queues and feels very slow.
    defaultModel: 'google/gemini-2.0-flash-001',
    models: [
      'google/gemini-2.0-flash-001',
      'google/gemini-flash-latest',
      'google/gemma-4-26b-a4b-it:free',
      'openrouter/free',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    keyHint: 'openrouter.ai keys — model IDs may say google/… but still use OpenRouter',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    freeTierFriendly: false,
    defaultModel: 'claude-haiku-4-5',
    models: [
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-sonnet-4-5',
    ],
    keyHint: 'Paid console.anthropic.com key (not free-tier)',
  },
]);

/** Map retired / mistyped Grok model ids to current xAI API ids. */
export function normalizeGrokModel(model) {
  const raw = String(model || '').trim();
  const map = {
    'grok-2-latest': 'grok-4.5',
    'grok-2': 'grok-4.5',
    'grok-beta': 'grok-4.5',
    'grok-3': 'grok-4.3',
    'grok-3-mini': 'grok-4.3',
    'grok-3-mini-fast': 'grok-4.3',
  };
  return map[raw] || raw || 'grok-4.5';
}

/** Map retired Gemini model ids; prefer free-tier-friendly 3.1 Flash-Lite. */
export function normalizeGeminiModel(model) {
  const raw = String(model || '').trim();
  const map = {
    'gemini-pro': 'gemini-3.1-flash-lite',
    'gemini-1.5-flash': 'gemini-3.1-flash-lite',
    'gemini-1.5-pro': 'gemini-3.1-flash-lite',
    'gemini-2.0-flash': 'gemini-3.1-flash-lite',
    'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
    'gemini-2.0-flash-001': 'gemini-3.1-flash-lite',
    // Blocked for many new AI Studio keys ("no longer available to new users").
    'gemini-2.5-flash-lite': 'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite-preview-06-17': 'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite-preview-09-2025': 'gemini-3.1-flash-lite',
  };
  if (!raw) return 'gemini-3.1-flash-lite';
  return map[raw] || raw;
}

/** Candidate Gemini models to try when one hits quota limit: 0 / 429. */
export function geminiModelFallbackChain(preferred) {
  const start = normalizeGeminiModel(preferred);
  const gemini = AI_PROVIDERS.find((p) => p.id === 'gemini');
  const catalog = gemini?.models || [];
  const ordered = [start, ...catalog.filter((m) => m !== start)];
  return [...new Set(ordered)];
}

/** Map retired / mistyped model ids to current Anthropic API ids. */
export function normalizeAnthropicModel(model) {
  const raw = String(model || '').trim();
  const map = {
    'claude-3-5-haiku-latest': 'claude-haiku-4-5',
    'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
    'claude-3-haiku-20240307': 'claude-haiku-4-5',
    'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
    'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
    'claude-3-5-sonnet-20240620': 'claude-sonnet-4-6',
    'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
    'claude-3-opus-20240229': 'claude-opus-4-6',
  };
  return map[raw] || raw || 'claude-haiku-4-5';
}

/** Providers in fixed try order (Gemini first … Anthropic last). */
export function aiProviderRouteOrder() {
  return AI_PROVIDER_TRY_ORDER.map((id) =>
    AI_PROVIDERS.find((p) => p.id === id),
  ).filter(Boolean);
}

/**
 * Filter route order to providers that have a saved key.
 * Always Gemini → Grok → SambaNova → DeepSeek → OpenRouter → Anthropic among configured keys.
 */
export function configuredProvidersInRouteOrder(configuredIds) {
  const have = new Set(
    (configuredIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  );
  return aiProviderRouteOrder().filter((p) => have.has(p.id));
}

/**
 * Decide which providers to attempt this request (ids only — no API calls).
 * Sticky provider is tried first when still configured and not exhausted;
 * otherwise start at Gemini (or first available in fixed order).
 * Later providers are only used after the active one fails.
 */
export function resolveAiAttemptOrder({
  configuredIds,
  stickyId = null,
  exhaustedIds = [],
} = {}) {
  const order = configuredProvidersInRouteOrder(configuredIds).map((p) => p.id);
  const exhausted = new Set(
    (exhaustedIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  );
  const available = order.filter((id) => !exhausted.has(id));
  if (!available.length) return [];

  const sticky = String(stickyId || '').trim();
  if (sticky && available.includes(sticky)) {
    const stickyIndex = order.indexOf(sticky);
    return [
      sticky,
      ...available.filter(
        (id) => id !== sticky && order.indexOf(id) > stickyIndex,
      ),
    ];
  }

  return available;
}

export function getAiProvider(id) {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

export function isAiAllowedAppId(appId) {
  return AI_ALLOWED_APP_IDS.includes(String(appId || ''));
}

export function languageInstruction(langId) {
  if (langId === 'hi') {
    return 'Write the entire response in Hindi (हिन्दी), using Devanagari script. Keep names and URLs as-is.';
  }
  if (langId === 'mr') {
    return 'Write the entire response in Marathi (मराठी), using Devanagari script. Keep names and URLs as-is.';
  }
  return 'Write the entire response in clear professional English.';
}
