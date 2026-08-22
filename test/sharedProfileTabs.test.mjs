import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowsZohoWorkspaceHubTabs,
  canShareProfileAcrossInstances,
} from '../src/services.js';

test('Zoho CRM gets its own profile per catalog add (multi-org TLs)', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-crm'), false);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-crm'), true);
});

test('Zoho One and Books still share workspace login across tabs', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-one'), true);
  assert.equal(canShareProfileAcrossInstances('zoho-books'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-one'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-books'), true);
});

test('Zoho Mail is isolated like Gmail (separate mailbox sessions)', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-mail'), false);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-mail'), false);
});

test('WhatsApp and Gmail still require separate profiles per instance', () => {
  assert.equal(canShareProfileAcrossInstances('whatsapp'), false);
  assert.equal(canShareProfileAcrossInstances('gmail'), false);
  assert.equal(canShareProfileAcrossInstances('arattai'), false);
});
