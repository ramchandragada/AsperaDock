import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARLY_CONTRIBUTORS,
  EARLY_CONTRIBUTORS_MAX,
  aboutDetailText,
  sortedContributors,
} from '../src/aboutCopy.js';

test('early contributors stay alphabetical and under the 25-name cap', () => {
  assert.ok(EARLY_CONTRIBUTORS.length <= EARLY_CONTRIBUTORS_MAX);
  assert.deepEqual(
    EARLY_CONTRIBUTORS,
    sortedContributors(EARLY_CONTRIBUTORS),
  );
  assert.deepEqual(sortedContributors(EARLY_CONTRIBUTORS), [
    'Amar Vallakati',
    'Diksha Garade',
    'Tarun Pandal',
  ]);
});

test('About text lists contributors as alphabetical', () => {
  const detail = aboutDetailText({
    electronVersion: '1.0.0',
    chromeVersion: '2.0.0',
  });
  assert.match(detail, /Early contributors \(alphabetical order\):/);
  assert.match(detail, /Website: https:\/\/asperahub\.com/);
  const amar = detail.indexOf('Amar Vallakati');
  const diksha = detail.indexOf('Diksha Garade');
  const tarun = detail.indexOf('Tarun Pandal');
  assert.ok(amar > 0 && diksha > amar && tarun > diksha);
});
