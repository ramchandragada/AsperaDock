import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowsZohoWorkspaceHubTabs,
  canShareProfileAcrossInstances,
} from '../src/services.js';

test('every catalog app gets its own profile on add', () => {
  for (const appId of [
    'whatsapp',
    'arattai',
    'gmail',
    'zoho-mail',
    'zoho-crm',
    'zoho-books',
    'zoho-one',
  ]) {
    assert.equal(
      canShareProfileAcrossInstances(appId),
      false,
      `${appId} should not reuse profiles`,
    );
  }
});

test('Zoho workspace apps still allow in-tab deep links as Hub tabs', () => {
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-crm'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-books'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-one'), true);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-mail'), false);
  assert.equal(allowsZohoWorkspaceHubTabs('gmail'), false);
});
