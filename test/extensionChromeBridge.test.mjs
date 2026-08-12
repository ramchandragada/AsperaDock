import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EXTENSION_AUTH_CLICK_BRIDGE_JS } from '../src/extensionAuthClickBridge.js';
import {
  PRELOAD_FRAME_ID,
  PRELOAD_SW_ID,
  PRELOAD_GUEST_AUTH_ID,
  TABS_CREATE_CHANNEL,
  planPreloadRegistration,
  isExtensionServiceWorkerScope,
} from '../src/extensionPreloadWire.js';
import {
  patchExtensionForAuth,
  isAuthPatchableExtension,
} from '../src/extensionInstallPatch.js';
import { ASPERA_EXT_SW_MARKER } from '../src/asperaExtSwBootstrap.js';
import { ASPERA_EXT_AUTH_BRIDGE_FILENAME } from '../src/asperaExtAuthBridgeContent.js';

test('extension auth click bridge matches www.grammarly.com hrefs', () => {
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /grammarly/);
  assert.match(EXTENSION_AUTH_CLICK_BRIDGE_JS, /__asperaExtBridge/);
  assert.doesNotMatch(
    EXTENSION_AUTH_CLICK_BRIDGE_JS,
    /account\\\\\\.grammarly/,
    'should not use the old account-only host regex',
  );
});

test('planPreloadRegistration registers guest auth preload', () => {
  const plan = planPreloadRegistration([], '/opt/a.js', '/opt/guest.js');
  assert.equal(plan.registrations.length, 3);
  assert.equal(plan.guestPreloadNew, true);
  assert.equal(plan.registrations[2].id, PRELOAD_GUEST_AUTH_ID);
});

test('isExtensionServiceWorkerScope matches chrome-extension scopes', () => {
  assert.equal(isExtensionServiceWorkerScope('chrome-extension://abc/'), true);
  assert.equal(isExtensionServiceWorkerScope('https://web.whatsapp.com/'), false);
});

test('tabs-create channel name is stable', () => {
  assert.equal(TABS_CREATE_CHANNEL, 'aspera-ext:tabs-create');
});

test('patchExtensionForAuth injects SW bootstrap and auth bridge content script', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aspera-ext-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        manifest_version: 3,
        name: 'Test',
        version: '1.0.0',
        background: { service_worker: 'sw.js' },
        content_scripts: [],
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(dir, 'sw.js'),
      "importScripts('bg.js');\n",
      'utf8',
    );

    assert.equal(isAuthPatchableExtension(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')))), true);
    assert.equal(patchExtensionForAuth(dir), true);

    const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    assert.match(sw, new RegExp(ASPERA_EXT_SW_MARKER));
    assert.ok(fs.existsSync(path.join(dir, ASPERA_EXT_AUTH_BRIDGE_FILENAME)));

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.ok(
      manifest.content_scripts.some((entry) =>
        entry.js?.includes(ASPERA_EXT_AUTH_BRIDGE_FILENAME),
      ),
    );

    assert.equal(patchExtensionForAuth(dir), false, 'second patch is idempotent');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('planPreloadRegistration registers frame and service-worker scripts', () => {
  const preloadAbs = '/opt/aspera/extensionChromePreload.js';
  const first = planPreloadRegistration([], preloadAbs);
  assert.equal(first.swPreloadNew, true);
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
