import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWhatsAppSafeMode,
  isWhatsAppAppId,
  whatsappAutomationBlocked,
  maxWhatsAppInstances,
  whatsappSafeModeBlockedMessage,
  WHATSAPP_APP_ID,
} from '../src/whatsappSafeMode.js';
import { MAX_INSTANCES_PER_APP } from '../src/services.js';

test('WhatsApp Safe Mode defaults ON when settings missing or unset', () => {
  assert.equal(isWhatsAppSafeMode(null), true);
  assert.equal(isWhatsAppSafeMode({}), true);
  assert.equal(isWhatsAppSafeMode({ whatsappSafeMode: undefined }), true);
  assert.equal(isWhatsAppSafeMode({ whatsappSafeMode: true }), true);
});

test('WhatsApp Safe Mode can be turned off explicitly', () => {
  assert.equal(isWhatsAppSafeMode({ whatsappSafeMode: false }), false);
});

test('isWhatsAppAppId only matches whatsapp', () => {
  assert.equal(isWhatsAppAppId(WHATSAPP_APP_ID), true);
  assert.equal(isWhatsAppAppId('whatsapp'), true);
  assert.equal(isWhatsAppAppId('arattai'), false);
  assert.equal(isWhatsAppAppId('gmail'), false);
  assert.equal(isWhatsAppAppId(''), false);
});

test('automation blocked only for WhatsApp when Safe Mode is on', () => {
  const on = { whatsappSafeMode: true };
  const off = { whatsappSafeMode: false };
  assert.equal(whatsappAutomationBlocked(on, 'whatsapp'), true);
  assert.equal(whatsappAutomationBlocked(on, 'arattai'), false);
  assert.equal(whatsappAutomationBlocked(off, 'whatsapp'), false);
  assert.equal(whatsappAutomationBlocked(null, 'whatsapp'), true);
});

test('max WhatsApp instances is 1 in Safe Mode, otherwise catalog max', () => {
  assert.equal(maxWhatsAppInstances({ whatsappSafeMode: true }), 1);
  assert.equal(maxWhatsAppInstances({}), 1);
  assert.equal(
    maxWhatsAppInstances({ whatsappSafeMode: false }),
    MAX_INSTANCES_PER_APP,
  );
});

test('blocked message mentions Safe Mode and Settings', () => {
  const msg = whatsappSafeModeBlockedMessage('Quick reply');
  assert.match(msg, /WhatsApp Safe Mode/i);
  assert.match(msg, /Quick reply/);
  assert.match(msg, /Settings/);
});
