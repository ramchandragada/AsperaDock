import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoomFactor,
  formatZoomPercent,
  nextZoomFactor,
} from '../src/zoomPolicy.js';

test('clampZoomFactor keeps values in range', () => {
  assert.equal(clampZoomFactor(1), 1);
  assert.equal(clampZoomFactor(0.2), ZOOM_MIN);
  assert.equal(clampZoomFactor(3), ZOOM_MAX);
  assert.equal(clampZoomFactor('bad'), 1);
  assert.equal(clampZoomFactor(0), 1);
});

test('formatZoomPercent shows whole percents', () => {
  assert.equal(formatZoomPercent(1), '100%');
  assert.equal(formatZoomPercent(1.1), '110%');
  assert.equal(formatZoomPercent(0.8), '80%');
  assert.equal(formatZoomPercent(2), '200%');
});

test('nextZoomFactor steps and clamps', () => {
  assert.equal(nextZoomFactor(1, { delta: ZOOM_STEP }), 1.1);
  assert.equal(nextZoomFactor(1, { delta: -ZOOM_STEP }), 0.9);
  assert.equal(nextZoomFactor(0.55, { delta: -ZOOM_STEP }), ZOOM_MIN);
  assert.equal(nextZoomFactor(1.95, { delta: ZOOM_STEP }), ZOOM_MAX);
  assert.equal(nextZoomFactor(1.25, { exact: 1 }), 1);
});
