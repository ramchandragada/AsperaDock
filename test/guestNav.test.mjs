import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInternalUrl,
  isForbiddenGuestNavigation,
  isPhoneDialUrl,
  isAuthOrLoginUrl,
  isUrlForService,
  isFragileZohoOneDeepUrl,
  safeStartUrlForService,
  extractGoogleOutboundUrl,
  isAllowedGmailTabUrl,
  isGoogleOwnedUrl,
  mustKeepGoogleUrlInApp,
  shouldOpenInSystemBrowser,
  isMessagingAppId,
  isAllowedMessagingTabUrl,
  isSameEcosystemUrl,
  gmailWindowOpenAction,
  isExtensionAuthPopupUrl,
} from '../src/guestNav.js';

test('isForbiddenGuestNavigation blocks file and javascript', () => {
  assert.equal(isForbiddenGuestNavigation('chrome-extension://abcd/popup.html'), false);
  assert.equal(isForbiddenGuestNavigation('file:///etc/passwd'), true);
  assert.equal(isForbiddenGuestNavigation('javascript:alert(1)'), true);
  assert.equal(isForbiddenGuestNavigation('https://mail.zoho.in/'), false);
  assert.equal(isForbiddenGuestNavigation('not a url'), true);
});

test('isPhoneDialUrl detects tel and callto', () => {
  assert.equal(isPhoneDialUrl('tel:+919876543210'), true);
  assert.equal(isPhoneDialUrl('callto:02212345678'), true);
  assert.equal(isPhoneDialUrl('https://crm.zoho.in/'), false);
  assert.equal(isPhoneDialUrl('mailto:a@b.c'), false);
  assert.equal(isPhoneDialUrl('not a url'), false);
  // Still forbidden for in-guest nav — Hub must openExternal instead.
  assert.equal(isForbiddenGuestNavigation('tel:+919876543210'), true);
  assert.equal(isForbiddenGuestNavigation('callto:02212345678'), true);
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

test('Google SSO/consent URLs must stay in Hub (not Chrome)', () => {
  assert.equal(
    mustKeepGoogleUrlInApp(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=y',
    ),
    true,
  );
  assert.equal(
    mustKeepGoogleUrlInApp(
      'https://accounts.google.com/signin/oauth/legacy/consent?authuser=0',
    ),
    true,
  );
  assert.equal(
    mustKeepGoogleUrlInApp('https://www.google.com/url?q=https%3A%2F%2Fexample.com'),
    true,
  );
  assert.equal(shouldOpenInSystemBrowser('https://accounts.google.com/o/oauth2/v2/auth'), false);
  assert.equal(shouldOpenInSystemBrowser('https://cybercrime.gov.in/'), true);
  assert.equal(shouldOpenInSystemBrowser('https://mail.google.com/mail/u/0/#inbox'), true);
});

test('messaging apps: Drive/Google must not stay in WhatsApp or Arattai tab', () => {
  const arattai = { url: 'https://web.arattai.in', appId: 'arattai' };
  const wa = { url: 'https://web.whatsapp.com', appId: 'whatsapp' };
  const drive =
    'https://drive.google.com/file/d/1lyfP_FwVO_vcT3Q7UFpkDcVxhryQaDgo/view?usp=sharing';
  const accounts = 'https://accounts.google.com/v3/signin/identifier';
  assert.equal(isMessagingAppId('arattai'), true);
  assert.equal(isMessagingAppId('whatsapp'), true);
  assert.equal(isMessagingAppId('gmail'), false);
  assert.equal(isAllowedMessagingTabUrl(arattai, 'https://web.arattai.in/app'), true);
  assert.equal(isAllowedMessagingTabUrl(arattai, 'https://files.arattai.in/webdownload?x=1'), true);
  assert.equal(isAllowedMessagingTabUrl(arattai, drive), false);
  assert.equal(isAllowedMessagingTabUrl(arattai, accounts), false);
  assert.equal(isAllowedMessagingTabUrl(wa, 'https://web.whatsapp.com/'), true);
  assert.equal(isAllowedMessagingTabUrl(wa, 'https://mmg.whatsapp.net/v/t62.x'), true);
  assert.equal(isAllowedMessagingTabUrl(wa, drive), false);
  assert.equal(isAllowedMessagingTabUrl(wa, accounts), false);
});

test('messaging apps: Google is not same-ecosystem (Hub tab, not in-chat load)', () => {
  const arattai = { url: 'https://web.arattai.in', appId: 'arattai' };
  const wa = { url: 'https://web.whatsapp.com', appId: 'whatsapp' };
  const gmail = { url: 'https://mail.google.com', appId: 'gmail' };
  const drive = 'https://drive.google.com/file/d/abc/view';
  // INTERNAL_HOSTS includes google.com — must NOT make Drive “in-app” for messengers.
  assert.equal(isInternalUrl(drive, arattai), true);
  assert.equal(isSameEcosystemUrl(arattai, drive), false);
  assert.equal(isSameEcosystemUrl(wa, drive), false);
  assert.equal(isSameEcosystemUrl(arattai, 'https://web.arattai.in/chats'), true);
  assert.equal(isSameEcosystemUrl(wa, 'https://web.whatsapp.com/'), true);
  // Gmail still treats Google as ecosystem.
  assert.equal(isSameEcosystemUrl(gmail, drive), true);
});

test('gmailWindowOpenAction: email links → hub-tab; OAuth → popup; blank → blank-popup', () => {
  assert.equal(gmailWindowOpenAction('about:blank'), 'blank-popup');
  assert.equal(gmailWindowOpenAction(''), 'blank-popup');
  assert.equal(
    gmailWindowOpenAction('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'),
    'oauth-popup',
  );
  assert.equal(
    gmailWindowOpenAction('https://2507573.apps.googleusercontent.com/'),
    'oauth-popup',
  );
  assert.equal(
    gmailWindowOpenAction('https://drive.google.com/file/d/abc/view'),
    'hub-tab',
  );
  assert.equal(
    gmailWindowOpenAction('https://www.flexiloans.com/dashboard'),
    'hub-tab',
  );
  assert.equal(
    gmailWindowOpenAction(
      'https://www.google.com/url?q=https%3A%2F%2Fcybercrime.gov.in%2F&sa=D',
    ),
    'hub-tab',
  );
  assert.equal(gmailWindowOpenAction('javascript:alert(1)'), 'deny');
});

test('isExtensionAuthPopupUrl detects extension login targets', () => {
  assert.equal(
    isExtensionAuthPopupUrl('chrome-extension://kbfnbcaeplbcioakkpcpgfkobkghlhen/src/popup.html'),
    true,
  );
  assert.equal(isExtensionAuthPopupUrl('https://account.grammarly.com/login'), true);
  assert.equal(isExtensionAuthPopupUrl('https://www.grammarly.com/signup'), true);
  assert.equal(isExtensionAuthPopupUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
  assert.equal(isExtensionAuthPopupUrl('https://web.whatsapp.com/'), false);
  assert.equal(isExtensionAuthPopupUrl('https://news.example.com/article'), false);
  assert.equal(isExtensionAuthPopupUrl('about:blank'), false);
});
