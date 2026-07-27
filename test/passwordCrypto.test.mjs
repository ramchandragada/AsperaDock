import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  isLegacyPasswordHash,
} from '../src/passwordCrypto.js';

test('scrypt hash verifies and is not legacy', () => {
  const hashed = hashPassword('correct-horse');
  assert.match(hashed, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.equal(isLegacyPasswordHash(hashed), false);
  assert.equal(verifyPassword('correct-horse', hashed), true);
  assert.equal(verifyPassword('wrong', hashed), false);
});

test('legacy sha256 still verifies', () => {
  const legacy = crypto.createHash('sha256').update('legacy-pass').digest('hex');
  assert.equal(isLegacyPasswordHash(legacy), true);
  assert.equal(verifyPassword('legacy-pass', legacy), true);
  assert.equal(verifyPassword('nope', legacy), false);
});
