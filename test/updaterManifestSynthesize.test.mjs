import test from 'node:test';
import assert from 'node:assert/strict';
import {
  synthesizeManifestFromGithubRelease,
  githubTaggedManifestUrl,
} from '../src/updateFeedResolve.js';

test('synthesizeManifestFromGithubRelease builds manifest from release assets', () => {
  const manifest = synthesizeManifestFromGithubRelease({
    tag_name: 'v0.5.39',
    body: 'Fix extension login',
    published_at: '2026-08-12T00:00:00Z',
    assets: [
      {
        name: 'asperadock_0.5.39_amd64.deb',
        browser_download_url:
          'https://github.com/ramchandragada/AsperaDock/releases/download/v0.5.39/asperadock_0.5.39_amd64.deb',
        size: 123456789,
      },
    ],
  });
  assert.ok(manifest);
  assert.equal(manifest.version, '0.5.39');
  assert.equal(manifest.synthesized, true);
  assert.equal(manifest.files.deb.url, manifest.files.deb.url);
  assert.equal(manifest.files.deb.size, 123456789);
  assert.equal(manifest.files.deb.sha256, undefined);
});

test('synthesizeManifestFromGithubRelease returns null without install artifacts', () => {
  assert.equal(
    synthesizeManifestFromGithubRelease({ tag_name: 'v1.0.0', assets: [] }),
    null,
  );
});

test('githubTaggedManifestUrl encodes tag path', () => {
  assert.match(githubTaggedManifestUrl('0.5.39'), /\/download\/v0\.5\.39\/latest\.json$/);
});
