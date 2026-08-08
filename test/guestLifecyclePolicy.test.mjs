import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldRunPortalBlankRecovery,
  portalHealthCheckDelays,
  shouldRecoverAfterAway,
  PORTAL_STALE_MS,
} from '../src/guestIdleRecovery.js';
import {
  hibernateMsFromSettings,
  defaultKeepWarmForApp,
} from '../src/guestLifecycle.js';

test('shouldRunPortalBlankRecovery only for Zoho portals', () => {
  assert.equal(shouldRunPortalBlankRecovery({ appId: 'zoho-one' }), true);
  assert.equal(shouldRunPortalBlankRecovery({ appId: 'zoho-crm' }), true);
  assert.equal(shouldRunPortalBlankRecovery({ appId: 'arattai' }), false);
  assert.equal(shouldRunPortalBlankRecovery({ appId: 'whatsapp' }), false);
  assert.equal(shouldRunPortalBlankRecovery(null), false);
});

test('portalHealthCheckDelays adds long-idle pass', () => {
  assert.deepEqual(portalHealthCheckDelays(60_000), [450, 1200]);
  assert.deepEqual(portalHealthCheckDelays(20 * 60_000), [450, 1200, 2800]);
  assert.deepEqual(portalHealthCheckDelays(1000, 'power-resume'), [
    450,
    1200,
    2800,
  ]);
});

test('shouldRecoverAfterAway threshold', () => {
  assert.equal(shouldRecoverAfterAway(10_000), false);
  assert.equal(shouldRecoverAfterAway(45_000), true);
});

test('hibernateMsFromSettings respects low-memory cap', () => {
  assert.equal(hibernateMsFromSettings(45), 45 * 60_000);
  assert.equal(hibernateMsFromSettings(45, { lowMemoryMode: true }), 3 * 60_000);
  assert.equal(hibernateMsFromSettings(0, { lowMemoryMode: true }), 2 * 60_000);
});

test('defaultKeepWarmForApp messaging and Zoho form apps', () => {
  assert.equal(defaultKeepWarmForApp('whatsapp'), true);
  assert.equal(defaultKeepWarmForApp('arattai'), true);
  assert.equal(defaultKeepWarmForApp('zoho-crm'), true);
  assert.equal(defaultKeepWarmForApp('zoho-one'), true);
  assert.equal(defaultKeepWarmForApp('zoho-books'), true);
  assert.equal(defaultKeepWarmForApp('gmail'), false);
});

test('PORTAL_STALE_MS is ten minutes', () => {
  assert.equal(PORTAL_STALE_MS, 10 * 60_000);
});
