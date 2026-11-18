import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('memoryRows resolve names via orderedServices not raw instances', () => {
  assert.match(mainSrc, /memoryRows = monitorOn/);
  assert.match(mainSrc, /orderedServices\(\)/);
  assert.doesNotMatch(
    mainSrc,
    /memoryRows = monitorOn\s*\?\s*\(settings\.serviceInstances/,
  );
  assert.match(
    mainSrc,
    /service\.title \|\|[\s\S]*?service\.name \|\|[\s\S]*?service\.defaultName/,
  );
});
