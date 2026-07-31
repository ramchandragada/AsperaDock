import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { AI_PROVIDERS } from './catalog.js';

function keysPath() {
  return path.join(app.getPath('userData'), 'ai-provider-keys.json');
}

function readBlob() {
  try {
    const raw = fs.readFileSync(keysPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBlob(data) {
  const dir = path.dirname(keysPath());
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(keysPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
}

function encrypt(plain) {
  const text = String(plain || '');
  if (!text) return '';
  if (safeStorage.isEncryptionAvailable()) {
    return {
      v: 1,
      enc: safeStorage.encryptString(text).toString('base64'),
    };
  }
  // Fallback when OS encryption is unavailable (rare headless) — still not sent to renderer.
  return { v: 0, enc: Buffer.from(text, 'utf8').toString('base64') };
}

function decrypt(entry) {
  if (!entry || typeof entry !== 'object' || !entry.enc) return '';
  try {
    if (entry.v === 1 && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(entry.enc, 'base64'));
    }
    return Buffer.from(entry.enc, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function listConfiguredAiProviders() {
  const blob = readBlob();
  return AI_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    freeTierFriendly: p.freeTierFriendly,
    defaultModel: p.defaultModel,
    models: p.models,
    keyHint: p.keyHint,
    configured: Boolean(decrypt(blob[p.id])),
  }));
}

/** Fast local check — does not decrypt; true if an encrypted key blob exists. */
export function hasAiProviderKey(providerId) {
  const id = String(providerId || '');
  if (!id) return false;
  const entry = readBlob()[id];
  return Boolean(entry && typeof entry === 'object' && entry.enc);
}

/** Configured provider ids in catalog order (presence only, no decrypt). */
export function listConfiguredAiProviderIds() {
  const blob = readBlob();
  return AI_PROVIDERS.map((p) => p.id).filter((id) => {
    const entry = blob[id];
    return Boolean(entry && typeof entry === 'object' && entry.enc);
  });
}

export function setAiProviderKey(providerId, apiKey) {
  const id = String(providerId || '');
  if (!AI_PROVIDERS.some((p) => p.id === id)) {
    return { ok: false, error: 'Unknown AI provider' };
  }
  const blob = readBlob();
  const key = String(apiKey || '').trim();
  if (!key || key === '[configured]') {
    return { ok: true, configured: Boolean(decrypt(blob[id])) };
  }
  blob[id] = encrypt(key);
  writeBlob(blob);
  return { ok: true, configured: true };
}

export function clearAiProviderKey(providerId) {
  const id = String(providerId || '');
  const blob = readBlob();
  delete blob[id];
  writeBlob(blob);
  return { ok: true, configured: false };
}

/** Main-process only — never expose to renderer. */
export function getAiProviderKey(providerId) {
  const blob = readBlob();
  return decrypt(blob[String(providerId || '')]);
}
