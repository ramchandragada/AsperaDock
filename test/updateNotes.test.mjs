import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWhatsNewNotes,
  formatNotesAsBullets,
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

test('formatNotesAsBullets handles single-line notes', () => {
  assert.equal(
    formatNotesAsBullets('Polish image Forward paste (v0.2.96).'),
    '• Polish image Forward paste (v0.2.96).',
  );
});
