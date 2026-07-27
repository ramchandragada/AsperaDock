import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInternalUrl,
  isForbiddenGuestNavigation,
  isAuthOrLoginUrl,
  isUrlForService,
  isFragileZohoOneDeepUrl,
  safeStartUrlForService,
} from '../src/guestNav.js';

test('isForbiddenGuestNavigation blocks file and javascript', () => {
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
