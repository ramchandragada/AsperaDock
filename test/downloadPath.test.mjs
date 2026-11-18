import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  moveDownloadClaim,
  releaseDownloadPath,
  resolveSavePathAfterPrompt,
  sameDownloadBasename,
  sanitizeDownloadFilename,
  suggestDownloadPath,
  uniqueDownloadPath,
} from '../src/downloadPath.js';

test('sanitizeDownloadFilename strips path components', () => {
  assert.equal(sanitizeDownloadFilename('/tmp/evil/name.pdf'), 'name.pdf');
  assert.equal(sanitizeDownloadFilename(''), 'download');
});

test('sameDownloadBasename matches intended name', () => {
  assert.equal(
    sameDownloadBasename('/tmp/Report.pdf', 'Report.pdf'),
    true,
  );
  assert.equal(
    sameDownloadBasename('/tmp/Report.pdf', 'Other.pdf'),
    false,
  );
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

test('suggestDownloadPath keeps natural name even when file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const existing = path.join(dir, 'invoice.pdf');
    fs.writeFileSync(existing, 'old');
    const out = suggestDownloadPath(dir, 'invoice.pdf');
    assert.equal(out, existing);
    releaseDownloadPath(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('suggestDownloadPath uses (n) only when natural name is reserved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const a = suggestDownloadPath(dir, 'invoice.pdf');
    const b = suggestDownloadPath(dir, 'invoice.pdf');
    assert.equal(a, path.join(dir, 'invoice.pdf'));
    assert.equal(b, path.join(dir, 'invoice (1).pdf'));
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

test('resolveSavePathAfterPrompt keep-both uses (n) for same name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const existing = path.join(dir, 'AVYONA.pdf');
    fs.writeFileSync(existing, 'old');
    const out = resolveSavePathAfterPrompt(existing, 'AVYONA.pdf');
    assert.equal(out, path.join(dir, 'AVYONA (1).pdf'));
    assert.equal(fs.readFileSync(existing, 'utf8'), 'old');
    releaseDownloadPath(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSavePathAfterPrompt overwrite keeps same path for same name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const existing = path.join(dir, 'AVYONA.pdf');
    fs.writeFileSync(existing, 'old');
    const out = resolveSavePathAfterPrompt(existing, 'AVYONA.pdf', {
      overwrite: true,
    });
    assert.equal(out, existing);
    releaseDownloadPath(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSavePathAfterPrompt overwrite still refuses sticky different name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const karnataka = path.join(dir, 'REG 06 of Karnataka with APOB.pdf');
    fs.writeFileSync(karnataka, 'karnataka-bytes');
    const out = resolveSavePathAfterPrompt(
      karnataka,
      'REG 06 of Maharashtra with APOB.pdf',
      { overwrite: true },
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

test('moveDownloadClaim renames claim to final path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const claim = path.join(dir, 'claim.pdf');
    const final = path.join(dir, 'chosen', 'final.pdf');
    fs.writeFileSync(claim, 'pdf-bytes');
    const out = moveDownloadClaim(claim, final);
    assert.equal(out, final);
    assert.equal(fs.readFileSync(final, 'utf8'), 'pdf-bytes');
    assert.equal(fs.existsSync(claim), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('moveDownloadClaim overwrite replaces existing final on Linux rename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const claim = path.join(dir, 'claim.pdf');
    const final = path.join(dir, 'final.pdf');
    fs.writeFileSync(claim, 'new-bytes');
    fs.writeFileSync(final, 'old-bytes');
    const out = moveDownloadClaim(claim, final, { overwrite: true });
    assert.equal(out, final);
    assert.equal(fs.readFileSync(final, 'utf8'), 'new-bytes');
    assert.equal(fs.existsSync(claim), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('moveDownloadClaim is a no-op when paths match', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  try {
    const same = path.join(dir, 'same.pdf');
    fs.writeFileSync(same, 'x');
    assert.equal(moveDownloadClaim(same, same), same);
    assert.equal(fs.readFileSync(same, 'utf8'), 'x');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main asks replace and uses suggestDownloadPath', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /suggestDownloadPath/);
  assert.match(src, /askReplaceExistingDownload/);
  assert.match(src, /Replace/);
  assert.match(src, /Keep both/);
  assert.match(src, /resolveSavePathAfterPrompt/);
  assert.match(src, /moveDownloadClaim/);
  assert.match(src, /confirmGuestDownloadConflict/);
  assert.doesNotMatch(
    src,
    /setSavePath\(path\.join\(settings\.downloadPath, item\.getFilename\(\)\)\)/,
  );
});
