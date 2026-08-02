import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeReplyJs,
  inspectChatListTargetJs,
  isInboxAppId,
  isJunkChatName,
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

test('scrape / open / search / reply scripts mention WhatsApp + Arattai list hooks', () => {
  assert.match(scrapeMessagingInboxJs(), /cell-frame-container/);
  assert.match(scrapeMessagingInboxJs(), /art-chat-item/);
  assert.match(scrapeMessagingInboxJs(), /chat-title-text/);
  assert.match(scrapeMessagingInboxJs(), /icon-unread-count/);
  assert.match(scrapeMessagingInboxJs(), /isJunkName/);
  const inspectJs = inspectChatListTargetJs(12, 40);
  assert.match(inspectJs, /elementsFromPoint|elementFromPoint/);
  assert.match(inspectJs, /art-chat-item/);
  assert.match(inspectJs, /art-chwindow-hdr|openChatHeaderName/);
  const openJs = openMessagingChatJs('LFCHS REUNION 22nd Dec 2029', 'lfchs reunion 22nd dec 2029');
  assert.match(openJs, /chat-list-search|Search/);
  assert.match(openJs, /confirmedOpen|conversation-info-header|art-chwindow-hdr/);
  assert.match(openJs, /pointerdown|mousedown/);
  // Pin-open hardening: paste into search, keyboard confirm, dismiss leftover search.
  assert.match(openJs, /ClipboardEvent|paste/);
  assert.match(openJs, /ArrowDown/);
  assert.match(openJs, /clearLeftSearch|dismissSearch|Escape/);
  assert.match(openJs, /inLeftPane|cell-frame-title/);
  assert.match(openJs, /scoreName\(header\) >= 56/);
  assert.match(openJs, /looksLikeGroup/);
  assert.match(searchMessagingChatsJs('parth'), /parth/);
  assert.match(searchMessagingChatsJs('parth'), /art-chat-item/);
  assert.match(composeReplyJs('Thanks', { send: true }), /compose-btn-send|Enter/);
});

test('chat search matches message text and previews, not only names', () => {
  const js = searchMessagingChatsJs('Settled in Pone Facing any problem');
  assert.match(js, /textMatches|last-msg-body|copyable-text/);
  assert.match(js, /match:\s*'message'|match:\s*"message"|'message'/);
  assert.match(js, /preview/);
  assert.match(js, /snippetAround|openChatHeaderName/);
  // Soft match so "ettled" still hits "settled".
  assert.match(js, /slice\(1\)/);
});

test('openMessagingChatJs does not treat unrelated compose as success', () => {
  const openJs = openMessagingChatJs('shrikant', 'shrikant');
  // Header must match — compose-only success was the flaky false positive.
  assert.match(openJs, /scoreName\(header\) >= 56/);
  assert.doesNotMatch(openJs, /composeOpen\(\) && !!wantN/);
});

test('openMessagingChatJs clears stale search and prefers DMs over group mentions', () => {
  const openJs = openMessagingChatJs('shrikant', 'shrikant');
  assert.match(openJs, /clearLeftSearch/);
  assert.match(openJs, /isShortSingleToken/);
  assert.match(openJs, /looksLikeGroup/);
  assert.match(openJs, /searchDirty/);
  // Keyboard confirm only after a strong titled match (not Messages/@mention hits).
  assert.match(openJs, /scoreName\(rowName\(row\)/);
});

test('junk chat names reject Arattai chrome mistaken for contacts', () => {
  assert.equal(isJunkChatName('Chats'), true);
  assert.equal(isJunkChatName('Search'), true);
  assert.equal(isJunkChatName('MH Latur Branch'), false);
  assert.equal(isJunkChatName('ASPERA OPERATIONS'), false);
});

test('junk chat names reject unread badges mistaken for contacts', () => {
  assert.equal(isJunkChatName('3'), true);
  assert.equal(isJunkChatName('unread messages'), true);
  assert.equal(isJunkChatName('2 unread messages'), true);
  assert.equal(isJunkChatName('Pinned'), true);
  assert.equal(isJunkChatName('Ramchandra SIR Gada'), false);
  assert.deepEqual(
    sanitizePinnedPeople([
      { serviceId: 'wa', name: '3', chatKey: '3' },
      { serviceId: 'wa', name: 'Ada', chatKey: 'ada' },
    ]).map((p) => p.name),
    ['Ada'],
  );
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
