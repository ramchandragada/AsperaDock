/**
 * Linux desktop-environment helpers for Mint XFCE / Cinnamon / Ubuntu /
 * Q4OS Andromeda (Plasma / Trinity) and other light desktops.
 * Transparent frameless windows paint black/blank without a compositor —
 * common on XFCE / LX* / MATE / Trinity. Cinnamon, GNOME, and full Plasma
 * usually have compositors (unless KWin composition is turned off for RAM).
 */

import fs from 'node:fs';

/**
 * @param {{
 *   platform?: string,
 *   xdgCurrentDesktop?: string,
 *   desktopSession?: string,
 *   gdmSession?: string,
 *   kwinCompose?: string,
 *   osRelease?: string,
 *   asperaLean?: string,
 * }} [env]
 */
export function linuxDesktopFingerprint(env = {}) {
  return [
    env.xdgCurrentDesktop ?? process.env.XDG_CURRENT_DESKTOP,
    env.desktopSession ?? process.env.DESKTOP_SESSION,
    env.gdmSession ?? process.env.GDMSESSION,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** @type {string | null} */
let osReleaseCache = null;

/**
 * Read /etc/os-release once (sync, small). Overridable via env.osRelease for tests.
 * @param {{ osRelease?: string, platform?: string }} [env]
 */
export function readLinuxOsRelease(env = {}) {
  if (typeof env.osRelease === 'string') return env.osRelease.toLowerCase();
  const platform = env.platform ?? process.platform;
  if (platform !== 'linux') return '';
  if (osReleaseCache != null) return osReleaseCache;
  try {
    osReleaseCache = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
  } catch {
    osReleaseCache = '';
  }
  return osReleaseCache;
}

/** Test helper — clear cached os-release. */
export function resetLinuxOsReleaseCache() {
  osReleaseCache = null;
}

/** Q4OS Andromeda / Q4OS Plasma / Trinity editions. */
export function linuxIsQ4OS(env = {}) {
  const release = readLinuxOsRelease(env);
  if (
    release.includes('q4os') ||
    release.includes('andromeda') ||
    /\bid\s*=\s*"?q4os"?/.test(release)
  ) {
    return true;
  }
  const de = linuxDesktopFingerprint(env);
  return de.includes('q4os');
}

/** KDE Plasma (Q4OS Plasma edition, Neon, Kubuntu, …). */
export function linuxIsPlasmaDesktop(env = {}) {
  const de = linuxDesktopFingerprint(env);
  return de.includes('plasma') || de.includes('kde');
}

/** Trinity Desktop (TDE) — Q4OS default on many low-RAM images. */
export function linuxIsTrinityDesktop(env = {}) {
  const de = linuxDesktopFingerprint(env);
  return (
    de.includes('trinity') ||
    de.includes('tde') ||
    de.includes('trinity-session')
  );
}

/**
 * KWin composition explicitly off (common on low-spec Q4OS Plasma to save RAM).
 * KWIN_COMPOSE=N → no compositor → transparent Electron windows go black.
 */
export function linuxPlasmaCompositorDisabled(env = {}) {
  const compose = String(
    env.kwinCompose ?? process.env.KWIN_COMPOSE ?? '',
  )
    .trim()
    .toUpperCase();
  return compose === 'N' || compose === 'OFF' || compose === 'NONE';
}

/**
 * Company low-spec fleet: Q4OS Andromeda / Plasma / Trinity.
 * Used for opaque overlays + optional one-shot lean defaults — never Mint.
 */
export function linuxIsLeanFleetDesktop(env = {}) {
  const platform = env.platform ?? process.platform;
  if (platform !== 'linux') return false;
  if (linuxIsQ4OS(env)) return true;
  if (linuxIsTrinityDesktop(env)) return true;
  // Plasma alone is not enough (Kubuntu/Neon can be fine) — only lean when
  // composition is off or the operator opts in.
  if (
    linuxIsPlasmaDesktop(env) &&
    (linuxPlasmaCompositorDisabled(env) ||
      String(env.asperaLean ?? process.env.ASPERA_LEAN ?? '') === '1')
  ) {
    return true;
  }
  return String(env.asperaLean ?? process.env.ASPERA_LEAN ?? '') === '1';
}

/**
 * @param {Parameters<typeof linuxDesktopFingerprint>[0] & {
 *   platform?: string,
 *   kwinCompose?: string,
 *   osRelease?: string,
 *   asperaLean?: string,
 * }} [env]
 */
export function linuxUsesOpaqueOverlays(env = {}) {
  const platform = env.platform ?? process.platform;
  if (platform !== 'linux') return false;
  const de = linuxDesktopFingerprint(env);
  if (
    de.includes('xfce') ||
    de.includes('xubuntu') ||
    de.includes('lxde') ||
    de.includes('lxqt') ||
    de.includes('openbox') ||
    de.includes('mate') ||
    linuxIsTrinityDesktop(env)
  ) {
    return true;
  }
  // Q4OS fleet (often weak/software KWin) — opaque floats avoid black menus.
  if (linuxIsQ4OS(env)) return true;
  // Plasma with composition disabled (low-RAM tip) → same as XFCE.
  if (linuxIsPlasmaDesktop(env) && linuxPlasmaCompositorDisabled(env)) {
    return true;
  }
  return false;
}

/**
 * Desktops with a reliable compositor — transparent overlays are OK.
 * @param {Parameters<typeof linuxUsesOpaqueOverlays>[0]} [env]
 */
export function linuxHasReliableCompositor(env = {}) {
  const platform = env.platform ?? process.platform;
  if (platform !== 'linux') return true;
  if (linuxUsesOpaqueOverlays(env)) return false;
  const de = linuxDesktopFingerprint(env);
  return (
    de.includes('cinnamon') ||
    de.includes('gnome') ||
    de.includes('ubuntu') ||
    de.includes('budgie') ||
    de.includes('pantheon') ||
    (de.includes('kde') && !linuxPlasmaCompositorDisabled(env)) ||
    (de.includes('plasma') && !linuxPlasmaCompositorDisabled(env))
  );
}
