import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthOrLoginUrl,
  isGoogleOwnedUrl,
  mustKeepGoogleUrlInApp,
  linkTabWindowOpenAction,
  shouldAdoptLinkTabPopupUrl,
  isIdentityProviderUrl,
  isOauthCallbackUrl,
} from '../src/guestNav.js';

/**
 * Mirrors Hub link-tab policy: Google auth may use a real popup; everything
 * else from a temporary WhatsApp/Arattai / Web Search link tab stays in that
 * same tab (Google /url wrappers unwrap in-tab).
 */
function linkTabKeepsBrowseInPlace(url) {
  return linkTabWindowOpenAction(url) === 'in-tab';
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

test('Google search /url results unwrap into the same link tab (not a popup)', () => {
  const wrapped =
    'https://www.google.com/url?q=https%3A%2F%2Fwww.canva.com%2F&sa=U';
  assert.equal(linkTabWindowOpenAction(wrapped), 'in-tab');
  assert.equal(
    linkTabWindowOpenAction(
      'https://www.google.com/url?q=https%3A%2F%2Faccounts.google.com%2Fsignin',
    ),
    'popup',
  );
});

test('shouldAdoptLinkTabPopupUrl accepts Canva post-login paths', () => {
  // Regression: isAuthOrLoginUrl alone skipped these and left a blank Hub tab.
  assert.equal(isAuthOrLoginUrl('https://www.canva.com/login'), true);
  assert.equal(shouldAdoptLinkTabPopupUrl('https://www.canva.com/login'), true);
  assert.equal(shouldAdoptLinkTabPopupUrl('https://www.canva.com/'), true);
  assert.equal(
    shouldAdoptLinkTabPopupUrl('https://www.canva.com/design/ABC/edit'),
    true,
  );
});

test('shouldAdoptLinkTabPopupUrl rejects IdP and OAuth callback URLs', () => {
  assert.equal(
    shouldAdoptLinkTabPopupUrl('https://accounts.google.com/o/oauth2/v2/auth'),
    false,
  );
  assert.equal(
    shouldAdoptLinkTabPopupUrl(
      'https://www.canva.com/login/oauth/callback?code=abc&state=1',
    ),
    false,
  );
  assert.equal(isOauthCallbackUrl('https://www.canva.com/?code=xyz'), true);
  assert.equal(isIdentityProviderUrl('https://login.microsoftonline.com/common'), true);
  assert.equal(mustKeepGoogleUrlInApp('https://accounts.google.com/'), true);
  assert.equal(isGoogleOwnedUrl('https://www.google.com/search?q=canva'), true);
  assert.equal(
    shouldAdoptLinkTabPopupUrl('https://www.google.com/search?q=canva'),
    false,
  );
});
