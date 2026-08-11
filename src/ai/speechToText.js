/**
 * Speech-to-text for Aspera AI voice input.
 * Prefers Sarvam Saaras v3 (Indian languages); falls back to Gemini audio.
 */
import { Blob } from 'node:buffer';
import { getAiProviderKey, hasAiProviderKey } from './keys.js';
import { normalizeGeminiModel } from './catalog.js';
import {
  VOICE_MAX_DURATION_SEC,
  normalizeAudioMime,
  audioFileExtension,
} from './speechToTextUtil.js';

export { VOICE_MAX_DURATION_SEC, normalizeAudioMime, audioFileExtension };

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const MAX_BYTES = 10 * 1024 * 1024;

function parseSarvamError(data, status) {
  const err = data?.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    return String(err.message || err.code || JSON.stringify(err));
  }
  return String(data?.message || `Sarvam STT HTTP ${status}`);
}

export async function transcribeWithSarvam({ buffer, mime }) {
  const apiKey = getAiProviderKey('sarvam');
  if (!apiKey) {
    throw new Error('Add a Sarvam API key in Settings → Aspera AI for voice input.');
  }
  const normalized = normalizeAudioMime(mime);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: normalized }),
    audioFileExtension(normalized),
  );
  form.append('model', 'saaras:v3');
  form.append('mode', 'transcribe');

  const res = await fetch(SARVAM_STT_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseSarvamError(data, res.status));
  }
  const transcript = String(data?.transcript || '').trim();
  if (!transcript) {
    throw new Error(
      'Could not understand the recording — speak closer to the mic and try again.',
    );
  }
  return {
    transcript,
    providerId: 'sarvam',
    providerName: 'Sarvam AI',
    languageCode: data?.language_code || null,
  };
}

export async function transcribeWithGemini({ buffer, mime }) {
  const apiKey = getAiProviderKey('gemini');
  if (!apiKey) {
    throw new Error('Add a Gemini API key in Settings → Aspera AI for voice input.');
  }
  const normalized = normalizeAudioMime(mime);
  const model = normalizeGeminiModel('gemini-2.5-flash');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt =
    'Transcribe the spoken words in this audio accurately. Return ONLY the transcript in the original spoken language (English, Hindi, Marathi, or mixed). No labels, translation, or commentary.';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: normalized,
                data: buffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini STT HTTP ${res.status}`);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const transcript = parts
    .map((p) => p.text || '')
    .join('')
    .trim();
  if (!transcript) {
    throw new Error(
      'Could not understand the recording — speak closer to the mic and try again.',
    );
  }
  return {
    transcript,
    providerId: 'gemini',
    providerName: 'Google Gemini',
    languageCode: null,
  };
}

/**
 * @param {{ buffer: Buffer, mime?: string }} opts
 */
export async function transcribeAudio({ buffer, mime = 'audio/webm' }) {
  if (!buffer?.length) {
    throw new Error('No audio recorded.');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error(
      `Recording is too large — keep it under ${VOICE_MAX_DURATION_SEC} seconds.`,
    );
  }

  if (hasAiProviderKey('sarvam')) {
    try {
      return await transcribeWithSarvam({ buffer, mime });
    } catch (err) {
      if (hasAiProviderKey('gemini')) {
        const gemini = await transcribeWithGemini({ buffer, mime });
        return { ...gemini, sttFallback: String(err?.message || err) };
      }
      throw err;
    }
  }
  if (hasAiProviderKey('gemini')) {
    return transcribeWithGemini({ buffer, mime });
  }
  throw new Error(
    'Add a Sarvam or Gemini API key in Settings → Aspera AI for voice input.',
  );
}
