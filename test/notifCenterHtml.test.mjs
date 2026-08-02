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

test('notification center layout is taller and lists readable chat rows', () => {
  const html = buildNotifCenterHtml(false);
  assert.match(html, /width:\s*420px/);
  assert.match(html, /height:\s*720px/);
  assert.match(html, /chat-item/);
  assert.match(html, /chat-title/);
  assert.match(html, /section-hint/);
  assert.match(html, /Unread chats and recent alerts/);
  assert.match(html, /Quick reply/);
});
