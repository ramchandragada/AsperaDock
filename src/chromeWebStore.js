/**
 * Install Chrome extensions from Web Store URL/ID or .crx/.zip packages.
 * Electron only loads unpacked dirs — we download CRX, strip header, unzip.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const EXT_ID_RE = /^[a-p]{32}$/i;

/** Extract a 32-char Chrome extension id from a Web Store URL or raw id. */
export function parseChromeExtensionId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (EXT_ID_RE.test(raw)) return raw.toLowerCase();

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (
      host === 'chrome.google.com' ||
      host === 'chromewebstore.google.com'
    ) {
      const parts = url.pathname.split('/').filter(Boolean);
      // /webstore/detail/name/id or /detail/name/id
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (EXT_ID_RE.test(parts[i])) return parts[i].toLowerCase();
      }
    }
    const q = url.searchParams.get('id');
    if (q && EXT_ID_RE.test(q)) return q.toLowerCase();
  } catch {
    // not a URL
  }

  const match = raw.match(/\b([a-p]{32})\b/i);
  return match ? match[1].toLowerCase() : '';
}

export function chromeWebStoreUrl(extensionId) {
  const id = parseChromeExtensionId(extensionId);
  if (!id) return 'https://chromewebstore.google.com/';
  return `https://chromewebstore.google.com/detail/${id}`;
}

export function crxDownloadUrl(extensionId, chromeVersion = '131.0.0.0') {
  const id = parseChromeExtensionId(extensionId);
  if (!id) throw new Error('Invalid Chrome extension ID.');
  const x = encodeURIComponent(`id=${id}&uc`);
  return (
    'https://clients2.google.com/service/update2/crx' +
    `?response=redirect&prodversion=${encodeURIComponent(chromeVersion)}` +
    `&acceptformat=crx2,crx3&x=${x}`
  );
}

/** Strip CRX2/CRX3 header; return ZIP bytes. Pass-through if already ZIP. */
export function crxBufferToZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 4) throw new Error('Empty or truncated extension package.');

  // Already a ZIP (PK..)
  if (buf[0] === 0x50 && buf[1] === 0x4b) return buf;

  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'Cr24') {
    throw new Error('Not a Chrome .crx or .zip package.');
  }
  if (buf.length < 12) throw new Error('Truncated CRX header.');

  const version = buf.readUInt32LE(4);
  if (version === 2) {
    if (buf.length < 16) throw new Error('Truncated CRX2 header.');
    const pubKeyLen = buf.readUInt32LE(8);
    const sigLen = buf.readUInt32LE(12);
    const offset = 16 + pubKeyLen + sigLen;
    if (offset >= buf.length) throw new Error('Invalid CRX2 layout.');
    return buf.subarray(offset);
  }
  if (version === 3) {
    const headerLen = buf.readUInt32LE(8);
    const offset = 12 + headerLen;
    if (offset >= buf.length) throw new Error('Invalid CRX3 layout.');
    return buf.subarray(offset);
  }
  throw new Error(`Unsupported CRX version ${version}.`);
}

function unzipToDir(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  try {
    execFileSync('unzip', ['-qo', zipPath, '-d', destDir], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error);
    throw new Error(`Could not unpack extension archive.\n${detail}`);
  }
}

function findManifestDir(root) {
  const direct = path.join(root, 'manifest.json');
  if (fs.existsSync(direct)) return root;

  // Some zips nest one folder.
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '__MACOSX' || entry.name === '_metadata') continue;
    const nested = path.join(root, entry.name, 'manifest.json');
    if (fs.existsSync(nested)) return path.join(root, entry.name);
  }
  throw new Error('No manifest.json found in the downloaded package.');
}

function stripMetadataDir(dir) {
  const meta = path.join(dir, '_metadata');
  if (fs.existsSync(meta)) {
    fs.rmSync(meta, { recursive: true, force: true });
  }
}

async function fetchBinary(url) {
  // Prefer Electron net for redirects / system proxy when running in-app.
  try {
    const electron = require('electron');
    if (typeof electron?.net?.fetch === 'function') {
      const res = await electron.net.fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`Download failed (HTTP ${res.status}).`);
      }
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch (error) {
    // Fall through to global fetch outside Electron, or if net.fetch failed.
    if (String(error?.message || '').startsWith('Download failed')) throw error;
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status}).`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Download CRX for a store ID into a temp zip-extracted folder.
 * Returns path to the unpacked extension directory (contains manifest.json).
 */
export async function downloadAndUnpackChromeExtension(extensionId, {
  chromeVersion = '131.0.0.0',
  workRoot = '',
} = {}) {
  const id = parseChromeExtensionId(extensionId);
  if (!id) {
    throw new Error(
      'Paste a Chrome Web Store link or 32-character extension ID.',
    );
  }

  const root =
    workRoot ||
    fs.mkdtempSync(path.join(os.tmpdir(), `asperadock-crx-${id}-`));
  fs.mkdirSync(root, { recursive: true });

  const crxPath = path.join(root, `${id}.crx`);
  const zipPath = path.join(root, `${id}.zip`);
  const unpackDir = path.join(root, 'unpacked');

  const url = crxDownloadUrl(id, chromeVersion);
  const crxBuf = await fetchBinary(url);
  fs.writeFileSync(crxPath, crxBuf);

  const zipBuf = crxBufferToZip(crxBuf);
  fs.writeFileSync(zipPath, zipBuf);

  if (fs.existsSync(unpackDir)) {
    fs.rmSync(unpackDir, { recursive: true, force: true });
  }
  unzipToDir(zipPath, unpackDir);
  const manifestDir = findManifestDir(unpackDir);
  stripMetadataDir(manifestDir);
  return { id, path: manifestDir, workRoot: root };
}

/**
 * Unpack a local .crx or .zip into a temp folder; return manifest dir.
 */
export function unpackExtensionPackage(filePath, workRoot = '') {
  const src = path.resolve(String(filePath || ''));
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error('Choose a .crx or .zip extension package.');
  }
  const lower = src.toLowerCase();
  if (!lower.endsWith('.crx') && !lower.endsWith('.zip')) {
    throw new Error('File must be a .crx or .zip package.');
  }

  const root =
    workRoot ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'asperadock-pkg-'));
  fs.mkdirSync(root, { recursive: true });
  const zipPath = path.join(root, 'package.zip');
  const unpackDir = path.join(root, 'unpacked');

  const raw = fs.readFileSync(src);
  const zipBuf = crxBufferToZip(raw);
  fs.writeFileSync(zipPath, zipBuf);

  if (fs.existsSync(unpackDir)) {
    fs.rmSync(unpackDir, { recursive: true, force: true });
  }
  unzipToDir(zipPath, unpackDir);
  const manifestDir = findManifestDir(unpackDir);
  stripMetadataDir(manifestDir);
  return { path: manifestDir, workRoot: root };
}
