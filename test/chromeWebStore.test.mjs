import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chromeWebStoreUrl,
  crxBufferToZip,
  crxDownloadUrl,
  parseChromeExtensionId,
} from '../src/chromeWebStore.js';

test('parseChromeExtensionId accepts raw ids', () => {
  assert.equal(
    parseChromeExtensionId('nkbihfbeogaeaoehlefnkodbefgpgknn'),
    'nkbihfbeogaeaoehlefnkodbefgpgknn',
  );
});

test('parseChromeExtensionId accepts chromewebstore URLs', () => {
  assert.equal(
    parseChromeExtensionId(
      'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
    ),
    'nkbihfbeogaeaoehlefnkodbefgpgknn',
  );
  assert.equal(
    parseChromeExtensionId(
      'https://chrome.google.com/webstore/detail/some-name/gighmmpiobklfepjocnamgkkbiglidom?hl=en',
    ),
    'gighmmpiobklfepjocnamgkkbiglidom',
  );
});

test('parseChromeExtensionId rejects junk', () => {
  assert.equal(parseChromeExtensionId(''), '');
  assert.equal(parseChromeExtensionId('not-an-id'), '');
});

test('chromeWebStoreUrl and crxDownloadUrl', () => {
  assert.equal(
    chromeWebStoreUrl('nkbihfbeogaeaoehlefnkodbefgpgknn'),
    'https://chromewebstore.google.com/detail/nkbihfbeogaeaoehlefnkodbefgpgknn',
  );
  assert.match(
    crxDownloadUrl('nkbihfbeogaeaoehlefnkodbefgpgknn'),
    /clients2\.google\.com\/service\/update2\/crx/,
  );
});

test('crxBufferToZip strips CRX2/CRX3 and passes ZIP', () => {
  const zipBody = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03]);
  assert.deepEqual(crxBufferToZip(zipBody), zipBody);

  const crx2 = Buffer.alloc(16 + 4 + 8 + zipBody.length);
  crx2.write('Cr24', 0, 'ascii');
  crx2.writeUInt32LE(2, 4);
  crx2.writeUInt32LE(4, 8); // pubkey
  crx2.writeUInt32LE(8, 12); // sig
  zipBody.copy(crx2, 16 + 4 + 8);
  assert.deepEqual(crxBufferToZip(crx2), zipBody);

  const headerLen = 20;
  const crx3 = Buffer.alloc(12 + headerLen + zipBody.length);
  crx3.write('Cr24', 0, 'ascii');
  crx3.writeUInt32LE(3, 4);
  crx3.writeUInt32LE(headerLen, 8);
  zipBody.copy(crx3, 12 + headerLen);
  assert.deepEqual(crxBufferToZip(crx3), zipBody);
});
