/**
 * Encrypted Zoho CRM OAuth secrets (main process only).
 * Mirrors src/ai/keys.js — never send plaintext to the renderer.
 */
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { resolveZohoCrmDc } from './dc.js';

const SECRET_FIELDS = ['clientId', 'clientSecret', 'refreshToken'];

function authPath() {
  return path.join(app.getPath('userData'), 'zoho-crm-oauth.json');
}

function readBlob() {
  try {
    const raw = fs.readFileSync(authPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBlob(data) {
  const dir = path.dirname(authPath());
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(authPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
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

function hasEnc(entry) {
  return Boolean(entry && typeof entry === 'object' && entry.enc);
}

/** Fast presence check — does not decrypt. */
export function hasZohoCrmAuth() {
  const blob = readBlob();
  return (
    hasEnc(blob.clientId) &&
    hasEnc(blob.clientSecret) &&
    hasEnc(blob.refreshToken)
  );
}

/** Status for Settings UI (no secrets). */
export function zohoCrmAuthStatus() {
  const blob = readBlob();
  return {
    configured: hasZohoCrmAuth(),
    hasClientId: hasEnc(blob.clientId),
    hasClientSecret: hasEnc(blob.clientSecret),
    hasRefreshToken: hasEnc(blob.refreshToken),
    apiDomain: String(blob.apiDomain || '') || null,
    accountsUrl: String(blob.accountsUrl || '') || null,
  };
}

/**
 * Main-process only. Returns plaintext credentials + resolved DC URLs.
 * @param {{ dcId?: string }} [opts]
 */
export function getZohoCrmAuth(opts = {}) {
  const blob = readBlob();
  const dc = resolveZohoCrmDc(opts.dcId || blob.dcId || 'in');
  return {
    clientId: decrypt(blob.clientId),
    clientSecret: decrypt(blob.clientSecret),
    refreshToken: decrypt(blob.refreshToken),
    apiDomain: String(blob.apiDomain || '').trim() || dc.apiDomain,
    accountsUrl: String(blob.accountsUrl || '').trim() || dc.accountsUrl,
    crmHost: dc.crmHost,
    dcId: dc.id,
  };
}

/**
 * Patch secrets. Empty / "[configured]" leaves an existing field unchanged.
 * @param {Record<string, string>} patch
 */
export function setZohoCrmAuth(patch = {}) {
  const blob = readBlob();
  const next = { ...blob };

  for (const field of SECRET_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const value = String(patch[field] || '').trim();
    if (!value || value === '[configured]') continue;
    next[field] = encrypt(value);
  }

  if (patch.apiDomain != null) {
    const apiDomain = String(patch.apiDomain || '').trim();
    if (apiDomain) next.apiDomain = apiDomain;
  }
  if (patch.accountsUrl != null) {
    const accountsUrl = String(patch.accountsUrl || '').trim();
    if (accountsUrl) next.accountsUrl = accountsUrl;
  }
  if (patch.dcId != null) {
    next.dcId = String(patch.dcId || '').trim() || 'in';
  }

  writeBlob(next);
  return { ok: true, ...zohoCrmAuthStatus() };
}

export function clearZohoCrmAuth() {
  try {
    fs.unlinkSync(authPath());
  } catch {
    writeBlob({});
  }
  return { ok: true, configured: false };
}
