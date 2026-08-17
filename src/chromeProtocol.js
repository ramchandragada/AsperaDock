/**
 * Serve the dock chrome from a privileged custom scheme so we can keep
 * GrantFileProtocolExtraPrivileges fused OFF (A+ packaging).
 *
 * Packaged: asperadock://ui/index.html → app.asar/.vite/renderer/main_window/
 * Dev: unused (Vite dev server URL wins).
 *
 * Dynamic pages (Aspera AI panel, etc.) are served from memory so they run in
 * a secure context — required for navigator.mediaDevices / getUserMedia.
 * data: URLs are opaque and hide the mic API even when a headset is connected.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, protocol, net } from 'electron';

export const CHROME_SCHEME = 'asperadock';
export const CHROME_HOST = 'ui';

/** In-memory HTML for privileged chrome pages (path without leading slash). */
const dynamicHtml = new Map();

let registered = false;

/** Must run before app.ready. */
export function registerChromeScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CHROME_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function normalizeChromePath(pathname) {
  let rel = decodeURIComponent(String(pathname || '/'));
  if (rel.startsWith('/')) rel = rel.slice(1);
  if (!rel || rel.endsWith('/')) rel = `${rel}index.html`;
  return rel;
}

/**
 * Register HTML served at asperadock://ui/<pathname>.
 * @param {string} pathname e.g. "ai-result.html"
 * @param {string} html
 */
export function setChromeDynamicHtml(pathname, html) {
  const key = normalizeChromePath(pathname);
  dynamicHtml.set(key, String(html || ''));
  return key;
}

export function clearChromeDynamicHtml(pathname) {
  dynamicHtml.delete(normalizeChromePath(pathname));
}

export function getChromeDynamicHtml(pathname) {
  return dynamicHtml.get(normalizeChromePath(pathname)) || null;
}

function rendererRoot() {
  return path.join(app.getAppPath(), '.vite', 'renderer', 'main_window');
}

function resolveChromePath(urlPath) {
  const root = path.resolve(rendererRoot());
  const rel = normalizeChromePath(urlPath);
  const resolved = path.resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

/** Call once after app.whenReady(). */
export function attachChromeProtocolHandler() {
  if (registered) return;
  registered = true;
  protocol.handle(CHROME_SCHEME, (request) => {
    try {
      const u = new URL(request.url);
      if (u.hostname !== CHROME_HOST) {
        return new Response('Not found', { status: 404 });
      }
      const rel = normalizeChromePath(u.pathname);
      const inline = dynamicHtml.get(rel);
      if (typeof inline === 'string') {
        return new Response(inline, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
      const filePath = resolveChromePath(u.pathname);
      if (!filePath) {
        return new Response('Forbidden', { status: 403 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch (error) {
      return new Response(String(error?.message || error), { status: 500 });
    }
  });
}

export function chromeAppUrl(pathname = 'index.html') {
  const clean = normalizeChromePath(pathname);
  return `${CHROME_SCHEME}://${CHROME_HOST}/${clean}`;
}

/** Secure origin URL for the Aspera AI float panel. */
export const AI_RESULT_CHROME_PATH = 'ai-result.html';

export function aiResultChromeUrl(dark = false) {
  const q = dark ? '?dark=1' : '';
  return `${chromeAppUrl(AI_RESULT_CHROME_PATH)}${q}`;
}
