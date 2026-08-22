import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BITWARDEN_CHROME_STORE_ID,
  buildExtensionPopupFallbackDataUrl,
  buildExtensionPopupUrl,
  extensionHasOpenablePopup,
  findLoadedExtensionRuntimeId,
  resolveExtensionPopupPath,
} from '../src/extensionPopup.js';

test('resolveExtensionPopupPath prefers MV3 action.default_popup', () => {
  assert.equal(
    resolveExtensionPopupPath({
      action: { default_popup: 'popup/index.html' },
    }),
    'popup/index.html',
  );
});

test('resolveExtensionPopupPath falls back to browser_action', () => {
  assert.equal(
    resolveExtensionPopupPath({
      browser_action: { default_popup: 'popup.html' },
    }),
    'popup.html',
  );
});

test('buildExtensionPopupUrl adds popout query for persistent window', () => {
  assert.equal(
    buildExtensionPopupUrl('abcd1234', 'popup/index.html'),
    'chrome-extension://abcd1234/popup/index.html?uilocation=popout',
  );
});

test('buildExtensionPopupUrl adds Bitwarden home route', () => {
  assert.equal(
    buildExtensionPopupUrl('abcd1234', 'popup/index.html', {
      chromeStoreId: BITWARDEN_CHROME_STORE_ID,
    }),
    'chrome-extension://abcd1234/popup/index.html?uilocation=popout#/home',
  );
});

test('buildExtensionPopupFallbackDataUrl encodes html', () => {
  assert.match(
    buildExtensionPopupFallbackDataUrl('<p>Hi</p>'),
    /^data:text\/html;charset=utf-8,/,
  );
});

test('findLoadedExtensionRuntimeId matches unpacked path', () => {
  const id = findLoadedExtensionRuntimeId(
    [{ id: 'runtime-id', path: '/home/user/.config/extensions/ext-bitwarden' }],
    '/home/user/.config/extensions/ext-bitwarden',
  );
  assert.equal(id, 'runtime-id');
});

test('extensionHasOpenablePopup is false without popup', () => {
  assert.equal(extensionHasOpenablePopup({ background: { service_worker: 'bg.js' } }), false);
  assert.equal(extensionHasOpenablePopup({ action: { default_popup: 'x.html' } }), true);
});
