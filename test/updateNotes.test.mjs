import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWhatsNewNotes,
  formatNotesAsBullets,
  formatDownloadProgressLine,
  formatUpdatePromptDetail,
} from '../src/updateNotes.js';

test('extractWhatsNewNotes strips Install boilerplate', () => {
  const raw = [
    'Unify Forward flow for text, images, and documents (v0.3.0).',
    '',
    '## Install',
    '- **Debian / Ubuntu / Mint:** download the `.deb`',
    '',
    '_Electron runtime is bundled — users never update Electron separately._',
  ].join('\n');
  assert.equal(
    extractWhatsNewNotes(raw),
    'Unify Forward flow for text, images, and documents (v0.3.0).',
  );
});

test('extractWhatsNewNotes hides merge-commit-only release notes', () => {
  assert.equal(
    extractWhatsNewNotes(
      'Merge pull request #179 from ramchandragada/cursor/idle-cpu-when-unused-55c1',
    ),
    '',
  );
});

test('formatUpdatePromptDetail includes Whats new and action cue', () => {
  const detail = formatUpdatePromptDetail({
    version: '0.3.1',
    notes: 'Add lock button.\nShow update notes.',
    phase: 'ready',
  });
  assert.match(detail, /What's new in 0\.3\.1/);
  assert.match(detail, /• Add lock button\./);
  assert.match(detail, /• Show update notes\./);
  assert.match(detail, /Restart to apply/);
});

test('formatUpdatePromptDetail downloading phase shows progress and size hint', () => {
  const detail = formatUpdatePromptDetail({
    version: '0.5.88',
    notes: 'Hide unused guests.',
    phase: 'downloading',
    progress: { percent: 42, received: 37_000_000, total: 88_000_000 },
  });
  assert.match(detail, /42% · 35 MB \/ 84 MB/);
  assert.match(detail, /85 MB/);
  assert.match(detail, /Install & restart/);
  assert.match(detail, /What's new in 0\.5\.88/);
});

test('formatDownloadProgressLine covers starting and retry', () => {
  assert.equal(formatDownloadProgressLine(null), 'Download in progress…');
  assert.equal(formatDownloadProgressLine({}), 'Download starting…');
  assert.match(
    formatDownloadProgressLine({ retrying: true, attempt: 2 }),
    /Retrying download \(attempt 2\)/,
  );
});

test('formatNotesAsBullets handles single-line notes', () => {
  assert.equal(
    formatNotesAsBullets('Polish image Forward paste (v0.2.96).'),
    '• Polish image Forward paste (v0.2.96).',
  );
});
