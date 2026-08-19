import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  beginDownload,
  finishDownload,
  formatBytes,
  formatRelativeTime,
  initDownloadHistory,
  listDownloadsForUi,
  lookupDownload,
  resetDownloadHistoryForTests,
  updateDownload,
} from '../src/downloadHistory.js';

test('formatBytes and relative time', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.match(formatRelativeTime(Date.now() - 30_000), /Just now|minute/);
});

test('tracks in-progress and completed downloads', () => {
  resetDownloadHistoryForTests();
  const id = 'dl-test-1';
  beginDownload(id, 'report.pdf', 4096);
  updateDownload(id, 1024, 4096);
  let list = listDownloadsForUi();
  assert.equal(list[0].state, 'progressing');
  assert.equal(list[0].progress, 25);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-dl-'));
  initDownloadHistory(tmp);
  const filePath = path.join(tmp, 'report.pdf');
  fs.writeFileSync(filePath, 'hello');

  const entry = finishDownload(id, {
    filePath,
    name: 'report.pdf',
    state: 'completed',
  });
  assert.ok(entry);
  list = listDownloadsForUi();
  assert.equal(list[0].state, 'completed');
  assert.equal(list[0].name, 'report.pdf');
  assert.equal(lookupDownload(id)?.path, filePath);

  resetDownloadHistoryForTests();
  fs.rmSync(tmp, { recursive: true, force: true });
});
