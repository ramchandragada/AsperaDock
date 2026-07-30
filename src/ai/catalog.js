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

/**
 * Auto-routing order: free-tier friendly providers first (catalog order),
 * then other paid providers, Anthropic always last.
 * Optional preferredId is tried first when it has a key (faster for power users).
 */
export function aiProviderRouteOrder() {
  const free = [];
  const paid = [];
  let anthropic = null;
  for (const p of AI_PROVIDERS) {
    if (p.id === 'anthropic') {
      anthropic = p;
      continue;
    }
    if (p.freeTierFriendly) free.push(p);
    else paid.push(p);
  }
  return anthropic ? [...free, ...paid, anthropic] : [...free, ...paid];
}

/** Filter route order to providers that have a saved key (`configuredIds`). */
export function configuredProvidersInRouteOrder(configuredIds, preferredId) {
  const have = new Set(
    (configuredIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  );
  const base = aiProviderRouteOrder().filter((p) => have.has(p.id));
  const prefer = String(preferredId || '').trim();
  if (!prefer || !have.has(prefer)) return base;
  const preferred = base.find((p) => p.id === prefer);
  if (!preferred) return base;
  return [preferred, ...base.filter((p) => p.id !== prefer)];
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
