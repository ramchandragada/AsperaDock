import test from 'node:test';
import assert from 'node:assert/strict';
import { isolateSharedZohoMailProfiles } from '../src/zohoMailProfiles.js';

function makeProfile(name) {
  const id = `p-${String(name).toLowerCase().replace(/\s+/g, '-')}`;
  return { id, name, partition: `persist:profile-${id}` };
}

test('isolateSharedZohoMailProfiles is a no-op when already migrated', () => {
  const settings = {
    isolateZohoMailProfilesV1: true,
    serviceInstances: [
      { id: 'kyc', appId: 'zoho-mail', profileId: 'shared', slot: 1 },
      { id: 'comp', appId: 'zoho-mail', profileId: 'shared', slot: 2 },
    ],
    profiles: [{ id: 'shared', name: 'Zoho Mail 1', partition: 'persist:profile-shared' }],
  };
  const next = isolateSharedZohoMailProfiles(settings, { makeProfile });
  assert.equal(next.serviceInstances[1].profileId, 'shared');
});

test('keeps first Zoho Mail on the shared profile and splits extras', () => {
  const settings = {
    serviceLabels: {
      kyc: { name: 'KYC' },
      comp: { name: 'Compliance' },
    },
    serviceInstances: [
      { id: 'kyc', appId: 'zoho-mail', profileId: 'shared', slot: 1 },
      { id: 'comp', appId: 'zoho-mail', profileId: 'shared', slot: 2 },
      { id: 'crm', appId: 'zoho-crm', profileId: 'shared', slot: 1 },
    ],
    profiles: [{ id: 'shared', name: 'Zoho Mail 1', partition: 'persist:profile-shared' }],
  };
  const next = isolateSharedZohoMailProfiles(settings, { makeProfile });
  assert.equal(next.isolateZohoMailProfilesV1, true);
  assert.equal(next.serviceInstances[0].profileId, 'shared');
  assert.equal(next.serviceInstances[1].profileId, 'p-compliance');
  assert.equal(next.serviceInstances[2].profileId, 'shared');
  assert.ok(next.profiles.some((p) => p.id === 'p-compliance'));
});

test('does not split Zoho Mail tabs that already have unique profiles', () => {
  const settings = {
    serviceInstances: [
      { id: 'kyc', appId: 'zoho-mail', profileId: 'a', slot: 1 },
      { id: 'comp', appId: 'zoho-mail', profileId: 'b', slot: 2 },
    ],
    profiles: [
      { id: 'a', name: 'Mail 1', partition: 'persist:profile-a' },
      { id: 'b', name: 'Mail 2', partition: 'persist:profile-b' },
    ],
  };
  const next = isolateSharedZohoMailProfiles(settings, { makeProfile });
  assert.equal(next.serviceInstances[0].profileId, 'a');
  assert.equal(next.serviceInstances[1].profileId, 'b');
  assert.equal(next.profiles.length, 2);
});
