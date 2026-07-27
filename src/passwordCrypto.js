/** Pure password hashing — no Electron import (unit-testable). */
import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

/** Verify password. Supports legacy unsalted SHA-256 and scrypt$salt$hash. */
export function verifyPassword(password, stored) {
  if (!stored) return false;
  const value = String(password);
  const record = String(stored);
  if (record.startsWith('scrypt$')) {
    const parts = record.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    try {
      const derived = crypto.scryptSync(value, salt, 64, {
        N: 16384,
        r: 8,
        p: 1,
      });
      const expected = Buffer.from(hashHex, 'hex');
      if (expected.length !== derived.length) return false;
      return crypto.timingSafeEqual(expected, derived);
    } catch {
      return false;
    }
  }
  const legacy = crypto.createHash('sha256').update(value).digest('hex');
  try {
    const a = Buffer.from(legacy, 'hex');
    const b = Buffer.from(record, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return legacy === record;
  }
}

export function isLegacyPasswordHash(stored) {
  return Boolean(stored && !String(stored).startsWith('scrypt$'));
}
