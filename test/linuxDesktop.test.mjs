import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linuxUsesOpaqueOverlays,
  linuxHasReliableCompositor,
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
    }),
    false,
  );
  assert.equal(
    linuxUsesOpaqueOverlays({
      platform: 'linux',
      xdgCurrentDesktop: 'ubuntu:GNOME',
      desktopSession: 'ubuntu',
    }),
    false,
  );
  assert.equal(
    linuxHasReliableCompositor({
      platform: 'linux',
      xdgCurrentDesktop: 'X-Cinnamon',
    }),
    true,
  );
  assert.equal(
    linuxHasReliableCompositor({
      platform: 'linux',
      xdgCurrentDesktop: 'ubuntu:GNOME',
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
