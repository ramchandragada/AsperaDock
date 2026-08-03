import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedExternalUrl } from '../src/safeShellPolicy.js';

test('isAllowedExternalUrl allows http/https/mailto', () => {
  assert.equal(isAllowedExternalUrl('https://example.com/a'), true);
  assert.equal(isAllowedExternalUrl('http://example.com'), true);
  assert.equal(isAllowedExternalUrl('mailto:a@b.c'), true);
});

test('isAllowedExternalUrl rejects dangerous schemes', () => {
  assert.equal(isAllowedExternalUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('data:text/html,hi'), false);
  assert.equal(isAllowedExternalUrl(''), false);
  assert.equal(isAllowedExternalUrl('not-a-url'), false);
});
