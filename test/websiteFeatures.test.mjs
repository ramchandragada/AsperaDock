import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'website/index.html'), 'utf8');

const REQUIRED = [
  'Hub pins',
  'Aspera Notes',
  'Aspera AI',
  'Polish',
  'Use in chat',
  'Catch me up',
  'Chrome extensions',
  'Chrome Web Store',
  'Google web search',
  'Ctrl+E',
  'Ctrl+Shift+N',
  'Zoho CRM lookup',
  'Notification center',
  'PDF preview',
  'never auto-sends',
  'SHA-256',
  'warm',
  'WhatsApp',
  'Arattai',
  'Gmail',
  'Zoho Mail',
  'Zoho CRM',
  'Zoho Books',
  'Zoho One',
];

test('asperahub.com lists current Hub features', () => {
  for (const phrase of REQUIRED) {
    assert.ok(html.includes(phrase), `website should mention "${phrase}"`);
  }
});

test('asperahub.com does not advertise disabled Forward or custom apps', () => {
  assert.equal(
    /Forward with Aspera Hub/i.test(html),
    false,
    'Forward with Hub is disabled — do not list it as a product feature',
  );
  assert.match(html, /Aspera catalog only/);
  assert.equal(/arbitrary HTTPS apps/i.test(html), true);
});
