import test from 'node:test';
import assert from 'node:assert/strict';
import { isolateSharedZohoCrmProfiles } from '../src/zohoCrmProfiles.js';

const makeProfile = (name) => ({
  id: `p-${name.replace(/\s+/g, '-').toLowerCase()}`,
  name,
  partition: `persist:crm-${name}`,
});

test('isolateSharedZohoCrmProfiles is a no-op when already migrated', () => {
  const settings = {
    isolateZohoCrmProfilesV1: true,
    serviceInstances: [{ id: 'a', appId: 'zoho-crm', profileId: 'primary', slot: 1 }],
  };
  const next = isolateSharedZohoCrmProfiles(settings, { makeProfile });
  assert.equal(next, settings);
});

test('isolateSharedZohoCrmProfiles splits second CRM onto its own profile', () => {
  const settings = {
    serviceInstances: [
      { id: 'crm-1', appId: 'zoho-crm', profileId: 'primary', slot: 1 },
      { id: 'crm-2', appId: 'zoho-crm', profileId: 'primary', slot: 2 },
    ],
    profiles: [{ id: 'primary', name: 'Primary', partition: 'persist:primary' }],
    serviceLabels: { 'crm-2': { name: 'Sales CRM' } },
  };
  const next = isolateSharedZohoCrmProfiles(settings, { makeProfile });
  assert.equal(next.isolateZohoCrmProfilesV1, true);
  assert.equal(next.serviceInstances[0].profileId, 'primary');
  assert.equal(next.serviceInstances[1].profileId, 'p-sales-crm');
  assert.equal(next.profiles.length, 2);
});

test('isolateSharedZohoCrmProfiles leaves Books/One untouched', () => {
  const settings = {
    serviceInstances: [
      { id: 'b1', appId: 'zoho-books', profileId: 'primary', slot: 1 },
      { id: 'b2', appId: 'zoho-books', profileId: 'primary', slot: 2 },
    ],
    profiles: [{ id: 'primary', name: 'Primary', partition: 'persist:primary' }],
  };
  const next = isolateSharedZohoCrmProfiles(settings, { makeProfile });
  assert.equal(next.serviceInstances[1].profileId, 'primary');
});
