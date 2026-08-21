import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSameEcosystemUrl,
  isZohoOwnedUrl,
  isZohoAssetHost,
  shouldOpenZohoSharedDeepLinkAsHubTab,
  shouldOpenZohoCrmDeepLinkAsHubTab,
  isAllowedGmailTabUrl,
  isGoogleOwnedUrl,
  isGoogleOauthClientUrl,
} from '../src/guestNav.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('Gmail treats Google hosts as same ecosystem (no surprise Hub tabs)', () => {
  const gmail = { appId: 'gmail', url: 'https://mail.google.com' };
  assert.equal(isSameEcosystemUrl(gmail, 'https://mail.google.com/mail/u/0/'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://accounts.google.com/signin'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://drive.google.com/file/d/x'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://calendar.google.com/'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://www.canva.com/design/x'), false);
});

test('Zoho Books/CRM/WorkDrive treat Zoho hosts as same ecosystem', () => {
  const books = { appId: 'zoho-books', url: 'https://books.zoho.in/' };
  const drive = { appId: 'zoho-workdrive', url: 'https://workdrive.zoho.in/' };
  assert.equal(isZohoOwnedUrl('https://books.zoho.in/app'), true);
  assert.equal(isZohoOwnedUrl('https://workdrive.zoho.in/'), true);
  assert.equal(isZohoOwnedUrl('https://accounts.zoho.in/signin'), true);
  assert.equal(isSameEcosystemUrl(books, 'https://books.zoho.in/app'), true);
  assert.equal(isSameEcosystemUrl(drive, 'https://workdrive.zoho.in/home'), true);
  assert.equal(isSameEcosystemUrl(books, 'https://www.canva.com'), false);
});

test('Zoho CRM/Books/WorkDrive/One deep links may open as shared Hub tabs; assets and auth may not', () => {
  const crm = { appId: 'zoho-crm', url: 'https://crm.zoho.in/' };
  const books = { appId: 'zoho-books', url: 'https://books.zoho.in/' };
  const drive = { appId: 'zoho-workdrive', url: 'https://workdrive.zoho.in/' };
  const one = { appId: 'zoho-one', url: 'https://one.zoho.in/' };
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(
      crm,
      'https://crm.zoho.in/crm/org123/tab/Leads/456',
    ),
    true,
  );
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(
      books,
      'https://books.zoho.in/app/invoice/12345',
    ),
    true,
  );
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(
      drive,
      'https://writer.zoho.in/writer/open/abc',
    ),
    true,
  );
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(one, 'https://mail.zoho.in/zm/'),
    true,
  );
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(crm, 'https://accounts.zoho.in/signin'),
    false,
  );
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(
      books,
      'https://static.zohocdn.com/books/images/x.png',
    ),
    false,
  );
  assert.equal(isZohoAssetHost('https://css.zohostatic.com/books/x.css'), true);
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(
      { appId: 'zoho-mail', url: 'https://mail.zoho.in/' },
      'https://mail.zoho.in/zm/',
    ),
    false,
  );
  // Fragile Zoho One CRM spaces stay in-place (blank/reload loops).
  assert.equal(
    shouldOpenZohoSharedDeepLinkAsHubTab(
      one,
      'https://one.zoho.in/cxapp-spaces/sales',
    ),
    false,
  );
  assert.equal(
    shouldOpenZohoCrmDeepLinkAsHubTab(
      books,
      'https://books.zoho.in/app/invoice/1',
    ),
    true,
  );
});

test('main wires Zoho Hub-tab open for window.open and popup adopt', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/main.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /shouldOpenZohoSharedDeepLinkAsHubTab/);
  assert.match(src, /tryOpenZohoSharedHubTab/);
  assert.match(src, /openInternalLinkAsHubTab/);
  assert.match(src, /reusedLiveView/);
  // CRM/Books no longer fold into the parent tab via loadURL.
  assert.doesNotMatch(
    src,
    /service\?\.appId === 'zoho-books' \|\| service\?\.appId === 'zoho-crm'/,
  );
});

test('guestNavigation offers Zoho shared Hub-tab path on same-ecosystem opens', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/guestNavigation.js', import.meta.url)),
    'utf8',
  );
  assert.match(src, /shouldOpenZohoSharedDeepLinkAsHubTab/);
  assert.match(src, /tryOpenZohoSharedHubTab/);
});

test('Gmail allowlist covers common Workspace hosts Gmail opens', () => {
  assert.equal(isAllowedGmailTabUrl('https://mail.google.com/mail/u/0/'), true);
  assert.equal(isAllowedGmailTabUrl('https://calendar.google.com/calendar/'), true);
  assert.equal(isAllowedGmailTabUrl('https://meet.google.com/abc-defg-hij'), true);
  assert.equal(isAllowedGmailTabUrl('https://chat.google.com/'), true);
  assert.equal(isGoogleOwnedUrl('https://calendar.google.com/'), true);
});

test('OAuth client hosts are Google-owned but not Gmail-main-frame URLs', () => {
  const oauth = 'https://2507573.apps.googleusercontent.com/gsi/button';
  assert.equal(isGoogleOwnedUrl(oauth), true);
  assert.equal(isGoogleOauthClientUrl(oauth), true);
  assert.equal(isAllowedGmailTabUrl(oauth), false);
});
