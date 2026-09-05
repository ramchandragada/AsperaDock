import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linuxUsesOpaqueOverlays,
  linuxHasReliableCompositor,
  linuxIsQ4OS,
  linuxIsZorinOS,
  linuxIsPlasmaDesktop,
  linuxIsTrinityDesktop,
  linuxPlasmaCompositorDisabled,
  linuxIsLeanFleetDesktop,
  linuxNeedsDelayedMaximize,
  resetLinuxOsReleaseCache,
} from '../src/linuxDesktop.js';

test('XFCE / Xubuntu / MATE use opaque overlays', () => {
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'XFCE',
      desktopSession: 'xfce',
    }),
    true,
  );
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'Xubuntu',
    }),
    true,
  );
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'MATE',
      desktopSession: 'mate',
    }),
    true,
  );
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'LXQt',
    }),
    true,
  );
});

test('Cinnamon and Ubuntu GNOME keep transparent overlays', () => {
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'X-Cinnamon',
      desktopSession: 'cinnamon',
      osRelease: 'ID=linuxmint\n',
    }),
    false,
  );
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'ubuntu:GNOME',
      desktopSession: 'ubuntu',
      osRelease: 'ID=ubuntu\n',
    }),
    false,
  );
  assert.equal(
    linuxHasReliableCompositor({
      platform: 'linux',
      xdgCurrentDesktop: 'X-Cinnamon',
      osRelease: 'ID=linuxmint\n',
    }),
    true,
  );
  assert.equal(
    linuxHasReliableCompositor({
      platform: 'linux',
      xdgCurrentDesktop: 'ubuntu:GNOME',
      osRelease: 'ID=ubuntu\n',
    }),
    true,
  );
});

test('non-linux never forces opaque overlays', () => {
  assert.equal(
    linuxUsesOpaqueOverlays({ platform: 'darwin', xdgCurrentDesktop: 'XFCE' }),
    false,
  );
});

test('Q4OS Andromeda detected from os-release', () => {
  resetLinuxOsReleaseCache();
  assert.equal(
    linuxIsQ4OS({
      platform: 'linux',
      osRelease: 'NAME="Q4OS"\nID=q4os\nVERSION="Andromeda"\n',
    }),
    true,
  );
  assert.equal(
    linuxIsQ4OS({
      platform: 'linux',
      osRelease: 'NAME="Ubuntu"\nID=ubuntu\n',
      xdgCurrentDesktop: 'KDE',
    }),
    false,
  );
});

test('Trinity desktop is opaque + lean', () => {
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'Trinity',
    desktopSession: 'trinity',
    osRelease: 'ID=q4os\n',
  };
  assert.equal(linuxIsTrinityDesktop(env), true);
  assert.equal(linuxUsesOpaqueOverlays(env), true);
  assert.equal(linuxIsLeanFleetDesktop(env), true);
});

test('Q4OS Plasma uses opaque overlays and lean fleet', () => {
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'KDE',
    desktopSession: 'plasma',
    osRelease: 'NAME="Q4OS"\nID=q4os\nVERSION_CODENAME=andromeda\n',
  };
  assert.equal(linuxIsQ4OS(env), true);
  assert.equal(linuxIsPlasmaDesktop(env), true);
  assert.equal(linuxUsesOpaqueOverlays(env), true);
  assert.equal(linuxIsLeanFleetDesktop(env), true);
});

test('Plasma with compositor on is not lean (non-Q4OS)', () => {
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'KDE',
    desktopSession: 'plasma',
    osRelease: 'ID=neon\n',
    kwinCompose: '',
  };
  assert.equal(linuxIsPlasmaDesktop(env), true);
  assert.equal(linuxPlasmaCompositorDisabled(env), false);
  assert.equal(linuxUsesOpaqueOverlays(env), false);
  assert.equal(linuxIsLeanFleetDesktop(env), false);
  assert.equal(linuxHasReliableCompositor(env), true);
});

test('Plasma with KWIN_COMPOSE=N is opaque + lean', () => {
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'plasma',
    desktopSession: 'plasma',
    osRelease: 'ID=kubuntu\n',
    kwinCompose: 'N',
  };
  assert.equal(linuxPlasmaCompositorDisabled(env), true);
  assert.equal(linuxUsesOpaqueOverlays(env), true);
  assert.equal(linuxIsLeanFleetDesktop(env), true);
  assert.equal(linuxHasReliableCompositor(env), false);
});

test('ASPERA_LEAN=1 forces lean on any Linux DE', () => {
  assert.equal(
    linuxIsLeanFleetDesktop({
      platform: 'linux',
      xdgCurrentDesktop: 'X-Cinnamon',
      osRelease: 'ID=linuxmint\n',
      asperaLean: '1',
    }),
    true,
  );
});

test('Mint XFCE stays opaque but is not lean fleet', () => {
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'XFCE',
    desktopSession: 'xfce',
    osRelease: 'ID=linuxmint\n',
  };
  assert.equal(linuxUsesOpaqueOverlays(env), true);
  assert.equal(linuxIsLeanFleetDesktop(env), false);
});

test('Zorin Core GNOME is detected; transparent overlays; not lean', () => {
  resetLinuxOsReleaseCache();
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'zorin:GNOME',
    desktopSession: 'zorin',
    osRelease: 'NAME="Zorin OS"\nID=zorin\nID_LIKE=ubuntu\n',
  };
  assert.equal(linuxIsZorinOS(env), true);
  assert.equal(linuxUsesOpaqueOverlays(env), false);
  assert.equal(linuxHasReliableCompositor(env), true);
  assert.equal(linuxIsLeanFleetDesktop(env), false);
  assert.equal(linuxNeedsDelayedMaximize(env), true);
});

test('Zorin Lite XFCE stays opaque like Mint XFCE; still not lean', () => {
  const env = {
    platform: 'linux',
    xdgCurrentDesktop: 'XFCE',
    desktopSession: 'xfce',
    osRelease: 'ID=zorin\n',
  };
  assert.equal(linuxIsZorinOS(env), true);
  assert.equal(linuxUsesOpaqueOverlays(env), true);
  assert.equal(linuxIsLeanFleetDesktop(env), false);
  assert.equal(linuxNeedsDelayedMaximize(env), true);
});

test('Mint Cinnamon needs delayed maximize (same GNOME-class race)', () => {
  assert.equal(
    linuxNeedsDelayedMaximize({
      platform: 'linux',
      xdgCurrentDesktop: 'X-Cinnamon',
      osRelease: 'ID=linuxmint\n',
    }),
    true,
  );
});
