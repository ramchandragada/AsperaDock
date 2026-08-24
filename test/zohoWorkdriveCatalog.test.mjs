import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_CATALOG,
  canShareProfileAcrossInstances,
  defaultInstanceName,
  getAppCatalogEntry,
} from '../src/services.js';

test('Zoho WorkDrive is in the Aspera catalog', () => {
  const entry = getAppCatalogEntry('zoho-workdrive');
  assert.ok(entry);
  assert.equal(entry.url, 'https://workdrive.zoho.in/');
  assert.equal(entry.title, 'Zoho WorkDrive');
  assert.equal(entry.logo, 'zoho-workdrive');
  assert.equal(entry.color, '#00A7B5');
  assert.ok(APP_CATALOG.some((a) => a.appId === 'zoho-workdrive'));
});

test('WorkDrive tab label stays short and shares Zoho workspace login', () => {
  const entry = getAppCatalogEntry('zoho-workdrive');
  assert.equal(defaultInstanceName(entry, 1), 'Drive');
  assert.equal(canShareProfileAcrossInstances('zoho-workdrive'), true);
});
