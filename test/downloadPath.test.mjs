import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sanitizeDownloadFilename,
  uniqueDownloadPath,
} from '../src/downloadPath.js';

test('sanitizeDownloadFilename strips path components', () => {
  assert.equal(sanitizeDownloadFilename('/tmp/evil/name.pdf'), 'name.pdf');
  assert.equal(sanitizeDownloadFilename(''), 'download');
});

test('uniqueDownloadPath keeps name when file is new', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const out = uniqueDownloadPath(dir, 'REG 06.pdf');
    assert.equal(out, path.join(dir, 'REG 06.pdf'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uniqueDownloadPath appends (n) when file already exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const first = path.join(dir, 'REG 06 of Karnataka with APOB.pdf');
    fs.writeFileSync(first, 'old');
    const out = uniqueDownloadPath(dir, 'REG 06 of Karnataka with APOB.pdf');
    assert.equal(
      out,
      path.join(dir, 'REG 06 of Karnataka with APOB (1).pdf'),
    );
    assert.notEqual(out, first);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main uses uniqueDownloadPath for guest downloads', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /uniqueDownloadPath/);
  assert.doesNotMatch(
    src,
    /setSavePath\(path\.join\(settings\.downloadPath, item\.getFilename\(\)\)\)/,
  );
});
