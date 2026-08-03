import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions,
  resolveUpdateFeedUrl,
} from '../src/updateFeedResolve.js';
import { GITHUB_UPDATE_FEED } from '../src/github.js';

test('compareVersions orders semver-ish strings', () => {
  assert.equal(compareVersions('0.4.57', '0.4.56'), 1);
  assert.equal(compareVersions('0.4.56', '0.4.57'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
});

test('resolveUpdateFeedUrl uses stable latest.json by default', () => {
  assert.equal(
    resolveUpdateFeedUrl({ updateChannel: 'stable' }),
    `${GITHUB_UPDATE_FEED}/latest.json`,
  );
  assert.equal(resolveUpdateFeedUrl({}), `${GITHUB_UPDATE_FEED}/latest.json`);
});

test('resolveUpdateFeedUrl does not point at missing beta.json on GitHub', () => {
  assert.equal(
    resolveUpdateFeedUrl({ updateChannel: 'beta' }),
    `${GITHUB_UPDATE_FEED}/latest.json`,
  );
});

test('resolveUpdateFeedUrl honors custom HTTPS feed + channel file', () => {
  assert.equal(
    resolveUpdateFeedUrl({
      updateFeedUrl: 'https://updates.example.com/hub/',
      updateChannel: 'beta',
    }),
    'https://updates.example.com/hub/beta.json',
  );
  assert.equal(
    resolveUpdateFeedUrl({
      updateFeedUrl: 'https://updates.example.com/hub',
      updateChannel: 'stable',
    }),
    'https://updates.example.com/hub/latest.json',
  );
});
