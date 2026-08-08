import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('find clear stops guest highlights and guards late found-in-page', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /clearGuestFindHighlights/);
  assert.match(main, /findBarSession/);
  assert.match(main, /if \(!findBarLastQuery\)/);
  assert.match(main, /stopFindInPage\('clearSelection'\)/);
});

test('find bar clears on input and search empty events', () => {
  const html = fs.readFileSync(
    new URL('../src/findBarHtml.js', import.meta.url),
    'utf8',
  );
  assert.match(html, /addEventListener\('search'/);
  assert.match(html, /addEventListener\('input'/);
  assert.match(html, /runFind\(\{ findNext: false, forward: true \}\)/);
});
