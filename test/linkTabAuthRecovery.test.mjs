import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkTabSiteHome,
  isBlankOrErrorGuestUrl,
  isPostAuthStuckUrl,
  shouldAdoptLinkTabPopupUrlAfterIdp,
} from '../src/linkTabAuthRecovery.js';

test('linkTabSiteHome maps canva.in and canva.com to www.canva.com', () => {
  assert.equal(linkTabSiteHome('https://www.canva.in/'), 'https://www.canva.com/');
  assert.equal(linkTabSiteHome('https://www.canva.com/login'), 'https://www.canva.com/');
  assert.equal(linkTabSiteHome('https://www.canva.com/design/x'), 'https://www.canva.com/');
});

test('isBlankOrErrorGuestUrl detects wiped guests', () => {
  assert.equal(isBlankOrErrorGuestUrl('about:blank'), true);
  assert.equal(isBlankOrErrorGuestUrl('chrome-error://chromewebdata/'), true);
  assert.equal(isBlankOrErrorGuestUrl('https://www.canva.com/'), false);
});

test('isPostAuthStuckUrl treats login shells and callbacks as stuck', () => {
  assert.equal(isPostAuthStuckUrl('https://www.canva.com/login'), true);
  assert.equal(
    isPostAuthStuckUrl('https://www.canva.com/login/oauth?code=abc&state=1'),
    true,
  );
  assert.equal(isPostAuthStuckUrl('https://accounts.google.com/'), true);
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
