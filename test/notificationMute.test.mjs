import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('applyFocusMode mutes even when WhatsApp Safe Mode would skip bridge', () => {
  assert.match(mainSrc, /__asperaDockMuteNotifications/);
  assert.match(
    mainSrc,
    /renamed WhatsApp tabs like "GST"|Notifications OFF \(any app, including Safe Mode WhatsApp\)/,
  );
  // Must not return early on Safe Mode before considering mute.
  assert.match(mainSrc, /safeBlocked && allowNotifications/);
  assert.match(mainSrc, /__asperaDockUseBridge/);
});

test('guest notification permission respects per-app allowNotifications', () => {
  assert.match(mainSrc, /guestPermissionAllowed/);
  assert.match(
    mainSrc,
    /svc && !getAppConfig\(svc\.id\)\.allowNotifications/,
  );
  assert.match(mainSrc, /setPermissionCheckHandler/);
});

test('notifications toggle re-applies focus mode immediately', () => {
  assert.match(
    mainSrc,
    /type === 'notifications'[\s\S]*?applyFocusMode\(wc, id\)/,
  );
});

test('notif center skips muted apps for scrape and log', () => {
  assert.match(
    mainSrc,
    /getAppConfig\(s\.id\)\.allowNotifications !== false/,
  );
  assert.match(
    mainSrc,
    /allowNotifications === false\) return \[\]/,
  );
  assert.match(
    mainSrc,
    /cfg\.allowNotifications !== false/,
  );
});

test('emitServiceNotification still gates on allowNotifications', () => {
  assert.match(
    mainSrc,
    /if \(!liveCfg\.allowNotifications\) return false;/,
  );
});
