/** Apps where Aspera AI skills are allowed. */
export const AI_ALLOWED_APP_IDS = Object.freeze([
  'whatsapp',
  'arattai',
  'gmail',
  'zoho-mail',
]);

/**
 * Full Aspera AI language catalog.
 * English is always included in Summarize / Refine / Suggest reply.
 * Extras (max 2) are chosen in Settings from AI_EXTRA_LANGUAGE_IDS.
 */
export const AI_LANGUAGE_CATALOG = Object.freeze([
  {
    id: 'en',
    short: 'EN',
    name: 'English',
    native: 'English',
    script: 'Latin script',
  },
  {
    id: 'hi',
    short: 'HI',
    name: 'Hindi',
    native: 'हिन्दी',
    script: 'Devanagari script',
  },
  {
    id: 'mr',
    short: 'MR',
    name: 'Marathi',
    native: 'मराठी',
    script: 'Devanagari script',
  },
  {
    id: 'bn',
    short: 'BN',
    name: 'Bengali',
    native: 'বাংলা',
    script: 'Bengali script',
  },
  {
    id: 'te',
    short: 'TE',
    name: 'Telugu',
    native: 'తెలుగు',
    script: 'Telugu script',
  },
  {
    id: 'ta',
    short: 'TA',
    name: 'Tamil',
    native: 'தமிழ்',
    script: 'Tamil script',
  },
  {
    id: 'gu',
    short: 'GU',
    name: 'Gujarati',
    native: 'ગુજરાતી',
    script: 'Gujarati script',
  },
  {
    id: 'kn',
    short: 'KN',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    script: 'Kannada script',
  },
  {
    id: 'or',
    short: 'OR',
    name: 'Odia',
    native: 'ଓଡ଼ିଆ',
    script: 'Odia script',
  },
  {
    id: 'ml',
    short: 'ML',
    name: 'Malayalam',
    native: 'മലയാളം',
    script: 'Malayalam script',
  },
]);

/** Selectable extras for multi-language skills (English is always on). */
export const AI_EXTRA_LANGUAGE_IDS = Object.freeze(
  AI_LANGUAGE_CATALOG.filter((l) => l.id !== 'en').map((l) => l.id),
);

/** Preserve today’s EN+HI+MR behavior for existing installs. */
export const AI_DEFAULT_EXTRA_LANGUAGES = Object.freeze(['hi', 'mr']);

export const AI_MAX_EXTRA_LANGUAGES = 2;

/** Catch me up + settings lists — every supported language. */
export const AI_LANGUAGES = Object.freeze(
  AI_LANGUAGE_CATALOG.map((lang) => ({
    id: lang.id,
    label: aiLanguageLabel(lang),
    short: lang.short,
    name: lang.name,
    native: lang.native,
  })),
);

function aiLanguageLabel(lang) {
  if (!lang) return 'English';
  if (lang.id === 'en') return 'English';
  return `${lang.name} (${lang.native})`;
}

export function getAiLanguage(id) {
  const key = String(id || '').trim().toLowerCase();
  return AI_LANGUAGE_CATALOG.find((l) => l.id === key) || AI_LANGUAGE_CATALOG[0];
}

export function isAiExtraLanguageId(id) {
  return AI_EXTRA_LANGUAGE_IDS.includes(String(id || '').trim().toLowerCase());
}

/**
 * Normalize extras: unique, valid Indic ids only, max 2, never English.
 * `undefined`/`null` → default Hindi+Marathi (migration).
 * Explicit `[]` stays empty (English-only output).
 */
export function sanitizeAiExtraLanguages(raw) {
  if (raw === undefined || raw === null) {
    return [...AI_DEFAULT_EXTRA_LANGUAGES];
  }
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const id = String(item || '').trim().toLowerCase();
    if (!isAiExtraLanguageId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= AI_MAX_EXTRA_LANGUAGES) break;
  }
  return out;
}

/** Ordered output languages: English first, then extras. */
export function resolveAiOutputLanguages(extraIds) {
  const extras = sanitizeAiExtraLanguages(
    extraIds === undefined ? AI_DEFAULT_EXTRA_LANGUAGES : extraIds,
  );
  return [getAiLanguage('en'), ...extras.map((id) => getAiLanguage(id))];
}

export function aiOutputLanguageMeta(languages) {
  const list =
    Array.isArray(languages) && languages.length
      ? languages
      : resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES);
  return list.map((l) => l.short || getAiLanguage(l.id).short).join(' · ');
}

