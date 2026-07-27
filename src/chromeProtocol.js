/**
 * Serve the dock chrome from a privileged custom scheme so we can keep
 * GrantFileProtocolExtraPrivileges fused OFF (A+ packaging).
 *
 * Packaged: asperadock://ui/index.html → app.asar/.vite/renderer/main_window/
 * Dev: unused (Vite dev server URL wins).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, protocol, net } from 'electron';

export const CHROME_SCHEME = 'asperadock';
export const CHROME_HOST = 'ui';

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

function rendererRoot() {
  return path.join(app.getAppPath(), '.vite', 'renderer', 'main_window');
}

function resolveChromePath(urlPath) {
  const root = path.resolve(rendererRoot());
  let rel = decodeURIComponent(String(urlPath || '/'));
  if (rel.startsWith('/')) rel = rel.slice(1);
  if (!rel || rel.endsWith('/')) rel = `${rel}index.html`;
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
  const clean = String(pathname || 'index.html').replace(/^\//, '');
  return `${CHROME_SCHEME}://${CHROME_HOST}/${clean}`;
}
