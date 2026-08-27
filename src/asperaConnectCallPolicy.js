/**
 * Pure helpers for Hub → Aspera Connect click-to-call (unit-testable).
 */
import { existsSync } from 'node:fs';
import { isPhoneDialUrl } from './guestNav.js';

export { isPhoneDialUrl };

export function connectBinaryCandidates(home = process.env.HOME || '') {
  return [
    '/usr/bin/aspera-connect',
    '/bin/aspera-connect',
    home ? `${home}/.local/bin/aspera-connect` : '',
  ].filter(Boolean);
}

export function telHelperCandidates(home = process.env.HOME || '') {
  return [
    home ? `${home}/.local/bin/aspera-tel` : '',
    '/usr/local/bin/aspera-tel',
  ].filter(Boolean);
}

/** @returns {string|null} */
export function resolveAsperaConnectBinary(home = process.env.HOME || '', exists = existsSync) {
  for (const p of connectBinaryCandidates(home)) {
    if (exists(p)) return p;
  }
  return null;
}

/** @returns {string|null} */
export function resolveAsperaTelHelper(home = process.env.HOME || '', exists = existsSync) {
  for (const p of telHelperCandidates(home)) {
    if (exists(p)) return p;
  }
  return null;
}

/**
 * Normalize tel:/callto:/raw into digits suitable for Connect CLI.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeDialTarget(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  try {
    if (/^(tel|callto):/i.test(s)) {
      const u = new URL(s);
      s = decodeURIComponent(u.pathname || u.href.replace(/^[^:]+:/, ''));
    }
  } catch {
    s = s.replace(/^(tel|callto):/i, '');
    try {
      s = decodeURIComponent(s);
    } catch {
      /* keep */
    }
  }
  s = s.split(/[?;#]/)[0] || '';
  s = s.replace(/[^\d+]/g, '');
  if (s.length < 3) return null;
  return s;
}