export function aiLanguageHeading(lang, { replies = false } = {}) {
  const L = typeof lang === 'string' ? getAiLanguage(lang) : lang || getAiLanguage('en');
  if (L.id === 'en') return replies ? '## English replies' : '## English';
  return replies
    ? `## ${L.name} replies (${L.native})`
    : `## ${L.name} (${L.native})`;
}

export function languageSectionFor(lang, { replies = false } = {}) {
  const L = typeof lang === 'string' ? getAiLanguage(lang) : lang || getAiLanguage('en');
  const summaryHeading = aiLanguageHeading(L, { replies: false });
  const repliesHeading = aiLanguageHeading(L, { replies: true });
  return {
    id: L.id,
    short: L.short,
    name: L.name,
    native: L.native,
    script: L.script,
    label: aiLanguageLabel(L),
    // `heading` matches the skill context (refine/summarize vs suggest-reply).
    heading: replies ? repliesHeading : summaryHeading,
    repliesHeading,
    summaryHeading,
  };
}

export function refineSectionsForLanguages(languages) {
  const list =
    Array.isArray(languages) && languages.length
      ? languages.map((l) => getAiLanguage(l.id || l))
      : resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES);
  return list.map((l) => languageSectionFor(l, { replies: false }));
}

export function replySectionsForLanguages(languages) {
  const list =
    Array.isArray(languages) && languages.length
      ? languages.map((l) => getAiLanguage(l.id || l))
      : resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES);
  return list.map((l) => languageSectionFor(l, { replies: true }));
}

export function scriptInstructionsForLanguages(languages) {
  const list =
    Array.isArray(languages) && languages.length
      ? languages.map((l) => getAiLanguage(l.id || l))
      : resolveAiOutputLanguages(AI_DEFAULT_EXTRA_LANGUAGES);
  const parts = list
    .filter((l) => l.id !== 'en')
    .map((l) => `${l.name}: ${l.script}`);
  if (!parts.length) {
    return 'English uses Latin script. Keep names/amounts/dates/URLs as-is.';
  }
  return `Use the correct native script for each language (${parts.join('; ')}). English uses Latin. Keep names/amounts/dates/URLs as-is.`;
}

export function promptHeadingsBlock(languages, { replies = false } = {}) {
  const sections = replies
    ? replySectionsForLanguages(languages)
    : refineSectionsForLanguages(languages);
  const n = sections.length;
  const countWord =
    n === 1 ? 'ONE language' : n === 2 ? 'TWO languages' : `${n} languages`;
  return [
    `Produce output in ${countWord} with these exact headings, in order:`,
    ...sections.map((s) => s.heading),
  ].join('\n');
}

/**
 * Fixed try order for speed (also UI order):
 * Gemini → Sarvam → Grok → DeepSeek → SambaNova → OpenRouter → Anthropic.
 * Only providers with a saved key are tried; stop at the first success.
 */
export const AI_PROVIDER_TRY_ORDER = Object.freeze([
  'gemini',
  'sarvam',
  'grok',
  'deepseek',
  'sambanova',
  'openrouter',
  'anthropic',
]);

