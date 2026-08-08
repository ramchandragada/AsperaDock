import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  releaseDownloadPath,
  resolveSavePathAfterPrompt,
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
    releaseDownloadPath(out);
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
    releaseDownloadPath(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uniqueDownloadPath reserves so parallel picks do not collide', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const a = uniqueDownloadPath(dir, 'same.pdf');
    const b = uniqueDownloadPath(dir, 'same.pdf');
    assert.equal(a, path.join(dir, 'same.pdf'));
    assert.equal(b, path.join(dir, 'same (1).pdf'));
    releaseDownloadPath(a);
    releaseDownloadPath(b);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSavePathAfterPrompt does not overwrite Karnataka with Maharashtra', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const karnataka = path.join(dir, 'REG 06 of Karnataka with APOB.pdf');
    fs.writeFileSync(karnataka, 'karnataka-bytes');
    // GTK sticky last-used name points at Karnataka; this download is MH.
    const out = resolveSavePathAfterPrompt(
      karnataka,
      'REG 06 of Maharashtra with APOB.pdf',
    );
    assert.equal(out, path.join(dir, 'REG 06 of Maharashtra with APOB.pdf'));
    assert.equal(fs.readFileSync(karnataka, 'utf8'), 'karnataka-bytes');
    releaseDownloadPath(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSavePathAfterPrompt honors free rename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const renamed = path.join(dir, 'my-custom-name.pdf');
    const out = resolveSavePathAfterPrompt(renamed, 'original.pdf');
    assert.equal(out, renamed);
    releaseDownloadPath(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main uses uniqueDownloadPath and resolveSavePathAfterPrompt', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /uniqueDownloadPath/);
  assert.match(src, /resolveSavePathAfterPrompt/);
  assert.doesNotMatch(
    src,
    /setSavePath\(path\.join\(settings\.downloadPath, item\.getFilename\(\)\)\)/,
  );
});
