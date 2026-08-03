import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Regression: getAppConfig must not call orderedServices/getService.
 * That cycle caused Maximum call stack size exceeded on startup.
 */
test('getAppConfig must not call getService/orderedServices', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = src.indexOf('function getAppConfig(id) {');
  assert.ok(start >= 0, 'getAppConfig function present');
  const end = src.indexOf('\nfunction ', start + 1);
  const fn = src.slice(start, end > start ? end : start + 800);
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal(/\bgetService\s*\(/.test(code), false, 'no getService() call');
  assert.equal(/\borderedServices\s*\(/.test(code), false, 'no orderedServices() call');
  assert.match(code, /getRawInstance/, 'uses getRawInstance');
});
