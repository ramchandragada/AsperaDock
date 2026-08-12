import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTENSION_AUTH_CLICK_BRIDGE_JS } from '../src/extensionAuthClickBridge.js';

test('extension auth click bridge targets Grammarly sign-in anchors', () => {
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /data-grammarly-part/);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /composedPath/);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /grammarly\\.com/i);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /window\.open/);
});
