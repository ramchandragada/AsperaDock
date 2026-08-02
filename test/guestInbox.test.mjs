import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeReplyJs,
  isInboxAppId,
  makePinId,
  normalizeChatKey,
  openMessagingChatJs,
  sanitizePinnedPeople,
  scrapeMessagingInboxJs,
  searchMessagingChatsJs,
} from '../src/guestInbox.js';
import { aboutDetailText } from '../src/aboutCopy.js';

test('inbox app ids are WhatsApp and Arattai only', () => {
  assert.equal(isInboxAppId('whatsapp'), true);
  assert.equal(isInboxAppId('arattai'), true);
  assert.equal(isInboxAppId('gmail'), false);
});

test('sanitizePinnedPeople caps at 10 and dedupes', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({
    serviceId: 'wa1',
    name: `Person ${i}`,
    chatKey: `person ${i}`,
    appId: 'whatsapp',
  }));
  const pins = sanitizePinnedPeople(many);
  assert.equal(pins.length, 10);
  assert.equal(pins[0].id, makePinId('wa1', normalizeChatKey('Person 0')));
  const duped = sanitizePinnedPeople([
    { serviceId: 'wa1', name: 'Ada', chatKey: 'ada' },
    { serviceId: 'wa1', name: 'Ada', chatKey: 'ada' },
  ]);
  assert.equal(duped.length, 1);
});

test('scrape / open / search / reply scripts mention WhatsApp list hooks', () => {
  assert.match(scrapeMessagingInboxJs(), /cell-frame-container/);
  assert.match(scrapeMessagingInboxJs(), /icon-unread-count/);
  assert.match(openMessagingChatJs('Ada', 'ada'), /chat-list-search|Search/);
  assert.match(searchMessagingChatsJs('parth'), /parth/);
  assert.match(composeReplyJs('Thanks', { send: true }), /compose-btn-send|Enter/);
});

test('about copy honours Cursor, Linux, Linus, and free forever', () => {
  const detail = aboutDetailText({
    electronVersion: '1.2.3',
    chromeVersion: '4.5.6',
  });
  assert.match(detail, /Aspera Technologies Pte Ltd/i);
  assert.match(detail, /Cursor AI/i);
  assert.match(detail, /Long live Linux/i);
  assert.match(detail, /Linus Torvalds/i);
  assert.match(detail, /open source/i);
  assert.match(detail, /100% free/i);
  assert.match(detail, /Electron 1\.2\.3/);
});
