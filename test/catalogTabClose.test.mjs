import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');

test('catalog apps do not get a Remove-app × on the tab', () => {
  assert.match(
    renderer,
    /Close control — temporary Hub link \/ custom tabs only/,
    'expected catalog × removal comment in makeAppTab',
  );
  assert.match(
    renderer,
    /if \(service\.linkTab \|\| service\.isCustom\) \{\s*const closeBtn/,
    '× button must be gated to link/custom tabs only',
  );
  assert.doesNotMatch(
    renderer,
    /Close control — always for temporary Hub link tabs/,
    'old always-on close control must not return',
  );
  // Middle-click must also be gated
  assert.match(
    renderer,
    /if \(!service\.linkTab && !service\.isCustom\) return;/,
    'middle-click close must skip catalog apps',
  );
});
