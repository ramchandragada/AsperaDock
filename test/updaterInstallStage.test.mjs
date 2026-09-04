import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  stagePackageForElevatedInstall,
  shouldSilentInstallOnQuit,
} from '../src/updateInstallPolicy.js';

test('stagePackageForElevatedInstall copies to /tmp without spaces and chmod 0644', () => {
  const calls = { copied: null, mode: null };
  const dest = stagePackageForElevatedInstall(
    '/home/user/.config/Aspera Dock/updates/asperadock_0.5.75_amd64.deb',
    {
      tmpDir: '/tmp',
      copyFileSync: (src, d) => {
        calls.copied = { src, dest: d };
      },
      chmodSync: (_p, mode) => {
        calls.mode = mode;
      },
    },
  );
  assert.equal(dest, '/tmp/asperadock-update-asperadock_0.5.75_amd64.deb');
  assert.ok(!dest.includes(' '));
  assert.equal(calls.copied.src.includes('Aspera Dock'), true);
  assert.equal(calls.mode, 0o644);
});

test('stagePackageForElevatedInstall sanitizes odd basenames', () => {
  const dest = stagePackageForElevatedInstall('/tmp/weird name!.deb', {
    tmpDir: '/var/tmp',
    copyFileSync: () => {},
    chmodSync: () => {},
  });
  assert.equal(dest, path.join('/var/tmp', 'asperadock-update-weird_name_.deb'));
});

test('shouldSilentInstallOnQuit is AppImage-only and blocked while installBusy', () => {
  const exists = () => true;
  assert.equal(
    shouldSilentInstallOnQuit({
      autoUpdateInstall: true,
      packaging: 'deb',
      downloadedPath: '/tmp/x.deb',
      pendingUpdate: { version: '0.5.75' },
      installBusy: false,
      existsSync: exists,
    }),
    false,
  );
  assert.equal(
    shouldSilentInstallOnQuit({
      autoUpdateInstall: true,
      packaging: 'appimage',
      downloadedPath: '/tmp/x.AppImage',
      pendingUpdate: { version: '0.5.75' },
      installBusy: true,
      existsSync: exists,
    }),
    false,
  );
  assert.equal(
    shouldSilentInstallOnQuit({
      autoUpdateInstall: true,
      packaging: 'appimage',
      downloadedPath: '/tmp/x.AppImage',
      pendingUpdate: { version: '0.5.75' },
      installBusy: false,
      existsSync: exists,
    }),
    true,
  );
});
