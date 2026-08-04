import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWhatsAppSafeMode,
  isWhatsAppAppId,
  whatsappAutomationBlocked,
  whatsappSafeModeBlockedMessage,
  WHATSAPP_APP_ID,
} from '../src/whatsappSafeMode.js';
import { buildAppProfileName } from '../src/services.js';

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

test('buildAppProfileName uses App N labels', () => {
  assert.equal(buildAppProfileName('WhatsApp', 1), 'WhatsApp 1');
  assert.equal(buildAppProfileName('WhatsApp', 2), 'WhatsApp 2');
  assert.equal(buildAppProfileName('Arattai', 1), 'Arattai 1');
  assert.equal(buildAppProfileName('Gmail', 3), 'Gmail 3');
  assert.equal(buildAppProfileName('', 1), 'App 1');
});

test('blocked message mentions Safe Mode and Settings', () => {
  const msg = whatsappSafeModeBlockedMessage('Quick reply');
  assert.match(msg, /WhatsApp Safe Mode/i);
  assert.match(msg, /Quick reply/);
  assert.match(msg, /Settings/);
});
