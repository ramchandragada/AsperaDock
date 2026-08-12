import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stripLegacyExtensionAuthPatches } from '../src/stripLegacyExtensionAuthPatches.js';

test('stripLegacyExtensionAuthPatches removes bootstrap and bridge file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aspera-strip-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        manifest_version: 3,
        name: 'Test',
        version: '1',
        background: { service_worker: 'sw.js' },
        content_scripts: [
          { matches: ['<all_urls>'], js: ['aspera-ext-auth-bridge.js'] },
          { matches: ['https://example.com/*'], js: ['real.js'] },
        ],
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(dir, 'sw.js'),
      "/* aspera-hub-sw-bootstrap */\n(()=>{self.__asperaExtAuthBootstrap=1})();\n/* aspera-hub-sw-bootstrap-end */\nimportScripts('bg.js');\n",
      'utf8',
    );
    fs.writeFileSync(path.join(dir, 'aspera-ext-auth-bridge.js'), 'x', 'utf8');

    assert.equal(stripLegacyExtensionAuthPatches(dir), true);
    assert.equal(fs.existsSync(path.join(dir, 'aspera-ext-auth-bridge.js')), false);
    const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    assert.match(sw, /importScripts\('bg\.js'\)/);
    assert.doesNotMatch(sw, /aspera-hub-sw-bootstrap/);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.content_scripts.length, 1);
    assert.equal(manifest.content_scripts[0].js[0], 'real.js');
    assert.equal(stripLegacyExtensionAuthPatches(dir), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
