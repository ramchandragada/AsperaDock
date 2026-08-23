import test from 'node:test';
import assert from 'node:assert/strict';
import { canShareProfileAcrossInstances } from '../src/services.js';

test('Zoho workspace apps can share one profile across Hub tabs', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-crm'), true);
  assert.equal(canShareProfileAcrossInstances('zoho-one'), true);
  assert.equal(canShareProfileAcrossInstances('zoho-books'), true);
  assert.equal(canShareProfileAcrossInstances('zoho-workdrive'), true);
});

test('Zoho Mail is isolated like Gmail (separate mailbox sessions)', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-mail'), false);
});

test('WhatsApp and Gmail still require separate profiles per instance', () => {
  assert.equal(canShareProfileAcrossInstances('whatsapp'), false);
  assert.equal(canShareProfileAcrossInstances('gmail'), false);
  assert.equal(canShareProfileAcrossInstances('arattai'), false);
  assert.equal(canShareProfileAcrossInstances('chatgpt'), false);
});
