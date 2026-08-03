/**
 * Encrypted fleet Bearer token for Zoho CRM cloud sync (main process only).
 */
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function fleetPath() {
  return path.join(app.getPath('userData'), 'zoho-crm-fleet.json');
}

function readBlob() {
  try {
    const raw = fs.readFileSync(fleetPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBlob(data) {
  const dir = path.dirname(fleetPath());
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(fleetPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
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

export function zohoCrmFleetStatus() {
  const blob = readBlob();
  return {
    hasFleetToken: hasEnc(blob.fleetToken),
  };
}

export function getZohoCrmFleetToken() {
  return decrypt(readBlob().fleetToken);
}

/**
 * Empty / "[configured]" leaves existing token unchanged.
 * @param {string} token
 */
export function setZohoCrmFleetToken(token) {
  const value = String(token || '').trim();
  if (!value || value === '[configured]') {
    return { ok: true, ...zohoCrmFleetStatus() };
  }
  const blob = readBlob();
  blob.fleetToken = encrypt(value);
  writeBlob(blob);
  return { ok: true, ...zohoCrmFleetStatus() };
}

export function clearZohoCrmFleetToken() {
  try {
    fs.unlinkSync(fleetPath());
  } catch {
    writeBlob({});
  }
  return { ok: true, hasFleetToken: false };
}
