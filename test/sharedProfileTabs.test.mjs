import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowsZohoWorkspaceHubTabs,
  canShareProfileAcrossInstances,
} from '../src/services.js';

test('catalog adds never reuse another instance profile (multi CRM orgs)', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-crm'), false);
  assert.equal(canShareProfileAcrossInstances('zoho-books'), false);
  assert.equal(canShareProfileAcrossInstances('zoho-one'), false);
  assert.equal(canShareProfileAcrossInstances('zoho-workdrive'), false);
  assert.equal(canShareProfileAcrossInstances('whatsapp'), false);
  assert.equal(canShareProfileAcrossInstances('gmail'), false);
});

test('Zoho workspace apps still allow same-login Hub deep-link tabs', () => {
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-crm'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-one'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-books'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-workdrive'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-mail'), false);
});

test('Zoho Mail stays isolated like Gmail', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-mail'), false);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-mail'), false);
});
