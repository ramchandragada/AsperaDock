import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('context menu offers Hub tab and default browser for links', () => {
  assert.match(mainSrc, /label: 'Open in Hub tab'/);
  assert.match(mainSrc, /label: 'Open in default browser'/);
  assert.match(mainSrc, /openLinkInHubTabFromMenu/);
  assert.match(mainSrc, /openLinkInDefaultBrowserFromMenu/);
});

test('messaging outbound links honor Link handling modes', () => {
  assert.match(mainSrc, /function openMessagingOutboundLink/);
  assert.match(mainSrc, /openMessagingOutboundLink\(service, href, webContents\)/);
  assert.match(
    mainSrc,
    /shouldAskLinkHandling\(mode\)[\s\S]*?promptAndApplyLinkChoice/,
  );
  assert.match(
    mainSrc,
    /shouldOpenUnknownExternally\(mode\)[\s\S]*?openExternalSafe/,
  );
});

test('settings hint mentions right-click open choices', () => {
  assert.match(indexHtml, /Open in Hub tab or Open in default browser/);
});
