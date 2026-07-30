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
    // OpenRouter model IDs look like "google/…" but traffic still goes to openrouter.ai
    defaultModel: 'openrouter/free',
    models: [
      'openrouter/free',
      'google/gemini-flash-latest',
      'google/gemma-4-26b-a4b-it:free',
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
    defaultModel: 'claude-3-5-haiku-latest',
    models: ['claude-3-5-haiku-latest', 'claude-sonnet-4-20250514'],
    keyHint: 'Paid console.anthropic.com key (not free-tier)',
  },
]);

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
