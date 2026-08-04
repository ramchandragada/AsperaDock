import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSameEcosystemUrl,
  isZohoOwnedUrl,
  isAllowedGmailTabUrl,
  isGoogleOwnedUrl,
} from '../src/guestNav.js';

test('Gmail treats Google hosts as same ecosystem (no surprise Hub tabs)', () => {
  const gmail = { appId: 'gmail', url: 'https://mail.google.com' };
  assert.equal(isSameEcosystemUrl(gmail, 'https://mail.google.com/mail/u/0/'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://accounts.google.com/signin'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://drive.google.com/file/d/x'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://calendar.google.com/'), true);
  assert.equal(isSameEcosystemUrl(gmail, 'https://www.canva.com/design/x'), false);
});

test('Zoho Books/CRM treat Zoho hosts as same ecosystem', () => {
  const books = { appId: 'zoho-books', url: 'https://books.zoho.in/' };
  assert.equal(isZohoOwnedUrl('https://books.zoho.in/app'), true);
  assert.equal(isZohoOwnedUrl('https://accounts.zoho.in/signin'), true);
  assert.equal(isSameEcosystemUrl(books, 'https://books.zoho.in/app'), true);
  assert.equal(isSameEcosystemUrl(books, 'https://www.canva.com'), false);
});

test('Gmail allowlist covers common Workspace hosts Gmail opens', () => {
  assert.equal(isAllowedGmailTabUrl('https://mail.google.com/mail/u/0/'), true);
  assert.equal(isAllowedGmailTabUrl('https://calendar.google.com/calendar/'), true);
  assert.equal(isAllowedGmailTabUrl('https://meet.google.com/abc-defg-hij'), true);
  assert.equal(isAllowedGmailTabUrl('https://chat.google.com/'), true);
  assert.equal(isGoogleOwnedUrl('https://calendar.google.com/'), true);
});
