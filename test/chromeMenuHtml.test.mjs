import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROME_MENU_SECTIONS,
  buildChromeMenuHtml,
  chromeMenuPreferredHeight,
} from '../src/chromeMenuHtml.js';

test('chrome menu sections follow presence → AI → app → workspace → lock → system', () => {
  assert.deepEqual(
    CHROME_MENU_SECTIONS.map((s) => s.id),
    ['presence', 'ai', 'app', 'workspace', 'security', 'system'],
  );
});

test('chrome menu is hub controls only — no toolbar duplicates', () => {
  const actions = CHROME_MENU_SECTIONS.flatMap((s) =>
    s.items.map((i) => i.action),
  );
  for (const need of [
    'focus',
    'mute',
    'aspera-ai',
    'catch-up',
    'ai-settings',
    'copy-link',
    'free-ram',
    'profiles',
    'notes',
    'lock',
    'settings',
    'shortcuts',
    'aspera-connect',
    'check-updates',
    'website',
    'about',
  ]) {
    assert.ok(actions.includes(need), `missing ${need}`);
  }
  for (const gone of [
    'web-search',
    'search',
    'back',
    'forward',
    'reload',
    'home',
    'add-app',
    'extensions',
  ]) {
    assert.ok(!actions.includes(gone), `toolbar duplicate still in menu: ${gone}`);
  }
  assert.equal(new Set(actions).size, actions.length, 'duplicate actions');

  const html = buildChromeMenuHtml(false);
  assert.match(html, /role="menu"/);
  assert.match(html, /Presence/);
  assert.match(html, /Aspera AI/);
  assert.match(html, /Current app/);
  assert.ok(html.includes('data-action="copy-link"'));
  assert.match(html, /Copy link/);
  assert.match(html, /Workspace/);
  assert.match(html, /Keyboard shortcuts/);
  assert.match(html, /Open Aspera Connect/);
  assert.match(html, /Check for updates/);
  assert.match(html, /asperahub\.com/);
  assert.ok(html.includes('data-action="settings"'));
  assert.ok(html.includes('data-action="aspera-connect"'));
  assert.ok(html.includes('data-action="check-updates"'));
  assert.ok(html.includes('data-action="website"'));
  assert.ok(html.includes('data-action="ai-settings"'));
  assert.ok(!html.includes('overflow-y:auto'), 'menu should not force inner scroll');
});

test('chrome menu preferred height fits the slim menu on a normal display', () => {
  const h = chromeMenuPreferredHeight({ workAreaHeight: 1080 });
  assert.ok(h >= 560, `expected room for slim menu, got ${h}`);
  assert.ok(h <= 800, `slim menu should not need a huge window, got ${h}`);
});
