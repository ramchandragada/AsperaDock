import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LINK_HANDLING_MODES,
  normalizeLinkHandling,
  resolveLinkHandling,
  shouldOpenUnknownExternally,
  shouldOpenInternalAsHubTab,
} from '../src/linkHandling.js';

test('normalizeLinkHandling accepts known modes', () => {
  assert.deepEqual(LINK_HANDLING_MODES, ['block', 'external', 'hub-tab']);
  assert.equal(normalizeLinkHandling('block'), 'block');
  assert.equal(normalizeLinkHandling('external'), 'external');
  assert.equal(normalizeLinkHandling('hub-tab'), 'hub-tab');
  assert.equal(normalizeLinkHandling('default', 'external'), 'external');
  assert.equal(normalizeLinkHandling('nope', 'block'), 'block');
});

test('resolveLinkHandling prefers per-app over global', () => {
  assert.equal(resolveLinkHandling({ linkHandling: null }, 'external'), 'external');
  assert.equal(resolveLinkHandling({ linkHandling: 'default' }, 'hub-tab'), 'hub-tab');
  assert.equal(resolveLinkHandling({ linkHandling: 'hub-tab' }, 'block'), 'hub-tab');
  assert.equal(resolveLinkHandling({ linkHandling: 'block' }, 'external'), 'block');
});

test('shouldOpenUnknownExternally only for external and hub-tab', () => {
  assert.equal(shouldOpenUnknownExternally('block'), false);
  assert.equal(shouldOpenUnknownExternally('external'), true);
  assert.equal(shouldOpenUnknownExternally('hub-tab'), true);
});

test('shouldOpenInternalAsHubTab only for hub-tab', () => {
  assert.equal(shouldOpenInternalAsHubTab('block'), false);
  assert.equal(shouldOpenInternalAsHubTab('external'), false);
  assert.equal(shouldOpenInternalAsHubTab('hub-tab'), true);
});
