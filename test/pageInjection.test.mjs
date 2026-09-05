import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPageInjectionEnabled,
  normalizeStylishHttpsUrl,
} from '../src/pageInjection.js';

test('isPageInjectionEnabled requires settings flag AND ASPERADOCK_ADMIN', () => {
  const prev = process.env.ASPERADOCK_ADMIN;
  try {
    delete process.env.ASPERADOCK_ADMIN;
    assert.equal(isPageInjectionEnabled({ allowPageInjection: true }), false);
    assert.equal(isPageInjectionEnabled({ allowPageInjection: false }), false);

    process.env.ASPERADOCK_ADMIN = '1';
    assert.equal(isPageInjectionEnabled({ allowPageInjection: true }), true);
    assert.equal(isPageInjectionEnabled({ allowPageInjection: false }), false);
    assert.equal(isPageInjectionEnabled({}), false);
  } finally {
    if (prev === undefined) delete process.env.ASPERADOCK_ADMIN;
    else process.env.ASPERADOCK_ADMIN = prev;
  }
});

test('normalizeStylishHttpsUrl allows only https', () => {
  assert.equal(normalizeStylishHttpsUrl(''), null);
  assert.equal(normalizeStylishHttpsUrl('http://evil.example/x.css'), null);
  assert.equal(normalizeStylishHttpsUrl('ftp://x'), null);
  assert.equal(
    normalizeStylishHttpsUrl('https://cdn.example/theme.css'),
    'https://cdn.example/theme.css',
  );
  assert.equal(normalizeStylishHttpsUrl('not a url'), null);
});
