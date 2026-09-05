import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure helpers mirrored from chromeProtocol (avoid importing electron in unit tests).
 */
const CHROME_SCHEME = 'asperadock';
const CHROME_HOST = 'ui';
const AI_RESULT_CHROME_PATH = 'ai-result.html';

function normalizeChromePath(pathname) {
  let rel = decodeURIComponent(String(pathname || '/'));
  if (rel.startsWith('/')) rel = rel.slice(1);
  if (!rel || rel.endsWith('/')) rel = `${rel}index.html`;
  return rel;
}

function chromeAppUrl(pathname = 'index.html') {
  const clean = normalizeChromePath(pathname);
  return `${CHROME_SCHEME}://${CHROME_HOST}/${clean}`;
}

function aiResultChromeUrl(dark = false) {
  const q = dark ? '?dark=1' : '';
  return `${chromeAppUrl(AI_RESULT_CHROME_PATH)}${q}`;
}

test('AI result panel URL uses privileged secure asperadock scheme', () => {
  const url = aiResultChromeUrl(false);
  assert.equal(url.startsWith('asperadock://ui/'), true);
  assert.match(url, /ai-result\.html/);
  assert.equal(aiResultChromeUrl(true), 'asperadock://ui/ai-result.html?dark=1');
});

test('data: URLs are not used for the mic-capable AI panel origin', () => {
  // Regression guard: data: is an opaque origin — Chromium hides mediaDevices.
  assert.equal(aiResultChromeUrl(false).startsWith('data:'), false);
  assert.equal(chromeAppUrl('index.html').startsWith('https://') || chromeAppUrl('index.html').startsWith('asperadock://'), true);
});

test('normalizeChromePath strips leading slash', () => {
  assert.equal(normalizeChromePath('/ai-result.html'), 'ai-result.html');
  assert.equal(normalizeChromePath('ai-result.html'), 'ai-result.html');
});
