import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteNote,
  noteCopyText,
  sanitizeNotes,
  upsertNote,
} from '../src/notesStore.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('sanitizeNotes drops empty rows and sorts newest first', () => {
  const notes = sanitizeNotes([
    { id: 'a', title: 'Old', body: 'one', updatedAt: 1 },
    { id: 'b', title: '  ', body: '   ', updatedAt: 9 },
    { id: 'c', title: 'New', body: 'two', updatedAt: 5 },
    { id: 'a', title: 'Dup', body: 'skip', updatedAt: 8 },
  ]);
  assert.deepEqual(
    notes.map((n) => n.id),
    ['c', 'a'],
  );
  assert.equal(notes[1].title, 'Old');
});

test('upsertNote creates then updates the same id', () => {
  const created = upsertNote([], { title: 'Office', body: 'https://maps.example/office' });
  assert.equal(created.ok, true);
  assert.equal(created.notes.length, 1);
  const id = created.note.id;
  const updated = upsertNote(created.notes, {
    id,
    title: 'Office map',
    body: 'https://maps.example/office',
  });
  assert.equal(updated.notes.length, 1);
  assert.equal(updated.notes[0].title, 'Office map');
});

test('noteCopyText prefers body; includeTitle adds both', () => {
  const note = { title: 'KYC', body: 'Please share Aadhaar + PAN' };
  assert.equal(noteCopyText(note), 'Please share Aadhaar + PAN');
  assert.equal(
    noteCopyText(note, { includeTitle: true }),
    'KYC\nPlease share Aadhaar + PAN',
  );
  assert.equal(noteCopyText({ title: 'Link only', body: '' }), 'Link only');
});

test('deleteNote removes by id', () => {
  const { notes } = deleteNote(
    [
      { id: 'a', title: 'A', body: '1', updatedAt: 2 },
      { id: 'b', title: 'B', body: '2', updatedAt: 1 },
    ],
    'a',
  );
  assert.deepEqual(notes.map((n) => n.id), ['b']);
});

test('main and chrome wire a Notes panel without Use in chat', () => {
  const main = readFileSync(
    fileURLToPath(new URL('../src/main.js', import.meta.url)),
    'utf8',
  );
  const html = readFileSync(
    fileURLToPath(new URL('../src/notesHtml.js', import.meta.url)),
    'utf8',
  );
  assert.match(main, /openNotesWindow/);
  assert.ok(main.includes('notesPreload.js'));
  assert.ok(main.includes("from './notesHtml.js'"));
  assert.doesNotMatch(html, /Use in chat/);
  assert.match(html, /Copy/);
});
