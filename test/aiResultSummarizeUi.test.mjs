import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiResultHtml } from '../src/aiResultHtml.js';

test('summarize UI has per-language cards, colors, and copy helpers', () => {
  const html = buildAiResultHtml(false);
  assert.match(html, /summary-wrap/);
  assert.match(html, /summary-editor/);
  assert.match(html, /lang-label/);
  assert.match(html, /lang-en/);
  assert.match(html, /lang-mr/);
  assert.match(html, /lang-ta/);
  assert.match(html, /renderSummaryEditor/);
  assert.match(html, /bindCopyButton/);
  assert.match(html, /parseRefineSections\(latestSummary\)/);
});
