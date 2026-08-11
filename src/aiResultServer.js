/**
 * Loopback HTTP server for the Aspera AI float panel.
 *
 * Chromium only exposes navigator.mediaDevices in a secure context.
 * data: URLs never qualify; some Electron builds also omit mediaDevices on
 * custom schemes. http://127.0.0.1 is always treated as secure, so voice
 * recording works with system / Bluetooth microphones.
 */
import http from 'node:http';

/** @type {import('node:http').Server|null} */
let server = null;
/** @type {number} */
let port = 0;
/** @type {string} */
let html = '';

export function setAiResultServerHtml(nextHtml) {
  html = String(nextHtml || '');
}

export function getAiResultServerPort() {
  return port;
}

export function isAiResultServerListening() {
  return Boolean(server && port);
}

/**
 * @returns {Promise<number>} local port
 */
export function ensureAiResultServer() {
  if (server && port) return Promise.resolve(port);
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      try {
        const url = String(req.url || '/');
        if (url.startsWith('/favicon')) {
          res.writeHead(204);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Permissions-Policy': 'microphone=(self), camera=()',
          'Feature-Policy': "microphone 'self'; camera 'none'",
        });
        res.end(html || '<!doctype html><title>Aspera AI</title>');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(err?.message || err));
      }
    });
    s.once('error', (err) => {
      server = null;
      port = 0;
      reject(err);
    });
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      if (!port) {
        s.close();
        reject(new Error('Aspera AI local server failed to bind'));
        return;
      }
      server = s;
      resolve(port);
    });
  });
}

export function aiResultLocalUrl(dark = false) {
  if (!port) return '';
  const q = dark ? '?dark=1' : '';
  return `http://127.0.0.1:${port}/${q}`;
}

export async function stopAiResultServer() {
  const s = server;
  server = null;
  port = 0;
  html = '';
  if (!s) return;
  await new Promise((resolve) => {
    try {
      s.close(() => resolve());
    } catch {
      resolve();
    }
  });
}
