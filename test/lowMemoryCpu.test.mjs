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
  assert.match(
    mainSrc,
    /active: lean \? isSelected && leanGuestRunsFullSpeed\(id\) : isSelected/,
  );
  assert.match(
    mainSrc,
    /if \(isLowMemoryMode\(\)\) syncAllGuestPerfModes\(\);/,
  );
});

test('low memory may hibernate default keep-warm messaging', () => {
  assert.match(mainSrc, /isExplicitKeepWarm\(id\)/);
  assert.match(
    mainSrc,
    /isLowMemoryMode\(\) \? explicitWarmIds\(\) : selectedWarmIds\(\)/,
  );
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
  assert.match(indexHtml, /HP t640/);
});
