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
 * Gemini → Grok → SambaNova → OpenRouter → Anthropic.
 * Only providers with a saved key are tried; stop at the first success.
 */
export const AI_PROVIDER_TRY_ORDER = Object.freeze([
  'gemini',
  'grok',
  'sambanova',
  'openrouter',
  'anthropic',
]);

/**
 * BYOK providers for employees.
 * Anthropic is supported but not free-tier friendly — keep as optional paid key.
 */
export const AI_PROVIDERS = Object.freeze([
  {
    id: 'gemini',
    name: 'Google Gemini',
    freeTierFriendly: true,
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
    keyHint: 'AI Studio API key (aistudio.google.com)',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    freeTierFriendly: true,
    defaultModel: 'grok-2-latest',
    models: ['grok-2-latest', 'grok-3-mini'],
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
 * Always Gemini → Grok → SambaNova → OpenRouter → Anthropic among configured keys.
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
