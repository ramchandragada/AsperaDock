import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
import {
  ASPERA_EXT_SW_MARKER,
  ASPERA_EXT_SW_VERSION,
} from '../src/asperaExtSwBootstrap.js';
import { ASPERA_EXT_AUTH_BRIDGE_FILENAME } from '../src/asperaExtAuthBridgeContent.js';
import {
  extensionIdFromPublicKey,
  extractCrxPublicKeys,
  publicKeyForExtensionId,
} from '../src/crxPublicKey.js';
import { isExtensionOAuthRedirectUrl } from '../src/extensionPreloadWire.js';

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

test('oauth redirect url detection covers chromiumapp.org', () => {
  assert.equal(
    isExtensionOAuthRedirectUrl(
      'https://kbfnbcaeplbcioakkpcpgfkobkghlhen.chromiumapp.org/?code=abc&state=1',
    ),
    true,
  );
  assert.equal(
    isExtensionOAuthRedirectUrl('https://auth.grammarly.com/tokens'),
    false,
  );
});

test('crx public key extracts Grammarly store id', () => {
  const crxPath = '/tmp/g.crx';
  if (!fs.existsSync(crxPath)) {
    assert.ok(true, 'skip without local crx');
    return;
  }
  const buf = fs.readFileSync(crxPath);
  const keys = extractCrxPublicKeys(buf);
  assert.ok(keys.length >= 1);
  const key = publicKeyForExtensionId(buf, 'kbfnbcaeplbcioakkpcpgfkobkghlhen');
  assert.ok(key);
  assert.equal(
    extensionIdFromPublicKey(Buffer.from(key, 'base64')),
    'kbfnbcaeplbcioakkpcpgfkobkghlhen',
  );
});

test('patchExtensionForAuth upgrades bootstrap and injects auth bridge', () => {
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
    fs.writeFileSync(path.join(dir, 'sw.js'), "importScripts('bg.js');\n", 'utf8');

    assert.equal(
      isAuthPatchableExtension(
        JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')),
      ),
      true,
    );
    assert.equal(patchExtensionForAuth(dir), true);

    let sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    assert.match(sw, new RegExp(ASPERA_EXT_SW_VERSION));
    assert.match(sw, /getRedirectURL/);
    assert.ok(fs.existsSync(path.join(dir, ASPERA_EXT_AUTH_BRIDGE_FILENAME)));

    // Simulate old bootstrap and ensure upgrade rewrites it.
    fs.writeFileSync(
      path.join(dir, 'sw.js'),
      `/* aspera-hub-sw-bootstrap */\n(()=>{self.${ASPERA_EXT_SW_MARKER}=!0})();\nimportScripts('bg.js');\n`,
      'utf8',
    );
    assert.equal(patchExtensionForAuth(dir), true);
    sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    assert.match(sw, new RegExp(ASPERA_EXT_SW_VERSION));
    assert.match(sw, /getRedirectURL/);
    assert.equal(patchExtensionForAuth(dir), false);
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
});
