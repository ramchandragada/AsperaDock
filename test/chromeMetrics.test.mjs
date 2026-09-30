import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOP_APP_BAR_HUGE,
  TOP_APP_BAR_LARGE,
  TOP_APP_BAR_NORMAL,
  TOP_APP_BAR_SMALL,
  getChromeMetrics,
} from '../src/services.js';

test('getChromeMetrics maps each app icon size to CSS top-bar height', () => {
  assert.equal(getChromeMetrics({ appIconSize: 'small' }).top, TOP_APP_BAR_SMALL);
  assert.equal(getChromeMetrics({ appIconSize: 'normal' }).top, TOP_APP_BAR_NORMAL);
  assert.equal(getChromeMetrics({ appIconSize: 'large' }).top, TOP_APP_BAR_LARGE);
  assert.equal(getChromeMetrics({ appIconSize: 'huge' }).top, TOP_APP_BAR_HUGE);
  assert.equal(getChromeMetrics({}).top, TOP_APP_BAR_NORMAL);
  assert.equal(getChromeMetrics({ appIconSize: 'unknown' }).top, TOP_APP_BAR_NORMAL);
});
