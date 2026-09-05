import test from 'node:test';
import assert from 'node:assert/strict';
import { clampAppName } from '../src/services.js';

function tabNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '');
    const parts = host.split('.').filter(Boolean);
    let raw = parts[0] || 'Link';
    if (parts.length >= 2 && raw.length <= 2) raw = parts[1];
    const label = String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
    return clampAppName(label || 'Link');
  } catch {
    return 'Link';
  }
}

test('link Hub tab names come from hostname and stay ≤10 chars', () => {
  assert.equal(tabNameFromUrl('https://flexiloans.com/apply'), 'flexiloans');
  assert.equal(tabNameFromUrl('https://www.example.com/x'), 'example');
  assert.equal(tabNameFromUrl('https://w.meta.me/s/abc'), 'meta');
  assert.ok(tabNameFromUrl('https://verylongsubdomain.example.org/').length <= 10);
});
