import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDialTarget,
  resolveAsperaConnectBinary,
  isPhoneDialUrl,
} from '../src/asperaConnectCallPolicy.js';

test('normalizeDialTarget parses tel and callto', () => {
  assert.equal(normalizeDialTarget('tel:+919876543210'), '+919876543210');
  assert.equal(normalizeDialTarget('callto:022-1234-5678'), '02212345678');
  assert.equal(normalizeDialTarget('tel:%2B919876543210'), '+919876543210');
  assert.equal(normalizeDialTarget('tel:+91-98765-43210;ext=1'), '+919876543210');
  assert.equal(normalizeDialTarget('not-a-number'), null);
  assert.equal(normalizeDialTarget('12'), null);
});

test('resolveAsperaConnectBinary prefers /usr/bin', () => {
  const exists = (p) => p === '/usr/bin/aspera-connect';
  assert.equal(
    resolveAsperaConnectBinary('/home/shree', exists),
    '/usr/bin/aspera-connect',
  );
});

test('isPhoneDialUrl works', () => {
  assert.equal(isPhoneDialUrl('tel:+911'), true);
  assert.equal(isPhoneDialUrl('https://zoho.com'), false);
});
