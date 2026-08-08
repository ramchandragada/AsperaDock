/**
 * Linux desktop-environment helpers for Mint XFCE / Cinnamon / Ubuntu.
 * Transparent frameless windows paint black/blank without a compositor —
 * common on XFCE / LX* / MATE. Cinnamon and GNOME/Ubuntu have compositors.
 */

/**
 * @param {{
 *   platform?: string,
 *   xdgCurrentDesktop?: string,
 *   desktopSession?: string,
 *   gdmSession?: string,
 * }} [env]
 */
export function linuxUsesOpaqueOverlays(env = {}) {
  const platform = env.platform ?? process.platform;
  if (platform !== 'linux') return false;
  const de = [
    env.xdgCurrentDesktop ?? process.env.XDG_CURRENT_DESKTOP,
    env.desktopSession ?? process.env.DESKTOP_SESSION,
    env.gdmSession ?? process.env.GDMSESSION,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    de.includes('xfce') ||
    de.includes('xubuntu') ||
    de.includes('lxde') ||
    de.includes('lxqt') ||
    de.includes('openbox') ||
    de.includes('mate')
  );
}

/**
 * Desktops with a reliable compositor — transparent overlays are OK.
 * @param {Parameters<typeof linuxUsesOpaqueOverlays>[0]} [env]
 */
export function linuxHasReliableCompositor(env = {}) {
  const platform = env.platform ?? process.platform;
  if (platform !== 'linux') return true;
  if (linuxUsesOpaqueOverlays(env)) return false;
  const de = [
    env.xdgCurrentDesktop ?? process.env.XDG_CURRENT_DESKTOP,
    env.desktopSession ?? process.env.DESKTOP_SESSION,
    env.gdmSession ?? process.env.GDMSESSION,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    de.includes('cinnamon') ||
    de.includes('gnome') ||
    de.includes('ubuntu') ||
    de.includes('budgie') ||
    de.includes('pantheon') ||
    de.includes('kde') ||
    de.includes('plasma')
  );
}
