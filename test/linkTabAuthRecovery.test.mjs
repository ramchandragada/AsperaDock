import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkTabSiteHome,
  isBlankOrErrorGuestUrl,
  isPostAuthStuckUrl,
  isOauthHandoffUrl,
  isCanvaAppUrl,
  shouldAdoptLinkTabPopupUrlAfterIdp,
} from '../src/linkTabAuthRecovery.js';
import { getAppCatalogEntry } from '../src/services.js';

test('linkTabSiteHome keeps canva.in separate from canva.com', () => {
  assert.equal(linkTabSiteHome('https://www.canva.in/login'), 'https://www.canva.in/');
  assert.equal(linkTabSiteHome('https://www.canva.com/login'), 'https://www.canva.com/');
});

test('isCanvaAppUrl detects canva hosts', () => {
  assert.equal(isCanvaAppUrl('https://www.canva.com/'), true);
  assert.equal(isCanvaAppUrl('https://www.canva.in/login'), true);
  assert.equal(isCanvaAppUrl('https://www.google.com/'), false);
});

test('catalog includes Canva', () => {
  const entry = getAppCatalogEntry('canva');
  assert.equal(entry?.appId, 'canva');
  assert.equal(entry?.url, 'https://www.canva.com/');
});

test('login and OAuth callback are handoffs — not stuck', () => {
  assert.equal(isOauthHandoffUrl('https://www.canva.com/login'), true);
  assert.equal(isPostAuthStuckUrl('https://www.canva.com/login'), false);
  assert.equal(isPostAuthStuckUrl('about:blank'), true);
  assert.equal(isBlankOrErrorGuestUrl('about:blank'), true);
});

test('popup adopt waits for IdP and skips login shells', () => {
  assert.equal(
    shouldAdoptLinkTabPopupUrlAfterIdp('https://www.canva.com/', { sawIdp: true }),
    true,
  );
  assert.equal(
    shouldAdoptLinkTabPopupUrlAfterIdp('https://www.canva.com/login', {
      sawIdp: true,
    }),
    false,
  );
});
