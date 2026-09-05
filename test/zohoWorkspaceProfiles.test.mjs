import test from 'node:test';
import assert from 'node:assert/strict';
import { isolateSharedZohoWorkspaceProfiles } from '../src/zohoWorkspaceProfiles.js';

const makeProfile = (name) => ({
  id: `p-${name.replace(/\s+/g, '-').toLowerCase()}`,
  name,
  partition: `persist:${name}`,
});

test('isolateSharedZohoWorkspaceProfiles is a no-op when already migrated', () => {
  const settings = {
    isolateZohoWorkspaceProfilesV1: true,
    serviceInstances: [{ id: 'a', appId: 'zoho-crm', profileId: 'primary', slot: 1 }],
  };
  const next = isolateSharedZohoWorkspaceProfiles(settings, { makeProfile });
  assert.equal(next, settings);
});

test('splits second CRM, Books, and One onto dedicated profiles', () => {
  const settings = {
    serviceInstances: [
      { id: 'crm-1', appId: 'zoho-crm', profileId: 'primary', slot: 1 },
      { id: 'crm-2', appId: 'zoho-crm', profileId: 'primary', slot: 2 },
      { id: 'books-1', appId: 'zoho-books', profileId: 'primary', slot: 1 },
      { id: 'books-2', appId: 'zoho-books', profileId: 'primary', slot: 2 },
      { id: 'one-1', appId: 'zoho-one', profileId: 'primary', slot: 1 },
      { id: 'one-2', appId: 'zoho-one', profileId: 'primary', slot: 2 },
      { id: 'wd-1', appId: 'zoho-workdrive', profileId: 'primary', slot: 1 },
      { id: 'wd-2', appId: 'zoho-workdrive', profileId: 'primary', slot: 2 },
    ],
    profiles: [{ id: 'primary', name: 'Primary', partition: 'persist:primary' }],
  };
  const next = isolateSharedZohoWorkspaceProfiles(settings, { makeProfile });
  assert.equal(next.isolateZohoWorkspaceProfilesV1, true);
  assert.equal(next.serviceInstances[0].profileId, 'primary');
  assert.notEqual(next.serviceInstances[1].profileId, 'primary');
  assert.notEqual(next.serviceInstances[3].profileId, 'primary');
  assert.notEqual(next.serviceInstances[5].profileId, 'primary');
  assert.notEqual(next.serviceInstances[7].profileId, 'primary');
  assert.equal(next.profiles.length, 5);
});

test('migrates Books/One for users who already ran CRM-only migration', () => {
  const settings = {
    isolateZohoCrmProfilesV1: true,
    serviceInstances: [
      { id: 'b1', appId: 'zoho-books', profileId: 'primary', slot: 1 },
      { id: 'b2', appId: 'zoho-books', profileId: 'primary', slot: 2 },
    ],
    profiles: [{ id: 'primary', name: 'Primary', partition: 'persist:primary' }],
  };
  const next = isolateSharedZohoWorkspaceProfiles(settings, { makeProfile });
  assert.equal(next.isolateZohoWorkspaceProfilesV1, true);
  assert.notEqual(next.serviceInstances[1].profileId, 'primary');
});
