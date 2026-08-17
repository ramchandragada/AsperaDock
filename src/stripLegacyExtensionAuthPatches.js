/**
 * Remove leftover Grammarly/auth-bridge patch files from earlier Hub builds.
 * Those experiments patched unpacked extensions in place; strip them so the
 * stock extension can load again.
 */
import fs from 'node:fs';
import path from 'node:path';

const BRIDGE_FILE = 'aspera-ext-auth-bridge.js';
const SW_START = '/* aspera-hub-sw-bootstrap */';
const SW_END = '/* aspera-hub-sw-bootstrap-end */';
const SW_MARKER = '__asperaExtAuthBootstrap';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stripServiceWorkerBootstrap(extPath, manifest) {
  const rel = String(manifest.background?.service_worker || '').trim();
  if (!rel) return false;
  const swPath = path.join(extPath, rel);
  if (!fs.existsSync(swPath)) return false;
  let content = fs.readFileSync(swPath, 'utf8');
  if (!content.includes(SW_START) && !content.includes(SW_MARKER)) {
    return false;
  }
  if (content.includes(SW_END)) {
    const start = content.indexOf(SW_START);
    const end = content.indexOf(SW_END);
    if (start >= 0 && end > start) {
      content = (
        content.slice(0, start) + content.slice(end + SW_END.length)
      ).replace(/^\n+/, '');
    }
  } else {
    const importIdx = content.search(/\bimportScripts\s*\(/);
    if (importIdx > 0) content = content.slice(importIdx);
  }
  fs.writeFileSync(swPath, content, 'utf8');
  return true;
}

function stripManifestBridge(extPath, manifest) {
  const scripts = Array.isArray(manifest.content_scripts)
    ? manifest.content_scripts
    : [];
  const next = scripts.filter(
    (entry) =>
      !(
        Array.isArray(entry?.js) &&
        entry.js.includes(BRIDGE_FILE)
      ),
  );
  if (next.length === scripts.length) return false;
  manifest.content_scripts = next;
  writeJson(path.join(extPath, 'manifest.json'), manifest);
  return true;
}

/** Returns true if any leftover auth-bridge patch was removed. */
export function stripLegacyExtensionAuthPatches(extPath) {
  const abs = path.resolve(String(extPath || ''));
  const manifestPath = path.join(abs, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return false;

  let changed = false;
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch {
    return false;
  }

  if (stripManifestBridge(abs, manifest)) {
    changed = true;
    try {
      manifest = readJson(manifestPath);
    } catch {
      // ignore
    }
  }

  const bridgePath = path.join(abs, BRIDGE_FILE);
  if (fs.existsSync(bridgePath)) {
    try {
      fs.unlinkSync(bridgePath);
      changed = true;
    } catch {
      // ignore
    }
  }

  if (manifest && stripServiceWorkerBootstrap(abs, manifest)) {
    changed = true;
  }

  return changed;
}
