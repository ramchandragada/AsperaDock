import test from 'node:test';
import assert from 'node:assert/strict';
import { GITHUB_UPDATE_FEED, GITHUB_SLUG } from '../src/github.js';

test('default GitHub update feed points at latest.json', () => {
  assert.equal(
    GITHUB_UPDATE_FEED,
    `https://github.com/${GITHUB_SLUG}/releases/latest/download`,
  );
  assert.match(`${GITHUB_UPDATE_FEED}/latest.json`, /\/latest\/download\/latest\.json$/);
});

test('live latest.json feed is reachable', async () => {
  const res = await fetch(`${GITHUB_UPDATE_FEED}/latest.json`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AsperaHub-Updater-Test',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });
  assert.equal(res.ok, true, `expected 200, got ${res.status}`);
  const manifest = await res.json();
  assert.ok(manifest.version, 'manifest.version required');
  assert.ok(manifest.files?.deb?.url || manifest.files?.appimage?.url, 'artifact url required');
});

test('live latest deb artifact URL is downloadable (no 404)', async () => {
  const res = await fetch(`${GITHUB_UPDATE_FEED}/latest.json`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AsperaHub-Updater-Test',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });
  assert.equal(res.ok, true, `manifest expected 200, got ${res.status}`);
  const manifest = await res.json();
  const url = String(manifest?.files?.deb?.url || '').trim();
  assert.ok(url, 'deb url required');
  const head = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers: {
      Accept: 'application/octet-stream,*/*',
      'User-Agent': 'AsperaHub-Updater',
      'Cache-Control': 'no-cache',
    },
  });
  assert.equal(head.ok, true, `deb HEAD expected 200, got ${head.status} for ${url}`);
});
