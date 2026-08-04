import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthOrLoginUrl,
  isGoogleOwnedUrl,
  mustKeepGoogleUrlInApp,
} from '../src/guestNav.js';

/**
 * Mirrors Hub link-tab policy: Google auth may use a real popup; everything
 * else from a temporary WhatsApp/Arattai link tab stays in that same tab.
 */
function linkTabKeepsBrowseInPlace(url) {
  if ((isAuthOrLoginUrl(url) && isGoogleOwnedUrl(url)) || mustKeepGoogleUrlInApp(url)) {
    return false;
  }
  return true;
}

test('Canva login / app URLs stay in the Hub link tab (no second top-bar tab)', () => {
  assert.equal(linkTabKeepsBrowseInPlace('https://www.canva.com/login'), true);
  assert.equal(linkTabKeepsBrowseInPlace('https://www.canva.com/design/ABC/edit'), true);
  assert.equal(linkTabKeepsBrowseInPlace('https://www.canva.com/'), true);
});

test('Google account auth from a link tab may use a real popup', () => {
  assert.equal(
    linkTabKeepsBrowseInPlace(
      'https://accounts.google.com/signin/oauth?client_id=x',
    ),
    false,
  );
  assert.equal(
    linkTabKeepsBrowseInPlace('https://accounts.google.com/o/oauth2/v2/auth?x=1'),
    false,
  );
});
