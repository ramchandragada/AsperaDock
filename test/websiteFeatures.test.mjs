import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'website/index.html'), 'utf8');
const vercel = fs.readFileSync(path.join(root, 'website/vercel.json'), 'utf8');

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
  'WhatsApp Safe Mode',
  '5 by default, up to 7',
  'screen locks or your PC sleeps',
  'Keep warm',
  'Local only',
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
  assert.equal(/Hub pins \+ cross-app Forward/i.test(html), false);
  assert.equal(/Works across both messaging apps/.test(html), false);
  assert.match(html, /does <b>not<\/b> forward messages between WhatsApp and Arattai/);
  assert.match(html, /Can Hub forward a WhatsApp message to Arattai/);
  assert.match(html, /Arattai now; WhatsApp after Safe Mode off/);
  assert.match(html, /Aspera catalog only/);
  assert.equal(/arbitrary HTTPS apps/i.test(html), true);
});

test('website audit P0 copy and a11y guards', () => {
  assert.equal(/you can enable it/i.test(html), false);
  assert.equal(/Every tab stays alive/.test(html), false);
  assert.equal(/Linus Torvalds/.test(html), false);
  assert.match(html, /scroll-padding-top:76px/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /scope="row"/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /assets\/og-1200x630\.jpg/);
  assert.match(html, /application\/ld\+json/);
  assert.equal(html.includes('fonts.googleapis.com'), false);
  assert.match(html, /sudo apt install \.\/asperadock_'\+ver\+'/);
  assert.match(vercel, /stale-while-revalidate/);
  assert.match(vercel, /frame-ancestors 'none'/);
});
