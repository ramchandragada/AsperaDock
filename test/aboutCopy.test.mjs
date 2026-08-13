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
    'Annapurna Margam',
    'Arati Gandhal',
    'Diksha Garade',
    'Gokul Zanwar',
    'Rajeshwari Penta',
    'Shlok Naik',
    'Shubham Jog',
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
  const annapurna = detail.indexOf('Annapurna Margam');
  const arati = detail.indexOf('Arati Gandhal');
  const diksha = detail.indexOf('Diksha Garade');
  const gokul = detail.indexOf('Gokul Zanwar');
  const rajeshwari = detail.indexOf('Rajeshwari Penta');
  const shlok = detail.indexOf('Shlok Naik');
  const shubham = detail.indexOf('Shubham Jog');
  const tarun = detail.indexOf('Tarun Pandal');
  assert.ok(
    amar > 0 &&
      annapurna > amar &&
      arati > annapurna &&
      diksha > arati &&
      gokul > diksha &&
      rajeshwari > gokul &&
      shlok > rajeshwari &&
      shubham > shlok &&
      tarun > shubham,
  );
});
