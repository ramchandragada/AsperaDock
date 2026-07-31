/**
 * Chrome-style unpacked extension catalog for guest sessions.
 * Electron only supports unpacked dirs via session.loadExtension / extensions.loadExtension.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';

function extensionsRoot() {
  return path.join(app.getPath('userData'), 'extensions');
}

function ensureRoot() {
  fs.mkdirSync(extensionsRoot(), { recursive: true, mode: 0o700 });
  return extensionsRoot();
}

function readManifest(dir) {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('No manifest.json found — pick an unpacked Chrome extension folder.');
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  // Strip UTF-8 BOM if present.
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid manifest.json');
  }
  return parsed;
}

function readLocaleMessage(dir, key, locales = ['en', 'en_US', 'en_GB']) {
  const msgKey = String(key || '').replace(/^__MSG_/, '').replace(/__$/, '');
  if (!msgKey) return '';
  const localesRoot = path.join(dir, '_locales');
  if (!fs.existsSync(localesRoot)) return '';

  const tryLocales = [
    ...locales,
    ...fs
      .readdirSync(localesRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  ];
  for (const locale of tryLocales) {
    const file = path.join(localesRoot, locale, 'messages.json');
    if (!fs.existsSync(file)) continue;
    try {
      const messages = JSON.parse(
        fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''),
      );
      const entry = messages?.[msgKey];
      const value = entry?.message || entry?.Message || '';
      if (value) return String(value);
    } catch {
      // try next locale
    }
  }
  return '';
}

function resolveManifestString(value, dir) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('__MSG_') && text.endsWith('__')) {
    return readLocaleMessage(dir, text) || text;
  }
  return text;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.' || entry.name === '..') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function removeDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

export function normalizeExtensionList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === 'object' && item.id && item.path)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || 'Extension').trim() || 'Extension',
      version: String(item.version || ''),
      description: String(item.description || ''),
      enabled: item.enabled !== false,
      path: String(item.path),
      chromeId: String(item.chromeId || ''),
    }));
}

export function listInstalledExtensions(settingsExtensions) {
  return normalizeExtensionList(settingsExtensions).map((ext) => {
    const exists = fs.existsSync(ext.path) && fs.existsSync(path.join(ext.path, 'manifest.json'));
    return { ...ext, exists };
  });
}

/**
 * Copy an unpacked extension into userData and return catalog metadata.
 * @param {string} sourceDir
 * @param {{ chromeId?: string, replaceId?: string }} [opts]
 */
export function installUnpackedExtension(sourceDir, opts = {}) {
  const src = path.resolve(String(sourceDir || ''));
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error('Choose a folder that contains an unpacked Chrome extension.');
  }
  const manifest = readManifest(src);
  const chromeId = String(opts.chromeId || '').trim().toLowerCase();
  const replaceId = String(opts.replaceId || '').trim();
  const id =
    replaceId ||
    (chromeId ? `ext-${chromeId}` : `ext-${crypto.randomBytes(6).toString('hex')}`);
  const dest = path.join(ensureRoot(), id);
  if (fs.existsSync(dest)) {
    removeDirRecursive(dest);
  }
  copyDirRecursive(src, dest);
  const name =
    resolveManifestString(manifest.name, dest) ||
    path.basename(src) ||
    'Extension';
  const description = resolveManifestString(manifest.description, dest);
  return {
    id,
    name: String(name).trim() || 'Extension',
    version: String(manifest.version || ''),
    description: String(description || ''),
    enabled: true,
    path: dest,
    chromeId,
  };
}

export function uninstallExtensionFiles(ext) {
  if (!ext?.path) return;
  const root = path.resolve(extensionsRoot());
  const target = path.resolve(ext.path);
  if (!target.startsWith(root + path.sep) && target !== root) {
    // Only delete copies under our extensions root.
    return;
  }
  removeDirRecursive(target);
}

export function readExtensionManifestSafe(extPath) {
  try {
    return readManifest(extPath);
  } catch {
    return null;
  }
}
