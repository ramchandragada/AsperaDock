import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findWhatsAppPaneResetJs,
  nuclearWipeMessagingSearchJs,
  readMessagingSearchTextJs,
  tryOpenWhatsAppStoreChatJs,
} from '../src/whatsappPinOpen.js';

test('WhatsApp Store open script probes webpack Chat/Cmd modules', () => {
  const js = tryOpenWhatsAppStoreChatJs('shrikant', '123@c.us');
  assert.match(js, /webpackChunkwhatsapp_web_client|openChatBottom/);
  assert.match(js, /123@c\.us/);
  assert.match(js, /shrikant/);
  assert.match(js, /isGroup|@g\\\\.us/);
});

test('nuclear search wipe uses Selection API delete on contenteditable', () => {
  const js = nuclearWipeMessagingSearchJs();
  assert.match(js, /selectNodeContents|deleteContentBackward/);
  assert.match(js, /data-tab="3"|chat-list-search/);
  assert.doesNotMatch(js, /key:\s*'Escape'|code:\s*'Escape'/);
});

test('search text reader and pane reset expose clear/back geometry', () => {
  assert.match(readMessagingSearchTextJs(), /innerText|textContent/);
  const reset = findWhatsAppPaneResetJs();
  assert.match(reset, /clearHint|backHint/);
  assert.match(reset, /aria-label="Chats"|data-testid="chat"/);
  assert.match(reset, /\^all\$/i);
});
