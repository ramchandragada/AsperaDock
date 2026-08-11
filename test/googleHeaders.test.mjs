import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGoogleRequestHeaders,
  isThirdPartyGoogleOauthRequest,
  isGoogleAccountsOauthPath,
} from '../src/vendors/googleHeaders.js';
import { assertHttpsUrl } from '../src/netTrust.js';

const opts = {
  chromeUA: 'CHROME',
  firefoxAccountsUA: 'FIREFOX',
  secChUa: '"Google Chrome";v="138"',
  enabled: true,
};

test('Google accounts host gets Firefox UA and no Client Hints by default', () => {
  const out = applyGoogleRequestHeaders(
    { 'User-Agent': 'Chrome' },
    'https://accounts.google.com/signin',
    opts,
  );
  assert.equal(out['User-Agent'], 'FIREFOX');
  assert.equal(out['sec-ch-ua'], undefined);
});

test('Canva OAuth start keeps Chrome UA', () => {
  const out = applyGoogleRequestHeaders(
    { Referer: 'https://www.canva.com/login' },
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=https%3A%2F%2Fwww.canva.com%2Flogin',
    opts,
  );
  assert.equal(out['User-Agent'], 'CHROME');
  assert.equal(out['sec-ch-ua'], '"Google Chrome";v="138"');
});

test('sticky preferChromeAccounts keeps Chrome on consent (no canva in URL)', () => {
  const consent =
    'https://accounts.google.com/signin/oauth/consent?authuser=0&part=…';
  assert.equal(isGoogleAccountsOauthPath(consent), true);
  assert.equal(isThirdPartyGoogleOauthRequest(consent, {}), false);
  const out = applyGoogleRequestHeaders({}, consent, {
    ...opts,
    preferChromeAccounts: true,
  });
  assert.equal(out['User-Agent'], 'CHROME');
});

test('other Google hosts get Chrome Client Hints', () => {
  const out = applyGoogleRequestHeaders({}, 'https://mail.google.com/', opts);
  assert.equal(out['User-Agent'], 'CHROME');
  assert.equal(out['sec-ch-ua'], '"Google Chrome";v="138"');
});

test('spoof can be disabled', () => {
  const input = { 'User-Agent': 'keep' };
  const out = applyGoogleRequestHeaders(input, 'https://accounts.google.com/', {
    ...opts,
    enabled: false,
  });
  assert.equal(out['User-Agent'], 'keep');
});

test('assertHttpsUrl rejects http', () => {
  assert.throws(() => assertHttpsUrl('http://evil/x', 'Update artifact URL'));
  assert.doesNotThrow(() =>
    assertHttpsUrl('https://good.example/x.deb', 'Update artifact URL'),
  );
});
