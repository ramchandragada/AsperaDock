/**
 * Clear Chromium single-instance lock files only when safe.
 *
 * A dangling SingletonSocket alone must NEVER delete a live SingletonLock —
 * that allowed a second Aspera Hub process on the same profile (extra windows
 * and WhatsApp/Arattai sign-outs).
 *
 * @param {string} userDataPath
 * @param {{
 *   lstatSync?: (p: string) => { isSymbolicLink: () => boolean },
 *   statSync?: (p: string) => unknown,
 *   readlinkSync?: (p: string) => string,
 *   unlinkSync?: (p: string) => void,
 *   kill?: (pid: number, signal?: number|string) => boolean,
 *   join?: (...parts: string[]) => string,
 * }} [io] injectable fs/process for tests
 * @returns {'kept-live'|'cleaned'|'noop'}
 */
import path from 'node:path';
import fs from 'node:fs';

export function clearStaleChromiumSingleton(userDataPath, io = {}) {
  const join = io.join || path.join;
  const lstatSync = io.lstatSync || fs.lstatSync.bind(fs);
  const statSync = io.statSync || fs.statSync.bind(fs);
  const readlinkSync = io.readlinkSync || fs.readlinkSync.bind(fs);
  const unlinkSync = io.unlinkSync || fs.unlinkSync.bind(fs);
  const kill = io.kill || process.kill.bind(process);

  const lockPath = join(userDataPath, 'SingletonLock');
  const cookiePath = join(userDataPath, 'SingletonCookie');
  const socketPath = join(userDataPath, 'SingletonSocket');

  // Live lock owner → leave every singleton file alone.
  try {
    if (lstatSync(lockPath).isSymbolicLink()) {
      const target = String(readlinkSync(lockPath) || '');
      const m = target.match(/-(\d+)$/);
      if (m) {
        const pid = parseInt(m[1], 10);
        if (Number.isFinite(pid) && pid > 0) {
          try {
            kill(pid, 0);
            return 'kept-live';
          } catch {
            // Owner is dead — fall through to cleanup.
          }
        }
      }
    }
  } catch {
    // No lock symlink.
  }

  let shouldClean = false;

  try {
    if (lstatSync(lockPath).isSymbolicLink()) {
      // Lock present but owner dead / unreadable — clean.
      shouldClean = true;
    }
  } catch {
    // No lock.
  }

  try {
    if (lstatSync(socketPath).isSymbolicLink()) {
      try {
        statSync(socketPath);
      } catch {
        // Dangling socket with no live lock — safe leftover cleanup.
        shouldClean = true;
      }
    }
  } catch {
    // No socket.
  }

  if (!shouldClean) return 'noop';

  for (const p of [lockPath, cookiePath, socketPath]) {
    try {
      unlinkSync(p);
    } catch {
      // ignore
    }
  }
  return 'cleaned';
}
