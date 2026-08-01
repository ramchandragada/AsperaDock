import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRefineDraftPrompt } from '../src/ai/skills.js';
import { parseRefinedDrafts, serializeRefinedDrafts } from '../src/ai/refineDraft.js';

const SAMPLE = `## English
Please share any new feature ideas; we will implement them if technically feasible.

## Hindi (हिन्दी)
कृपया कोई भी नए फीचर सुझाव दें; यदि तकनीकी रूप से संभव होगा तो हम उन्हें लागू करेंगे।

## Marathi (मराठी)
कृपया कोणतेही नवीन फीचर सुचवा; तंत्रज्ञानाच्या दृष्टीने शक्य असल्यास आम्ही ते अंमलात आणू.`;

test('refine prompt requests EN HI MR drafts', () => {
  const prompt = buildRefineDraftPrompt({
    text: 'if you want any new features do suggest',
    appName: 'WhatsApp',
  });
  assert.match(prompt, /## English/);
  assert.match(prompt, /## Hindi/);
  assert.match(prompt, /## Marathi/);
  assert.match(prompt, /new features do suggest/);
});

test('parseRefinedDrafts splits three languages', () => {
  const sections = parseRefinedDrafts(SAMPLE);
  assert.equal(sections.length, 3);
  assert.match(sections[0].text, /feature ideas/i);
  assert.match(sections[1].text, /फीचर/);
  assert.match(sections[2].text, /फीचर/);
});

test('serializeRefinedDrafts round-trips edits', () => {
  const sections = parseRefinedDrafts(SAMPLE);
  sections[0].text = 'Edited English draft.';
  const text = serializeRefinedDrafts(sections);
  assert.match(text, /## English\nEdited English draft\./);
  const again = parseRefinedDrafts(text);
  assert.equal(again[0].text, 'Edited English draft.');
});
