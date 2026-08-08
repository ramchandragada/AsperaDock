import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('find clear stops guest highlights and guards late found-in-page', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /clearGuestFindHighlights/);
  assert.match(main, /findBarSession/);
  assert.match(main, /findBarRequestId/);
  assert.match(main, /if \(!findBarLastQuery\)/);
  assert.match(main, /result\.requestId !== findBarRequestId/);
  assert.match(main, /stopFindInPage\('clearSelection'\)/);
  assert.match(main, /Find bar closed/);
  assert.match(main, /\\uFFFF\\uFFFE\\uFFFF/);
});

test('find bar debounces typing and does not select-all on every focus', () => {
  const html = fs.readFileSync(
    new URL('../src/findBarHtml.js', import.meta.url),
    'utf8',
  );
  assert.match(html, /debounceTimer/);
  assert.match(html, /addEventListener\('search'/);
  assert.match(html, /addEventListener\('input'/);
  assert.match(html, /focusInput\(\{ select: false \}\)/);
  assert.match(html, /immediate: true/);
});
