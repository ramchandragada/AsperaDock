import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInternalUrl,
  isForbiddenGuestNavigation,
  isAuthOrLoginUrl,
  isUrlForService,
  isFragileZohoOneDeepUrl,
  safeStartUrlForService,
  extractGoogleOutboundUrl,
  isAllowedGmailTabUrl,
  isGoogleOwnedUrl,
} from '../src/guestNav.js';

test('isForbiddenGuestNavigation blocks file and javascript', () => {
  assert.equal(isForbiddenGuestNavigation('chrome-extension://abcd/popup.html'), false);
  assert.equal(isForbiddenGuestNavigation('file:///etc/passwd'), true);
  assert.equal(isForbiddenGuestNavigation('javascript:alert(1)'), true);
  assert.equal(isForbiddenGuestNavigation('https://mail.zoho.in/'), false);
  assert.equal(isForbiddenGuestNavigation('not a url'), true);
});

test('isInternalUrl fails closed on malformed URLs', () => {
  const service = { url: 'https://mail.zoho.in/zm/' };
  assert.equal(isInternalUrl('::::', service), false);
  assert.equal(isInternalUrl('https://mail.zoho.in/zm/', service), true);
  assert.equal(isInternalUrl('https://evil.example/', service), false);
});

test('isAuthOrLoginUrl detects accounts and signin paths', () => {
  assert.equal(isAuthOrLoginUrl('https://accounts.google.com/'), true);
  assert.equal(isAuthOrLoginUrl('https://mail.zoho.in/zm/'), false);
  assert.equal(isAuthOrLoginUrl('https://mail.zoho.in/login'), true);
});

test('isUrlForService allows Zoho DC aliases for same product', () => {
  const mail = { url: 'https://mail.zoho.in/zm/', appId: 'zoho-mail' };
  assert.equal(isUrlForService(mail, 'https://mail.zoho.in/zm/'), true);
  assert.equal(isUrlForService(mail, 'https://mail.zoho.com/zm/'), true);
  assert.equal(isUrlForService(mail, 'https://cliq.zoho.in/'), false);
});

test('isUrlForService allows Zoho One portal hosts', () => {
  const one = { url: 'https://one.zoho.in/', appId: 'zoho-one' };
  assert.equal(
    isUrlForService(one, 'https://one.zoho.in/zohoone/aspera/home'),
    true,
  );
  assert.equal(isUrlForService(one, 'https://home.zoho.in/'), true);
  assert.equal(isUrlForService(one, 'https://crm.zoho.in/'), true);
});

test('isUrlForService allows Arattai hosts', () => {
  const arattai = { url: 'https://web.arattai.in', appId: 'arattai' };
  assert.equal(isUrlForService(arattai, 'https://web.arattai.in/'), true);
  assert.equal(isUrlForService(arattai, 'https://api.arattai.in/x'), true);
});

test('Zoho One deep CRM routes are fragile for cold start', () => {
  const one = { url: 'https://one.zoho.in/', appId: 'zoho-one' };
  const deep =
    'https://one.zoho.in/zohoone/aspera/home/cxapp-spaces/sales/crm/thegstcompany/tab/Home/begin';
  assert.equal(isFragileZohoOneDeepUrl(deep), true);
  assert.equal(isFragileZohoOneDeepUrl('https://one.zoho.in/zohoone/aspera/home'), false);
  assert.equal(safeStartUrlForService(one, deep), 'https://one.zoho.in/');
  assert.equal(
    safeStartUrlForService(one, 'https://one.zoho.in/zohoone/aspera/home'),
    'https://one.zoho.in/zohoone/aspera/home',
  );
});

test('Gmail google.com/url wrappers extract outbound targets', () => {
  const wrapped =
    'https://www.google.com/url?q=https%3A%2F%2Fcybercrime.gov.in%2F&sa=D';
  assert.equal(
    extractGoogleOutboundUrl(wrapped),
    'https://cybercrime.gov.in/',
  );
  assert.equal(isAllowedGmailTabUrl(wrapped), false);
  assert.equal(isAllowedGmailTabUrl('https://mail.google.com/mail/u/0/#inbox'), true);
  assert.equal(isAllowedGmailTabUrl('https://cybercrime.gov.in/'), false);
  assert.equal(isAllowedGmailTabUrl('https://accounts.google.com/signin'), true);
});

test('isGoogleOwnedUrl recognizes first-party Google domains', () => {
  assert.equal(
    isGoogleOwnedUrl('https://drive.google.com/accounts/SetOSID?continue=https://drive.google.com/'),
    true,
  );
  assert.equal(isGoogleOwnedUrl('https://accounts.google.com/signin/v2'), true);
  assert.equal(isGoogleOwnedUrl('https://mail.google.com/mail/u/0/#inbox'), true);
  assert.equal(isGoogleOwnedUrl('https://example.com/'), false);
});
