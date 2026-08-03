import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findExactWhatsAppContactTargetJs,
  findWhatsAppPaneResetJs,
  nuclearWipeMessagingSearchJs,
  readActiveWhatsAppChatJs,
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
  // Prefer DMs; match business/verified display names (AYUSH JAIN ABOP case).
  assert.match(js, /verifiedName|notifyName|chatTitles/);
  assert.match(js, /isGroup/);
  assert.match(js, /Contact|openChatBottom\(\{ chat \}\)/);
});

test('exact WA contact target ignores Messages section and requires exact name', () => {
  const js = findExactWhatsAppContactTargetJs('AYUSH JAIN ABOP', '9199@c.us');
  assert.match(js, /exact_not_found|exact-text|exact-title/);
  assert.match(js, /inMessages|messages/);
  assert.match(js, /AYUSH JAIN ABOP/);
  assert.match(js, /9199@c\.us/);
  // Reject giant wrappers that caused wrong-contact clicks.
  assert.match(js, /120000|area >/);
  assert.match(readActiveWhatsAppChatJs(), /getActive|nativeId/);
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
