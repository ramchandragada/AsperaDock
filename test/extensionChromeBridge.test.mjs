import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTENSION_AUTH_CLICK_BRIDGE_JS } from '../src/extensionAuthClickBridge.js';
import {
  PRELOAD_FRAME_ID,
  PRELOAD_SW_ID,
  TABS_CREATE_CHANNEL,
  planPreloadRegistration,
  isExtensionServiceWorkerScope,
} from '../src/extensionPreloadWire.js';

test('extension auth click bridge targets Grammarly sign-in anchors', () => {
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /data-grammarly-part/);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /composedPath/);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /grammarly/);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /window\.open/);
});

test('planPreloadRegistration registers frame and service-worker scripts', () => {
  const preloadAbs = '/opt/aspera/extensionChromePreload.js';
  const first = planPreloadRegistration([], preloadAbs);
  assert.equal(first.swPreloadNew, true);
  assert.equal(first.registrations.length, 2);
  assert.equal(first.registrations[0].type, 'frame');
  assert.equal(first.registrations[0].id, PRELOAD_FRAME_ID);
  assert.equal(first.registrations[1].type, 'service-worker');
  assert.equal(first.registrations[1].id, PRELOAD_SW_ID);

  const second = planPreloadRegistration(
    [{ id: PRELOAD_FRAME_ID }, { id: PRELOAD_SW_ID }],
    preloadAbs,
  );
  assert.equal(second.swPreloadNew, false);
  assert.equal(second.registrations.length, 0);
});

test('isExtensionServiceWorkerScope matches chrome-extension scopes', () => {
  assert.equal(isExtensionServiceWorkerScope('chrome-extension://abc/'), true);
  assert.equal(isExtensionServiceWorkerScope('https://web.whatsapp.com/'), false);
});

test('tabs-create channel name is stable', () => {
  assert.equal(TABS_CREATE_CHANNEL, 'aspera-ext:tabs-create');
});
