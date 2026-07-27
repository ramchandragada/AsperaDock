#!/usr/bin/env node
/**
 * Tiny local inbox for Aspera Hub error reports.
 *
 *   node scripts/error-inbox.mjs
 *   # listens on http://127.0.0.1:8787/asperadock/errors
 *
 * Then set Settings → Error reporting → Report upload URL to:
 *   http://127.0.0.1:8787/asperadock/errors
 *
 * Or point company PCs at your LAN/server URL running this script.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ASPERA_ERROR_PORT || 8787);
const HOST = process.env.ASPERA_ERROR_HOST || '127.0.0.1';
const OUT = process.env.ASPERA_ERROR_DIR || path.join(__dirname, 'error-inbox');

fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/asperadock/errors')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
      return;
    }
    const id = parsed.id || `recv-${Date.now()}`;
    const file = path.join(OUT, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
    console.log(`[inbox] ${parsed.kind || 'unknown'} → ${file}`);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, dir: OUT }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Aspera Hub error inbox listening on http://${HOST}:${PORT}/asperadock/errors`);
  console.log(`Saving reports to ${OUT}`);
});
