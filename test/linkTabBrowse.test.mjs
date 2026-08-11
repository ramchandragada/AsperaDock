import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkTabWindowOpenAction,
  isAuthOrLoginUrl,
  isGoogleOwnedUrl,
  mustKeepGoogleUrlInApp,
  isIdentityProviderUrl,
  isOauthCallbackUrl,
  shouldAdoptLinkTabPopupUrl,
} from '../src/guestNav.js';
import {
  shouldAdoptLinkTabPopupUrlAfterIdp,
  linkTabSiteHome,
} from '../src/linkTabAuthRecovery.js';

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

test('legacy shouldAdoptLinkTabPopupUrl still accepts Canva paths (compat)', () => {
  assert.equal(isAuthOrLoginUrl('https://www.canva.com/login'), true);
  assert.equal(shouldAdoptLinkTabPopupUrl('https://www.canva.com/login'), true);
});

test('post-IdP adopt skips login shells (fixes 0.5.25 Canva white pane)', () => {
  assert.equal(
    shouldAdoptLinkTabPopupUrlAfterIdp('https://www.canva.com/login', {
      sawIdp: true,
    }),
    false,
  );
  assert.equal(
    shouldAdoptLinkTabPopupUrlAfterIdp('https://www.canva.com/', { sawIdp: true }),
    true,
  );
  assert.equal(linkTabSiteHome('https://www.canva.in/login'), 'https://www.canva.in/');
  assert.equal(linkTabSiteHome('https://www.canva.com/login'), 'https://www.canva.com/');
  assert.equal(isIdentityProviderUrl('https://accounts.google.com/'), true);
  assert.equal(isOauthCallbackUrl('https://www.canva.com/?code=x'), true);
  assert.equal(mustKeepGoogleUrlInApp('https://accounts.google.com/'), true);
  assert.equal(isGoogleOwnedUrl('https://www.google.com/search?q=canva'), true);
});