/** Prior shipped defaults — upgraded to current default when still on these. */
export const AI_PROVIDER_TRY_ORDER_LEGACY = Object.freeze([
  Object.freeze([
    'gemini',
    'grok',
    'sambanova',
    'deepseek',
    'sarvam',
    'openrouter',
    'anthropic',
  ]),
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
    id: 'sarvam',
    name: 'Sarvam AI',
    freeTierFriendly: true,
    // Indic LLMs — OpenAI-compatible chat at api.sarvam.ai (sarvam-m retired).
    defaultModel: 'sarvam-30b',
    models: ['sarvam-30b', 'sarvam-105b'],
    keyHint: 'dashboard.sarvam.ai API key (api-subscription-key)',
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

/** Map retired Sarvam chat model ids to current API ids. */
export function normalizeSarvamModel(model) {
  const raw = String(model || '').trim();
  const map = {
    'sarvam-m': 'sarvam-30b',
    'sarvam-m-v1': 'sarvam-30b',
    'sarvam-30b-16k': 'sarvam-30b',
    'sarvam-105b-32k': 'sarvam-105b',
  };
  return map[raw] || raw || 'sarvam-30b';
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

/** Known provider ids from the catalog. */
export function knownAiProviderIds() {
  return AI_PROVIDERS.map((p) => p.id);
}

/**
 * Sanitize a user/custom provider order.
 * Keeps known ids (deduped), then appends any missing defaults so the list is complete.
 * Empty/invalid input → default `AI_PROVIDER_TRY_ORDER`.
 * Exact matches of a prior shipped default are upgraded to the current default
 * so product order changes apply unless the user customized the sequence.
 */
export function sanitizeAiProviderOrder(raw) {
  const known = new Set(knownAiProviderIds());
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(raw) ? raw : []) {
    const s = String(id || '').trim();
    if (!known.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  for (const id of AI_PROVIDER_TRY_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  for (const prior of AI_PROVIDER_TRY_ORDER_LEGACY) {
    if (
      out.length === prior.length &&
      out.every((id, i) => id === prior[i])
    ) {
      return [...AI_PROVIDER_TRY_ORDER];
    }
  }
  return out;
}

/** Sanitize disabled-provider ids (opt-out list). Unknown ids dropped. */
export function sanitizeAiDisabledProviders(raw) {
  const known = new Set(knownAiProviderIds());
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(raw) ? raw : []) {
    const s = String(id || '').trim();
    if (!known.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** True when order matches the built-in default sequence. */
export function isDefaultAiProviderOrder(order) {
  const normalized = sanitizeAiProviderOrder(order);
  if (normalized.length !== AI_PROVIDER_TRY_ORDER.length) return false;
  return normalized.every((id, i) => id === AI_PROVIDER_TRY_ORDER[i]);
}

/**
 * Full provider list in effective try order (custom or default),
 * optionally omitting disabled ids when `includeDisabled` is false.
 */
export function effectiveAiProviderOrder({
  order = null,
  disabledIds = [],
  includeDisabled = true,
} = {}) {
  const sequence = sanitizeAiProviderOrder(order);
  const disabled = new Set(sanitizeAiDisabledProviders(disabledIds));
  if (includeDisabled) return sequence;
  return sequence.filter((id) => !disabled.has(id));
}

/** Providers in effective try order (objects). Defaults to built-in order. */
export function aiProviderRouteOrder({ order = null, disabledIds = [] } = {}) {
  return effectiveAiProviderOrder({ order, disabledIds, includeDisabled: true })
    .map((id) => AI_PROVIDERS.find((p) => p.id === id))
    .filter(Boolean);
}

/**
 * Filter route order to providers that have a saved key and are not disabled.
 * Respects custom `order` / `disabledIds` from settings when provided.
 */
export function configuredProvidersInRouteOrder(
  configuredIds,
  { order = null, disabledIds = [] } = {},
) {
  const have = new Set(
    (configuredIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  );
  return effectiveAiProviderOrder({
    order,
    disabledIds,
    includeDisabled: false,
  })
    .filter((id) => have.has(id))
    .map((id) => AI_PROVIDERS.find((p) => p.id === id))
    .filter(Boolean);
}

/**
 * Decide which providers to attempt this request (ids only — no API calls).
 * Sticky provider is tried first when still configured/enabled and not exhausted;
 * otherwise start at the first available in the effective order.
 * Later providers are only used after the active one fails.
 */
export function resolveAiAttemptOrder({
  configuredIds,
  stickyId = null,
  exhaustedIds = [],
  order = null,
  disabledIds = [],
} = {}) {
  const route = configuredProvidersInRouteOrder(configuredIds, {
    order,
    disabledIds,
  }).map((p) => p.id);
  const exhausted = new Set(
    (exhaustedIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  );
  const available = route.filter((id) => !exhausted.has(id));
  if (!available.length) return [];

  const sticky = String(stickyId || '').trim();
  if (sticky && available.includes(sticky)) {
    const stickyIndex = route.indexOf(sticky);
    return [
      sticky,
      ...available.filter(
        (id) => id !== sticky && route.indexOf(id) > stickyIndex,
      ),
    ];
  }

  return available;
}

/** Ordinal label for UI badges (1st, 2nd, …). */
export function aiProviderTryOrdinal(index) {
  const n = Number(index) + 1;
  if (!Number.isFinite(n) || n < 1) return '';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function getAiProvider(id) {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

export function isAiAllowedAppId(appId) {
  return AI_ALLOWED_APP_IDS.includes(String(appId || ''));
}

export function languageInstruction(langId) {
  const lang = getAiLanguage(langId);
  if (lang.id === 'en') {
    return 'Write the entire response in clear professional English.';
  }
  return `Write the entire response in ${lang.name} (${lang.native}), using ${lang.script}. Keep names and URLs as-is.`;
}

export { aiLanguageLabel };
