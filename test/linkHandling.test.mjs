import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LINK_HANDLING_MODES,
  normalizeLinkHandling,
  resolveLinkHandling,
  shouldOpenUnknownExternally,
  shouldOpenInternalAsHubTab,
  shouldOpenAsHubTab,
  shouldAskLinkHandling,
  rememberModeForChoice,
} from '../src/linkHandling.js';

test('normalizeLinkHandling accepts known modes', () => {
  assert.deepEqual(LINK_HANDLING_MODES, ['block', 'external', 'hub-tab', 'ask']);
  assert.equal(normalizeLinkHandling('block'), 'block');
  assert.equal(normalizeLinkHandling('external'), 'external');
  assert.equal(normalizeLinkHandling('hub-tab'), 'hub-tab');
  assert.equal(normalizeLinkHandling('ask'), 'ask');
  assert.equal(normalizeLinkHandling('default', 'external'), 'external');
  assert.equal(normalizeLinkHandling('nope', 'hub-tab'), 'hub-tab');
});

test('resolveLinkHandling is Hub-wide (ignores per-app overrides)', () => {
  assert.equal(resolveLinkHandling({ linkHandling: null }, 'external'), 'external');
  assert.equal(resolveLinkHandling({ linkHandling: 'default' }, 'hub-tab'), 'hub-tab');
  // Per-app hub-tab must NOT override a global block — one experience for all apps.
  assert.equal(resolveLinkHandling({ linkHandling: 'hub-tab' }, 'block'), 'block');
  assert.equal(resolveLinkHandling({ linkHandling: 'block' }, 'external'), 'external');
  assert.equal(resolveLinkHandling({ linkHandling: 'ask' }, 'hub-tab'), 'hub-tab');
});

test('shouldOpenUnknownExternally only for external', () => {
  assert.equal(shouldOpenUnknownExternally('block'), false);
  assert.equal(shouldOpenUnknownExternally('external'), true);
  assert.equal(shouldOpenUnknownExternally('hub-tab'), false);
  assert.equal(shouldOpenUnknownExternally('ask'), false);
});

test('shouldOpenAsHubTab / shouldOpenInternalAsHubTab only for hub-tab', () => {
  assert.equal(shouldOpenInternalAsHubTab('block'), false);
  assert.equal(shouldOpenInternalAsHubTab('external'), false);
  assert.equal(shouldOpenInternalAsHubTab('hub-tab'), true);
  assert.equal(shouldOpenInternalAsHubTab('ask'), false);
  assert.equal(shouldOpenAsHubTab('hub-tab'), true);
  assert.equal(shouldOpenAsHubTab('ask'), false);
});

test('shouldAskLinkHandling only for ask', () => {
  assert.equal(shouldAskLinkHandling('ask'), true);
  assert.equal(shouldAskLinkHandling('block'), false);
  assert.equal(shouldAskLinkHandling('hub-tab'), false);
});

test('rememberModeForChoice maps chooser answers to saved modes', () => {
  assert.equal(rememberModeForChoice('browser'), 'external');
  assert.equal(rememberModeForChoice('hub-tab'), 'hub-tab');
});
