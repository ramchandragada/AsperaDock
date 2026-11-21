import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DOWNLOAD_STREAM_ATTEMPTS,
  partResumeOffset,
  rangeRequestHeaders,
  resolveDownloadTotal,
  shouldDiscardPartialOnError,
} from '../src/updateDownloadStream.js';
import { isRetryableDownloadError } from '../src/updateDownloadErrors.js';

test('partResumeOffset resumes mid-file and restarts when complete', () => {
  assert.equal(partResumeOffset(0, 100), 0);
  assert.equal(partResumeOffset(40, 100), 40);
  assert.equal(partResumeOffset(100, 100), 0);
  assert.equal(partResumeOffset(120, 100), 0);
});

test('rangeRequestHeaders only set when resuming', () => {
  assert.deepEqual(rangeRequestHeaders(0), {});
  assert.deepEqual(rangeRequestHeaders(4096), { Range: 'bytes=4096-' });
});

test('resolveDownloadTotal prefers Content-Range total', () => {
  assert.equal(
    resolveDownloadTotal({
      status: 206,
      contentLength: 60,
      contentRange: 'bytes 40-99/100',
      startAt: 40,
      expectedSize: 100,
    }),
    100,
  );
  assert.equal(
    resolveDownloadTotal({
      status: 200,
      contentLength: 100,
      startAt: 0,
      expectedSize: 100,
    }),
    100,
  );
});

test('partial files are kept on stall/truncate, discarded on checksum', () => {
  assert.equal(
    shouldDiscardPartialOnError(new Error('Download stalled — no data received')),
    false,
  );
  assert.equal(
    shouldDiscardPartialOnError(new Error('Download truncated (10 of 100 bytes)')),
    false,
  );
  const mismatch = new Error('Checksum mismatch — download rejected');
  mismatch.code = 'CHECKSUM_MISMATCH';
  assert.equal(shouldDiscardPartialOnError(mismatch), true);
});

test('stall errors are retryable and updater uses resume attempts', () => {
  assert.equal(isRetryableDownloadError('Download stalled — no data received'), true);
  assert.ok(DOWNLOAD_STREAM_ATTEMPTS >= 8);
  const updaterSrc = fs.readFileSync(
    new URL('../src/updater.js', import.meta.url),
    'utf8',
  );
  assert.match(updaterSrc, /partResumeOffset/);
  assert.match(updaterSrc, /rangeOffset: startAt/);
  assert.match(updaterSrc, /readBodyChunkWithStall/);
  assert.match(updaterSrc, /shouldDiscardPartialOnError/);
});
