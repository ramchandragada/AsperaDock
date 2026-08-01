import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../src/updater.js';
import { GITHUB_UPDATE_FEED, GITHUB_SLUG } from '../src/github.js';

test('default GitHub update feed points at latest.json', () => {
  assert.equal(
    GITHUB_UPDATE_FEED,
    `https://github.com/${GITHUB_SLUG}/releases/latest/download`,
  );
  assert.match(`${GITHUB_UPDATE_FEED}/latest.json`, /\/latest\/download\/latest\.json$/);
});

test('compareVersions treats feed versions correctly', () => {
  assert.equal(compareVersions('0.2.88', '0.2.87'), 1);
  assert.equal(compareVersions('0.2.87', '0.2.87'), 0);
  assert.equal(compareVersions('0.2.86', '0.2.87'), -1);
});
