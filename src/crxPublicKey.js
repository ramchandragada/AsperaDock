/**
 * Extract Chrome extension public keys from a CRX2/CRX3 package so Electron
 * can load the extension with the same ID as the Chrome Web Store.
 */
import crypto from 'node:crypto';

function readVarint(data, offset) {
  let value = 0;
  let shift = 0;
  let i = offset;
  while (i < data.length) {
    const byte = data[i];
    i += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, offset: i };
    shift += 7;
    if (shift > 35) break;
  }
  throw new Error('Invalid protobuf varint.');
}

function parseProtobufFields(data) {
  const fields = [];
  let i = 0;
  while (i < data.length) {
    const key = readVarint(data, i);
    i = key.offset;
    const field = key.value >>> 3;
    const wire = key.value & 7;
    if (wire === 0) {
      const next = readVarint(data, i);
      fields.push({ field, wire, value: next.value });
      i = next.offset;
    } else if (wire === 1) {
      fields.push({ field, wire, value: data.subarray(i, i + 8) });
      i += 8;
    } else if (wire === 2) {
      const len = readVarint(data, i);
      i = len.offset;
      fields.push({
        field,
        wire,
        value: data.subarray(i, i + len.value),
      });
      i += len.value;
    } else if (wire === 5) {
      fields.push({ field, wire, value: data.subarray(i, i + 4) });
      i += 4;
    } else {
      break;
    }
  }
  return fields;
}

/** Chrome extension id from DER/SPKI public key bytes. */
export function extensionIdFromPublicKey(publicKey) {
  const key = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(publicKey || []);
  if (!key.length) return '';
  const digest = crypto.createHash('sha256').update(key).digest().subarray(0, 16);
  let id = '';
  for (const byte of digest) {
    id += String.fromCharCode(97 + ((byte >> 4) & 0xf));
    id += String.fromCharCode(97 + (byte & 0xf));
  }
  return id;
}

function collectProofKeys(headerFields) {
  const keys = [];
  for (const entry of headerFields) {
    // sha256_with_rsa = 2, sha256_with_ecdsa = 3
    if ((entry.field !== 2 && entry.field !== 3) || entry.wire !== 2) continue;
    const proofFields = parseProtobufFields(Buffer.from(entry.value));
    for (const proof of proofFields) {
      if (proof.field !== 1 || proof.wire !== 2) continue;
      const publicKey = Buffer.from(proof.value);
      keys.push({
        publicKey,
        key: publicKey.toString('base64'),
        id: extensionIdFromPublicKey(publicKey),
      });
    }
  }
  return keys;
}

/**
 * Return public keys embedded in a CRX package.
 * @returns {{ id: string, key: string, publicKey: Buffer }[]}
 */
export function extractCrxPublicKeys(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 12) return [];
  if (buf.subarray(0, 4).toString('ascii') !== 'Cr24') return [];
  const version = buf.readUInt32LE(4);
  if (version === 2) {
    if (buf.length < 16) return [];
    const pubKeyLen = buf.readUInt32LE(8);
    const publicKey = buf.subarray(16, 16 + pubKeyLen);
    return [
      {
        publicKey,
        key: publicKey.toString('base64'),
        id: extensionIdFromPublicKey(publicKey),
      },
    ];
  }
  if (version !== 3) return [];
  const headerLen = buf.readUInt32LE(8);
  const header = buf.subarray(12, 12 + headerLen);
  return collectProofKeys(parseProtobufFields(header));
}

/** Prefer the key that matches the Chrome Web Store id when available. */
export function publicKeyForExtensionId(buffer, extensionId) {
  const want = String(extensionId || '').trim().toLowerCase();
  const keys = extractCrxPublicKeys(buffer);
  if (!keys.length) return '';
  if (want) {
    const match = keys.find((entry) => entry.id === want);
    if (match) return match.key;
  }
  // Prefer RSA keys that produce a-p ids (store extensions).
  const rsa = keys.find((entry) => entry.publicKey.length >= 160);
  return (rsa || keys[0]).key;
}
