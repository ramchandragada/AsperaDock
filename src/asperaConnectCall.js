/**
 * Bridge Aspera Hub → Aspera Connect for click-to-call.
 *
 * Prefer launching the Connect binary directly (avoids flaky xdg-mime and
 * ~/.local/bin PATH shadows). Fall back to OS tel: handler when Connect
 * is not installed.
 */
import { spawn } from 'node:child_process';
import { Notification } from 'electron';
import {
  isPhoneDialUrl,
  normalizeDialTarget,
  resolveAsperaConnectBinary,
  resolveAsperaTelHelper,
} from './asperaConnectCallPolicy.js';

export {
  isPhoneDialUrl,
  normalizeDialTarget,
  resolveAsperaConnectBinary,
  resolveAsperaTelHelper,
} from './asperaConnectCallPolicy.js';

function notify(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Launch Connect (or aspera-tel) with a dial request.
 * @param {string} url tel:/callto:/number
 * @returns {{ ok: boolean, via: string, detail?: string }}
 */
export function placeCallViaAsperaConnect(url) {
  const num = normalizeDialTarget(url);
  if (!num) {
    return { ok: false, via: 'none', detail: 'invalid_number' };
  }
  const telArg = `tel:${num}`;

  const connect = resolveAsperaConnectBinary();
  if (connect) {
    try {
      const child = spawn(connect, [telArg], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      notify('Aspera Call', `Calling ${num} via Aspera Connect…`);
      return { ok: true, via: 'aspera-connect', detail: connect };
    } catch (err) {
      return {
        ok: false,
        via: 'aspera-connect',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const helper = resolveAsperaTelHelper();
  if (helper) {
    try {
      const child = spawn(helper, [telArg], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      notify('Aspera Call', `Calling ${num}…`);
      return { ok: true, via: 'aspera-tel', detail: helper };
    } catch (err) {
      return {
        ok: false,
        via: 'aspera-tel',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  notify(
    'Aspera Call',
    'Install Aspera Connect on this PC, pair the phone (Show QR), then try again.',
  );
  return { ok: false, via: 'none', detail: 'connect_not_installed' };
}

export function isAsperaConnectInstalled() {
  return Boolean(resolveAsperaConnectBinary() || resolveAsperaTelHelper());
}

/** Open / focus Aspera Connect without placing a call. */
export function openAsperaConnectApp() {
  const connect = resolveAsperaConnectBinary();
  if (!connect) {
    notify(
      'Aspera Connect',
      'Not installed. Install AsperaConnect-Desktop.deb, then pair with Show QR.',
    );
    return false;
  }
  try {
    const child = spawn(connect, [], { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
