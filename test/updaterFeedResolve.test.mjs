import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions,
  resolveUpdateFeedUrl,
  shouldJumpToNewerUpdate,
  MAX_UPDATE_LATEST_HOPS,
} from '../src/updateFeedResolve.js';
import { GITHUB_UPDATE_FEED } from '../src/github.js';
import fs from 'node:fs';

test('compareVersions orders semver-ish strings', () => {
  assert.equal(compareVersions('0.4.57', '0.4.56'), 1);
  assert.equal(compareVersions('0.4.56', '0.4.57'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
});

test('shouldJumpToNewerUpdate skips mid-versions', () => {
  assert.equal(shouldJumpToNewerUpdate('0.5.88', '0.5.90'), true);
  assert.equal(shouldJumpToNewerUpdate('0.5.90', '0.5.90'), false);
  assert.equal(shouldJumpToNewerUpdate('0.5.90', '0.5.89'), false);
  assert.ok(MAX_UPDATE_LATEST_HOPS >= 3);
});

test('updater jumps to absolute latest before download/install', () => {
  const updaterSrc = fs.readFileSync(
    new URL('../src/updater.js', import.meta.url),
    'utf8',
  );
  assert.match(updaterSrc, /function refreshPendingToAbsoluteLatest/);
  assert.match(updaterSrc, /shouldJumpToNewerUpdate/);
  assert.match(updaterSrc, /UPDATE_SUPERSEDED/);
  assert.match(updaterSrc, /hopCount < MAX_UPDATE_LATEST_HOPS/);
  assert.match(updaterSrc, /jumpedToLatest: true/);
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
