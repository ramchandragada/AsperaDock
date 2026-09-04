/**
 * Pure helpers for elevated .deb/.rpm install staging (unit-testable).
 */
import path from 'node:path';

/**
 * Build a world-readable /tmp path without spaces for pkexec/dpkg.
 * Elevating from ~/.config/Aspera Dock/updates/ is fragile on Mint/Zorin.
 *
 * @param {string} srcPath
 * @param {{ tmpDir?: string, copyFileSync: Function, chmodSync?: Function }} opts
 */
export function stagePackageForElevatedInstall(srcPath, opts) {
  const tmpDir = opts?.tmpDir || '/tmp';
  if (typeof opts?.copyFileSync !== 'function') {
    throw new Error('copyFileSync required');
  }
  const copyFileSync = opts.copyFileSync;
  const chmodSync = opts.chmodSync;
  const base = path.basename(String(srcPath || 'update.deb'));
  const safe = base.replace(/[^\w.\-+]/g, '_') || 'update.deb';
  const dest = path.join(tmpDir, `asperadock-update-${safe}`);
  copyFileSync(srcPath, dest);
  if (typeof chmodSync === 'function') {
    try {
      chmodSync(dest, 0o644);
    } catch {
      // ignore
    }
  }
  return dest;
}

/** AppImage-only silent quit install — deb/rpm need interactive polkit. */
export function shouldSilentInstallOnQuit({
  autoUpdateInstall,
  packaging,
  downloadedPath,
  pendingUpdate,
  installBusy,
  existsSync,
} = {}) {
  return (
    autoUpdateInstall === true &&
    packaging === 'appimage' &&
    Boolean(downloadedPath) &&
    typeof existsSync === 'function' &&
    existsSync(downloadedPath) &&
    Boolean(pendingUpdate) &&
    !installBusy
  );
}
