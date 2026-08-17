import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkTabSiteHome,
  isBlankOrErrorGuestUrl,
  isPostAuthStuckUrl,
  isOauthHandoffUrl,
  shouldAdoptLinkTabPopupUrlAfterIdp,
} from '../src/linkTabAuthRecovery.js';
import { safeStartUrlForService } from '../src/guestNav.js';
import { getAppCatalogEntry } from '../src/services.js';

test('linkTabSiteHome keeps canva.in separate from canva.com', () => {
  assert.equal(linkTabSiteHome('https://www.canva.in/login'), 'https://www.canva.in/');
  assert.equal(linkTabSiteHome('https://www.canva.com/login'), 'https://www.canva.com/');
});

test('catalog no longer includes Canva', () => {
  assert.equal(getAppCatalogEntry('canva'), null);
});

test('safeStartUrlForService still protects Zoho One deep links', () => {
  const zoho = {
    appId: 'zoho-one',
    url: 'https://one.zoho.in/zohoone/org/home',
  };
  assert.equal(
    safeStartUrlForService(
      zoho,
      'https://one.zoho.in/zohoone/org/home/cxapp-spaces/x',
    ),
    zoho.url,
  );
});

test('login and OAuth callback are handoffs — not stuck', () => {
  assert.equal(isOauthHandoffUrl('https://www.canva.com/login'), true);
  assert.equal(isPostAuthStuckUrl('https://www.canva.com/login'), false);
  assert.equal(isPostAuthStuckUrl('about:blank'), true);
  assert.equal(isBlankOrErrorGuestUrl('about:blank'), true);
});

test('design URLs are not treated as stuck without blank/error', () => {
  const design = 'https://www.canva.com/design/DAGxxx/view';
  assert.equal(isPostAuthStuckUrl(design), false);
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
