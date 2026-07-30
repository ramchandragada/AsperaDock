import { getAiProvider } from './catalog.js';
import { getAiProviderKey } from './keys.js';
import { buildCatchMeUpPrompt, buildSummarizePrompt } from './skills.js';

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
      max_tokens: 1200,
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
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
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

export function promptForSkill(skill, payload) {
  if (skill === 'summarize') {
    return buildSummarizePrompt(payload);
  }
  if (skill === 'catch-up') {
    return buildCatchMeUpPrompt(payload);
  }
  throw new Error('Unknown AI skill');
}
