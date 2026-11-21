import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('low memory mode throttles background guests for CPU', () => {
  assert.match(mainSrc, /const leanCpu = isLowMemoryMode\(\)/);
  assert.match(mainSrc, /setBackgroundThrottling\(!active\)/);
  assert.match(
    mainSrc,
    /Low memory mode: allow Chromium to background-throttle/,
  );
  assert.match(mainSrc, /if \(!lean\) \{[\s\S]*?disable-background-timer-throttling/);
});

test('low memory throttles selected tab when idle or Hub unfocused', () => {
  assert.match(mainSrc, /LEAN_ACTIVE_IDLE_THROTTLE_SEC/);
  assert.match(mainSrc, /function leanGuestRunsFullSpeed/);
  assert.match(mainSrc, /const interactive = lean/);
  assert.match(mainSrc, /leanGuestRunsFullSpeed\(id\)/);
  assert.match(
    mainSrc,
    /if \(isLowMemoryMode\(\)\) syncAllGuestPerfModes\(\);/,
  );
});

test('low memory hides guests when Hub is unused (compositor + page visibility)', () => {
  assert.match(mainSrc, /function setGuestLeanPageHidden/);
  assert.match(mainSrc, /function applyGuestLeanCompositor/);
  assert.match(mainSrc, /setGuestLeanPageHidden\(webContents, !active\)/);
  assert.match(mainSrc, /__asperaLeanHidden/);
  assert.match(
    mainSrc,
    /entry\.view\.setVisible\(false\)/,
  );
  assert.match(
    mainSrc,
    /entry\.view\.setVisible\(!isLowMemoryMode\(\)\)/,
  );
});

test('low memory softens startup and tab-switch CPU spikes', () => {
  assert.match(mainSrc, /LEAN_ACTIVATE_RAMP_MS/);
  assert.match(mainSrc, /LEAN_WARM_WAKE_STAGGER_MS/);
  assert.match(mainSrc, /function scheduleLeanActivateRamp/);
  assert.match(mainSrc, /scheduleLeanActivateRamp\(id\)/);
  assert.match(
    mainSrc,
    /staggerMs = lean \? LEAN_WARM_WAKE_STAGGER_MS : 250/,
  );
});

test('low memory may hibernate default keep-warm messaging', () => {
  assert.match(mainSrc, /isExplicitKeepWarm\(id\)/);
  assert.match(mainSrc, /lean \? explicitWarmIds\(\) : selectedWarmIds\(\)/);
});

test('low memory skips periodic capturePage surface polls', () => {
  assert.match(
    mainSrc,
    /setInterval\(\(\) => \{\s*if \(isLowMemoryMode\(\)\) return;/,
  );
  assert.match(mainSrc, /ACTIVE_SURFACE_CHECK_DELAYS_LEAN_MS/);
  assert.match(mainSrc, /MEMORY_SAMPLE_LEAN_MS/);
});

test('settings save re-applies guest perf + memory timer', () => {
  assert.match(
    mainSrc,
    /syncAllGuestPerfModes\(\);\s*startMemoryTimer\(\);/,
  );
});

test('settings copy mentions CPU throttle for thin clients', () => {
  assert.match(indexHtml, /throttles background \+ idle tabs to cut CPU/);
  assert.match(indexHtml, /Softens startup and tab-switch spikes/);
  assert.match(indexHtml, /hide and pause/);
  assert.match(indexHtml, /HP t640/);
});
