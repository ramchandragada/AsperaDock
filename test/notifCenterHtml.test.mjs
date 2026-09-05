import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifCenterHtml } from '../src/notifCenterHtml.js';

test('notification center is alerts-only (Needs reply removed)', () => {
  const html = buildNotifCenterHtml(false);
  assert.match(html, /Notifications/);
  assert.match(html, /Recent alerts from your apps/);
  assert.match(html, /Pin important WhatsApp/);
  assert.doesNotMatch(html, /Needs reply/i);
  assert.doesNotMatch(html, /inbox-list/);
  assert.doesNotMatch(html, /open-inbox/);
  assert.doesNotMatch(html, /pin-inbox/);
  assert.doesNotMatch(html, /paintInbox/);
});

test('notification center keeps quick reply for messaging alerts', () => {
  const html = buildNotifCenterHtml(true);
  assert.match(html, /Quick reply/);
  assert.match(html, /width:\s*400px/);
  assert.match(html, /-webkit-line-clamp:\s*3/);
  assert.match(html, /Replying about:/);
});
