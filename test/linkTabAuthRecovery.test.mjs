import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkTabSiteHome,
  isBlankOrErrorGuestUrl,
  isPostAuthStuckUrl,
  isOauthHandoffUrl,
  isCanvaAppUrl,
  isCanvaDesignUrl,
  pageTextLooksLikeCanvaPrivate403,
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

test('isCanvaDesignUrl detects design deep links', () => {
  assert.equal(
    isCanvaDesignUrl('https://www.canva.com/design/DAGxxx/view'),
    true,
  );
  assert.equal(isCanvaDesignUrl('https://www.canva.com/'), false);
  assert.equal(isCanvaDesignUrl('https://www.canva.in/folder/xyz'), true);
});

test('pageTextLooksLikeCanvaPrivate403 matches CF private page', () => {
  const sample =
    'This design is private\nGo to home to keep designing\nError code: 403\nRay ID: a29836f54eb03501-BOM';
  assert.equal(pageTextLooksLikeCanvaPrivate403(sample), true);
  assert.equal(pageTextLooksLikeCanvaPrivate403('Welcome to Canva'), false);
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

test('Canva private 403 after SSO counts as stuck', () => {
  const design = 'https://www.canva.com/design/DAGxxx/view';
  assert.equal(
    isPostAuthStuckUrl(design, {
      pageText:
        'This design is private. Error code: 403 Ray ID: abc-BOM',
    }),
    true,
  );
  assert.equal(isPostAuthStuckUrl(design, { pageText: 'Open design' }), false);
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
