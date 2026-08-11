import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGoogleRequestHeaders,
  isThirdPartyGoogleOauthRequest,
  isGoogleInsecureBrowserErrorUrl,
} from '../src/vendors/googleHeaders.js';
import { assertHttpsUrl } from '../src/netTrust.js';

const opts = {
  chromeUA: 'CHROME',
  firefoxAccountsUA: 'FIREFOX',
  secChUa: '"Google Chrome";v="138"',
  enabled: true,
};

test('accounts.google.com always gets Firefox UA (secure-browser gate)', () => {
  const out = applyGoogleRequestHeaders(
    { 'User-Agent': 'Chrome' },
    'https://accounts.google.com/signin',
    opts,
  );
  assert.equal(out['User-Agent'], 'FIREFOX');
  assert.equal(out['sec-ch-ua'], undefined);
});

test('Canva OAuth on accounts still uses Firefox (never Chrome)', () => {
  const out = applyGoogleRequestHeaders(
    { Referer: 'https://www.canva.com/login' },
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=https%3A%2F%2Fwww.canva.com%2Flogin',
    { ...opts, preferChromeAccounts: true },
  );
  assert.equal(out['User-Agent'], 'FIREFOX');
  assert.equal(isThirdPartyGoogleOauthRequest(
    'https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fwww.canva.com%2F',
    {},
  ), true);
});

test('other Google hosts get Chrome Client Hints', () => {
  const out = applyGoogleRequestHeaders({}, 'https://mail.google.com/', opts);
  assert.equal(out['User-Agent'], 'CHROME');
  assert.equal(out['sec-ch-ua'], '"Google Chrome";v="138"');
});

test('detect Google insecure-browser error URLs', () => {
  assert.equal(
    isGoogleInsecureBrowserErrorUrl(
      'https://accounts.google.com/signin/rejected?client_id=x',
    ),
    true,
  );
  assert.equal(
    isGoogleInsecureBrowserErrorUrl('https://accounts.google.com/signin'),
    false,
  );
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
