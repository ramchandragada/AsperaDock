import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGoogleRequestHeaders } from '../src/vendors/googleHeaders.js';
import { assertHttpsUrl } from '../src/netTrust.js';

test('Google accounts host gets Firefox UA and no Client Hints', () => {
  const out = applyGoogleRequestHeaders(
    { 'User-Agent': 'Chrome' },
    'https://accounts.google.com/signin',
    {
      chromeUA: 'CHROME',
      firefoxAccountsUA: 'FIREFOX',
      secChUa: '"Google Chrome";v="138"',
      enabled: true,
    },
  );
  assert.equal(out['User-Agent'], 'FIREFOX');
  assert.equal(out['sec-ch-ua'], undefined);
});

test('other Google hosts get Chrome Client Hints', () => {
  const out = applyGoogleRequestHeaders(
    {},
    'https://mail.google.com/',
    {
      chromeUA: 'CHROME',
      firefoxAccountsUA: 'FIREFOX',
      secChUa: '"Google Chrome";v="138"',
      enabled: true,
    },
  );
  assert.equal(out['User-Agent'], 'CHROME');
  assert.equal(out['sec-ch-ua'], '"Google Chrome";v="138"');
});

test('spoof can be disabled', () => {
  const input = { 'User-Agent': 'keep' };
  const out = applyGoogleRequestHeaders(input, 'https://accounts.google.com/', {
    chromeUA: 'CHROME',
    firefoxAccountsUA: 'FIREFOX',
    secChUa: 'X',
    enabled: false,
  });
  assert.equal(out['User-Agent'], 'keep');
});

test('assertHttpsUrl rejects http', () => {
  assert.throws(() => assertHttpsUrl('http://evil/x', 'Update artifact URL'));
  assert.doesNotThrow(() => assertHttpsUrl('https://good.example/x.deb', 'Update artifact URL'));
});
