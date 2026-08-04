import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROME_MENU_SECTIONS,
  buildChromeMenuHtml,
} from '../src/chromeMenuHtml.js';

test('chrome menu sections follow presence → AI → app → workspace → lock → system', () => {
  assert.deepEqual(
    CHROME_MENU_SECTIONS.map((s) => s.id),
    ['presence', 'ai', 'app', 'workspace', 'security', 'system'],
  );
});

test('chrome menu keeps required actions and unique icons for settings vs updates', () => {
  const actions = CHROME_MENU_SECTIONS.flatMap((s) =>
    s.items.map((i) => i.action),
  );
  for (const need of [
    'search',
    'aspera-ai',
    'catch-up',
    'back',
    'forward',
    'settings',
    'ai-settings',
    'lock',
    'check-updates',
    'about',
  ]) {
    assert.ok(actions.includes(need), `missing ${need}`);
  }
  assert.equal(new Set(actions).size, actions.length, 'duplicate actions');

  const html = buildChromeMenuHtml(false);
  assert.match(html, /role="menu"/);
  assert.match(html, /Presence/);
  assert.match(html, /Aspera AI/);
  assert.match(html, /Current app/);
  assert.match(html, /Workspace/);
  assert.match(html, /Keyboard shortcuts/);
  assert.match(html, /Check for updates/);
  // Settings uses sliders path; updates uses download arrow — not identical reload glyph.
  assert.ok(html.includes('data-action="settings"'));
  assert.ok(html.includes('data-action="check-updates"'));
  assert.ok(html.includes('data-action="ai-settings"'));
});
