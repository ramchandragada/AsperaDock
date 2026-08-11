import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkTabSiteHome,
  isBlankOrErrorGuestUrl,
  isPostAuthStuckUrl,
  isOauthHandoffUrl,
  shouldAdoptLinkTabPopupUrlAfterIdp,
} from '../src/linkTabAuthRecovery.js';

test('linkTabSiteHome keeps canva.in separate from canva.com', () => {
  assert.equal(linkTabSiteHome('https://www.canva.in/'), 'https://www.canva.in/');
  assert.equal(linkTabSiteHome('https://www.canva.in/login'), 'https://www.canva.in/');
  assert.equal(linkTabSiteHome('https://www.canva.com/login'), 'https://www.canva.com/');
  assert.equal(linkTabSiteHome('https://www.canva.com/design/x'), 'https://www.canva.com/');
});

test('isBlankOrErrorGuestUrl detects wiped guests', () => {
  assert.equal(isBlankOrErrorGuestUrl('about:blank'), true);
  assert.equal(isBlankOrErrorGuestUrl('chrome-error://chromewebdata/'), true);
  assert.equal(isBlankOrErrorGuestUrl('https://www.canva.com/'), false);
});

test('login and OAuth callback are handoffs — not stuck (no forced home)', () => {
  assert.equal(isOauthHandoffUrl('https://www.canva.com/login'), true);
  assert.equal(
    isOauthHandoffUrl('https://www.canva.com/login/oauth?code=abc&state=1'),
    true,
  );
  assert.equal(isOauthHandoffUrl('https://accounts.google.com/'), true);
  assert.equal(isPostAuthStuckUrl('https://www.canva.com/login'), false);
  assert.equal(
    isPostAuthStuckUrl('https://www.canva.com/login/oauth?code=abc&state=1'),
    false,
  );
  assert.equal(isPostAuthStuckUrl('about:blank'), true);
  assert.equal(isPostAuthStuckUrl('https://www.canva.com/'), false);
});

test('popup adopt waits for IdP and skips login shells', () => {
  assert.equal(
    shouldAdoptLinkTabPopupUrlAfterIdp('https://www.canva.com/login', {
      sawIdp: false,
    }),
    false,
  );
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
  assert.equal(
    shouldAdoptLinkTabPopupUrlAfterIdp('https://www.canva.com/', { sawIdp: false }),
    false,
  );
});
