import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const updaterSrc = fs.readFileSync(
  new URL('../src/updater.js', import.meta.url),
  'utf8',
);

test('busy update check shows downloading progress detail', () => {
  assert.match(updaterSrc, /let downloadProgress = null/);
  assert.match(updaterSrc, /phase: 'downloading'/);
  assert.match(updaterSrc, /progress: downloadProgress/);
  assert.match(
    updaterSrc,
    /Aspera Hub \$\{enriched\.version\} is downloading…/,
  );
  assert.match(
    updaterSrc,
    /onProgress: \(progress\) => \{\s*downloadProgress = \{ \.\.\.progress \};/,
  );
});
