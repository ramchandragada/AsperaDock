import test from 'node:test';
import assert from 'node:assert/strict';
import { configureGuestWindowOpen } from '../src/guestNavigation.js';

function mockWindowOpenHandler(wc, service, apiExtras = {}) {
  let handler;
  wc.setWindowOpenHandler = (fn) => {
    handler = fn;
  };
  configureGuestWindowOpen(wc, service, {
    liveService: (s) => s,
    isGoogleService: () => false,
    startUrlForService: () => '',
    handleOutboundOrNewWindowLink: () => false,
    guestWebPreferences: () => ({}),
    getMainWindow: () => null,
    ...apiExtras,
  });
  return (url) => handler({ url });
}

test('configureGuestWindowOpen allows chrome-extension popups', () => {
  const wc = { setWindowOpenHandler: () => {}, loadURL: () => {} };
  const open = mockWindowOpenHandler(wc, {
    appId: 'whatsapp',
    url: 'https://web.whatsapp.com/',
  });
  const result = open('chrome-extension://abcd/login.html');
  assert.equal(result.action, 'allow');
});

test('configureGuestWindowOpen allows Grammarly login from WhatsApp', () => {
  const wc = { setWindowOpenHandler: () => {}, loadURL: () => {} };
  const hubTabCalls = [];
  const open = mockWindowOpenHandler(
    wc,
    { appId: 'whatsapp', url: 'https://web.whatsapp.com/' },
    {
      handleOutboundOrNewWindowLink: (...args) => {
        hubTabCalls.push(args);
        return true;
      },
    },
  );
  const result = open('https://account.grammarly.com/login');
  assert.equal(result.action, 'allow');
  assert.equal(hubTabCalls.length, 0);
});

test('configureGuestWindowOpen still routes regular links from WhatsApp to Hub tab', () => {
  const wc = { setWindowOpenHandler: () => {}, loadURL: () => {} };
  let hubTabCalled = false;
  const open = mockWindowOpenHandler(
    wc,
    { appId: 'whatsapp', url: 'https://web.whatsapp.com/' },
    {
      handleOutboundOrNewWindowLink: () => {
        hubTabCalled = true;
        return true;
      },
    },
  );
  const result = open('https://www.example.com/news');
  assert.equal(result.action, 'deny');
  assert.equal(hubTabCalled, true);
});
