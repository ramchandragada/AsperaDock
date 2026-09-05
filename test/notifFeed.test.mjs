import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMessagePreview,
  isAggregateUnreadBody,
  mergeNotificationFeed,
} from '../src/notifFeed.js';

test('formatMessagePreview keeps up to three lines', () => {
  const preview = formatMessagePreview('Line one\nLine two\nLine three\nLine four');
  assert.equal(preview, 'Line one\nLine two\nLine three');
});

test('formatMessagePreview wraps long single lines', () => {
  const long = 'a'.repeat(250);
  const preview = formatMessagePreview(long, { maxLines: 3, lineChars: 96, maxChars: 280 });
  assert.ok(preview.includes('\n'));
  assert.ok(preview.length <= 280);
});

test('isAggregateUnreadBody detects count-only bodies', () => {
  assert.equal(isAggregateUnreadBody('2 unread'), true);
  assert.equal(isAggregateUnreadBody('Hello there'), false);
});

test('mergeNotificationFeed expands scrapes and gates quick reply on chat target', () => {
  const items = mergeNotificationFeed({
    logItems: [
      {
        id: 'agg',
        serviceId: 'svc1',
        title: 'Arattai',
        body: '2 unread',
        at: 1,
        chatName: '',
        canReply: true,
        accountLabel: 'Arattai',
      },
      {
        id: 'rich',
        serviceId: 'svc1',
        title: 'Ayush',
        body: 'Can we meet at 5?\nBring the files.',
        at: 3,
        chatName: 'Ayush',
        chatKey: 'ayush',
        canReply: true,
        accountLabel: 'Arattai',
      },
    ],
    scrapedChats: [
      {
        serviceId: 'svc1',
        name: 'Priya',
        chatKey: 'priya',
        preview: 'Please review the draft before tomorrow morning standup.',
        unread: 2,
        accountLabel: 'Arattai',
        at: 2,
        canReply: true,
      },
    ],
  });

  assert.equal(items.some((i) => i.body === '2 unread' && !i.chatName), false);
  const rich = items.find((i) => i.title === 'Ayush');
  assert.ok(rich);
  assert.match(rich.body, /Can we meet at 5/);
  assert.equal(rich.canReply, true);
  const scraped = items.find((i) => i.title === 'Priya');
  assert.ok(scraped);
  assert.equal(scraped.canReply, true);
  assert.equal(scraped.unread, 2);
  assert.match(scraped.body, /Please review the draft/);
});

test('mergeNotificationFeed hides message bodies when privacy mode is on', () => {
  const items = mergeNotificationFeed({
    hideContent: true,
    logItems: [
      {
        id: 'rich',
        serviceId: 'svc1',
        title: 'Ayush',
        body: 'Secret',
        at: 1,
        chatName: 'Ayush',
        canReply: true,
      },
    ],
  });
  assert.equal(items[0].body, 'New notification');
  assert.equal(items[0].canReply, false);
});
