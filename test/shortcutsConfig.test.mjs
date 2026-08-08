import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accelFromKeyEvent,
  findShortcutConflicts,
  formatAccel,
  matchShortcut,
  migrateShortcutsMap,
  parseAccel,
  serializeAccel,
} from '../src/shortcutsConfig.js';

test('parse and format Control+Shift+D', () => {
  const p = parseAccel('Control+Shift+D');
  assert.equal(p.control, true);
  assert.equal(p.shift, true);
  assert.equal(p.key, 'd');
  assert.equal(formatAccel('Control+Shift+D'), 'Ctrl + Shift + D');
  assert.equal(serializeAccel(p), 'Control+Shift+D');
});

test('legacy boolean shortcuts migrate to enabled+accel', () => {
  const map = migrateShortcutsMap({ lock: false, search: true });
  assert.equal(map.lock.enabled, false);
  assert.equal(map.lock.accel, 'Control+Shift+L');
  assert.equal(map.search.enabled, true);
  assert.equal(map.search.accel, 'Control+/');
});

test('web search Control+K migrates to Control+E for chat search', () => {
  const map = migrateShortcutsMap({
    webSearch: { enabled: true, accel: 'Control+K' },
  });
  assert.equal(map.webSearch.accel, 'Control+E');
  assert.equal(defaultWebSearchAccel(), 'Control+E');
});

function defaultWebSearchAccel() {
  return migrateShortcutsMap({}).webSearch.accel;
}

test('match simple, tab digits, tab cycle, back/forward', () => {
  assert.deepEqual(
    matchShortcut(
      { enabled: true, accel: 'Control+Shift+L', kind: 'simple' },
      { type: 'keyDown', key: 'l', control: true, shift: true, alt: false, meta: false },
    ),
    { action: 'run' },
  );
  assert.deepEqual(
    matchShortcut(
      { enabled: true, accel: 'Control+1', kind: 'tabDigits' },
      { type: 'keyDown', key: '3', control: true, shift: false, alt: false, meta: false },
    ),
    { action: 'switchTab', digit: 3 },
  );
  assert.deepEqual(
    matchShortcut(
      { enabled: true, accel: 'Control+Tab', kind: 'tabCycle' },
      { type: 'keyDown', key: 'Tab', control: true, shift: true, alt: false, meta: false },
    ),
    { action: 'prevTab' },
  );
  assert.deepEqual(
    matchShortcut(
      { enabled: true, accel: 'Alt+ArrowLeft', kind: 'backForward' },
      { type: 'keyDown', key: 'ArrowRight', control: false, shift: false, alt: true, meta: false },
    ),
    { action: 'forward' },
  );
});

test('accelFromKeyEvent rejects bare letters', () => {
  assert.equal(accelFromKeyEvent({ key: 'a', ctrlKey: false, altKey: false }), null);
  assert.equal(accelFromKeyEvent({ key: 'a', ctrlKey: true }), 'Control+A');
});

test('conflict detection finds duplicate simple accels', () => {
  const conflicts = findShortcutConflicts({
    mute: { enabled: true, accel: 'Control+Shift+D' },
    focusMode: { enabled: true, accel: 'Control+Shift+D' },
  });
  assert.ok(conflicts.some((c) => c.a === 'focusMode' || c.b === 'focusMode'));
});
