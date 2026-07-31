import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Regression: getAppConfig must not call orderedServices/getService.
 * That cycle caused Maximum call stack size exceeded on startup.
 */
test('getAppConfig must not call getService/orderedServices', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const fn = src.match(/function getAppConfig\(id\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'getAppConfig function present');
  assert.equal(
    /getService\s*\(/.test(fn[0]),
    false,
    'getAppConfig must not call getService (infinite recursion)',
  );
  assert.equal(
    /orderedServices\s*\(/.test(fn[0]),
    false,
    'getAppConfig must not call orderedServices',
  );
  assert.match(fn[0], /getRawInstance/, 'getAppConfig should use getRawInstance');
});
