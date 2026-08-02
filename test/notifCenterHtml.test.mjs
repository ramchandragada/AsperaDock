import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifCenterHtml } from '../src/notifCenterHtml.js';

test('notification center hosts Needs reply section (moved off pin strip)', () => {
  const html = buildNotifCenterHtml(false);
  assert.match(html, /Needs reply/i);
  assert.match(html, /inbox-list/);
  assert.match(html, /open-inbox/);
  assert.match(html, /pin-inbox/);
  assert.match(html, /paintInbox/);
});
