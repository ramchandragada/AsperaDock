import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('release gate script and workflow exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/assert-release-from-master.mjs')));
  assert.ok(fs.existsSync(path.join(root, '.github/workflows/release-guard.yml')));
  const pub = fs.readFileSync(path.join(root, 'scripts/publish-update.mjs'), 'utf8');
  assert.match(pub, /assert-release-from-master/);
  const rule = fs.readFileSync(
    path.join(root, '.cursor/rules/bump-version-on-change.mdc'),
    'utf8',
  );
  assert.match(rule, /master only/i);
  assert.match(rule, /Do NOT.*gh release create/i);
});
