/**
 * Patch unpacked extensions so MV3 auth (Grammarly sign-in) works in Electron.
 * Electron lacks chrome.tabs.create/onUpdated in service workers — we inject a
 * bootstrap into sw.js and a relay content script into the manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ASPERA_EXT_SW_BOOTSTRAP,
  ASPERA_EXT_SW_MARKER,
} from './asperaExtSwBootstrap.js';
import {
  ASPERA_EXT_AUTH_BRIDGE_CONTENT,
  ASPERA_EXT_AUTH_BRIDGE_FILENAME,
} from './asperaExtAuthBridgeContent.js';

const MANIFEST_PATCH_ID = 'aspera-hub-auth-bridge';
const SW_PATCH_MARKER = '/* aspera-hub-sw-bootstrap */';

export function isAuthPatchableExtension(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  const mv = Number(manifest.manifest_version || 0);
  const bg = manifest.background;
  if (mv >= 3 && bg && typeof bg.service_worker === 'string') return true;
  return false;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function patchServiceWorker(extPath, manifest) {
  const rel = String(manifest.background?.service_worker || '').trim();
  if (!rel) return false;
  const swPath = path.join(extPath, rel);
  if (!fs.existsSync(swPath)) return false;
  let content = fs.readFileSync(swPath, 'utf8');
  if (content.includes(ASPERA_EXT_SW_MARKER) || content.includes(SW_PATCH_MARKER)) {
    return false;
  }
  const patched = `${SW_PATCH_MARKER}\n${ASPERA_EXT_SW_BOOTSTRAP}\n${content}`;
  fs.writeFileSync(swPath, patched, 'utf8');
  return true;
}

function patchManifest(extPath) {
  const manifestPath = path.join(extPath, 'manifest.json');
  const manifest = readJson(manifestPath);
  if (!isAuthPatchableExtension(manifest)) return { manifest, changed: false };

  let changed = false;
  const scripts = Array.isArray(manifest.content_scripts)
    ? [...manifest.content_scripts]
    : [];
  const hasBridge = scripts.some(
    (entry) =>
      Array.isArray(entry?.js) &&
      entry.js.includes(ASPERA_EXT_AUTH_BRIDGE_FILENAME),
  );
  if (!hasBridge) {
    scripts.unshift({
      id: MANIFEST_PATCH_ID,
      matches: ['<all_urls>'],
      js: [ASPERA_EXT_AUTH_BRIDGE_FILENAME],
      run_at: 'document_start',
      all_frames: false,
    });
    manifest.content_scripts = scripts;
    changed = true;
  }

  if (changed) {
    writeJson(manifestPath, manifest);
  }
  return { manifest, changed };
}

function writeAuthBridgeScript(extPath) {
  const bridgePath = path.join(extPath, ASPERA_EXT_AUTH_BRIDGE_FILENAME);
  const next = ASPERA_EXT_AUTH_BRIDGE_CONTENT;
  let changed = true;
  try {
    changed = fs.readFileSync(bridgePath, 'utf8') !== next;
  } catch {
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(bridgePath, next, 'utf8');
  }
  return changed;
}

/** Patch extension directory in place. Returns true if anything changed. */
export function patchExtensionForAuth(extPath) {
  const abs = path.resolve(String(extPath || ''));
  const manifestPath = path.join(abs, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return false;

  const { manifest, changed: manifestChanged } = patchManifest(abs);
  if (!isAuthPatchableExtension(manifest)) return false;

  const bridgeChanged = writeAuthBridgeScript(abs);
  const swChanged = patchServiceWorker(abs, manifest);
  return manifestChanged || bridgeChanged || swChanged;
}
