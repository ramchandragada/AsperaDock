import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findWhatsAppPaneResetJs,
  nuclearWipeMessagingSearchJs,
  readMessagingSearchTextJs,
  tryOpenWhatsAppStoreChatJs,
  waMutateSearchJs,
  waSearchNodeJs,
} from '../src/whatsappPinOpen.js';

test('WhatsApp Store open script probes all webpackChunk* modules', () => {
  const js = tryOpenWhatsAppStoreChatJs('shrikant', '123@c.us');
  assert.match(js, /webpackChunk|openChatBottom/);
  assert.match(js, /123@c\.us/);
  assert.match(js, /shrikant/);
  assert.match(js, /scanRequire|getModelsArray/);
});

test('WA search mutate clears and inserts via execCommand/paste for CDP userGesture', () => {
  const clearJs = waMutateSearchJs('');
  assert.match(clearJs, /selectNodeContents|deleteContentBackward|insertText/);
  assert.match(clearJs, /data-tab="3"/);
  assert.doesNotMatch(clearJs, /key:\s*'Escape'|code:\s*'Escape'/);
  const fillJs = waMutateSearchJs('Kumar Gardas New Narendra');
  assert.match(fillJs, /Kumar Gardas New Narendra/);
  assert.match(fillJs, /ClipboardEvent|paste/);
  assert.match(nuclearWipeMessagingSearchJs(), /data-tab="3"/);
});

test('search node / reader prefer leftover text over empty placeholders', () => {
  assert.match(waSearchNodeJs(), /clearX|data-tab/);
  assert.match(readMessagingSearchTextJs(), /bestText|data-tab/);
  const reset = findWhatsAppPaneResetJs();
  assert.match(reset, /clearHint|backHint/);
  assert.match(reset, /aria-label="Chats"|data-testid="chat"/);
});
