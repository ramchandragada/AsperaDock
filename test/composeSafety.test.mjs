import test from 'node:test';
import assert from 'node:assert/strict';
import { isHubComposePollution } from '../src/composeSafety.js';

test('flags Summarize PDF error text as compose pollution', () => {
  const bad =
    'Could not read this PDF from the open chat. Keep the PDF preview open and try Summarize PDF again — or tap the Download icon in the preview once, then Summarize.';
  assert.equal(isHubComposePollution(bad), true);
});

test('flags staged Forward clipboard sitting in the send box', () => {
  assert.equal(
    isHubComposePollution('hello friend', { stagedClipboard: 'hello friend' }),
    true,
  );
});

test('flags send-box text that exactly matches system clipboard (accidental Ctrl+V)', () => {
  const stamp =
    'MP charges\n5% stamp duty\n3 % Corporation Duty\nTotal Stamp Duty 9.5%';
  assert.equal(
    isHubComposePollution(stamp, { systemClipboard: stamp }),
    true,
  );
});

test('allows normal drafts that are not clipboard clones or Hub errors', () => {
  assert.equal(isHubComposePollution('See you at 5pm'), false);
  assert.equal(
    isHubComposePollution('See you at 5pm', {
      systemClipboard: 'unrelated clipboard',
      stagedClipboard: '',
    }),
    false,
  );
  assert.equal(isHubComposePollution(''), false);
});
