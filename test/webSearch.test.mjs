import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  resolveWebSearchInput,
  webSearchTabName,
} from '../src/webSearch.js';

test('resolveWebSearchInput builds Google search URL', () => {
  assert.equal(
    resolveWebSearchInput('GST rate Maharashtra'),
    'https://www.google.com/search?q=GST%20rate%20Maharashtra',
  );
});

test('resolveWebSearchInput keeps http(s) URLs', () => {
  assert.equal(
    resolveWebSearchInput('https://example.com/a'),
    'https://example.com/a',
  );
  assert.equal(resolveWebSearchInput(''), null);
});

test('webSearchTabName truncates long queries', () => {
  assert.equal(webSearchTabName('GST'), 'GST');
  assert.equal(webSearchTabName('https://x.com'), 'Google');
  assert.ok(webSearchTabName('a'.repeat(40)).endsWith('…'));
});

test('main and forge wire web search float', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const forge = fs.readFileSync(
    new URL('../forge.config.js', import.meta.url),
    'utf8',
  );
  assert.match(main, /openWebSearchWindow/);
  assert.match(main, /resolveWebSearchInput/);
  assert.match(main, /CommandOrControl\+E/);
  assert.doesNotMatch(main, /Web search…[\s\S]*CommandOrControl\+K/);
  assert.match(forge, /webSearchPreload\.js/);
});
