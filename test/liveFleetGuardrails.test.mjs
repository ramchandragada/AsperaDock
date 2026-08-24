import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_CATALOG,
  allowsZohoWorkspaceHubTabs,
  canShareProfileAcrossInstances,
  getAppCatalogEntry,
} from '../src/services.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('live fleet: Zoho WorkDrive remains in the catalog', () => {
  assert.ok(getAppCatalogEntry('zoho-workdrive'));
  assert.ok(APP_CATALOG.some((a) => a.appId === 'zoho-workdrive'));
});

test('live fleet: catalog apps do not get a Remove-app ×', () => {
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  assert.match(
    renderer,
    /if \(service\.linkTab \|\| service\.isCustom\) \{[\s\S]{0,200}?app-tab-close/,
  );
  assert.doesNotMatch(
    renderer,
    /title = service\.linkTab \|\| service\.isCustom \? 'Close tab' : 'Remove app'/,
  );
});

test('live fleet: multi CRM orgs get isolated profiles on catalog add', () => {
  assert.equal(canShareProfileAcrossInstances('zoho-crm'), false);
  assert.equal(allowsZohoWorkspaceHubTabs('zoho-crm'), true);
});

test('live fleet: store migrates shared Zoho workspace profiles', () => {
  const store = fs.readFileSync(path.join(root, 'src/store.js'), 'utf8');
  assert.match(store, /isolateSharedZohoWorkspaceProfiles/);
  assert.ok(fs.existsSync(path.join(root, 'src/zohoWorkspaceProfiles.js')));
});
