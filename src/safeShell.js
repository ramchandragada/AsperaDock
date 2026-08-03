/**
 * Shared shell helpers — keep openExternal behind a scheme allowlist everywhere.
 */
import { shell } from 'electron';
import { isAllowedExternalUrl } from './safeShellPolicy.js';

export { isAllowedExternalUrl } from './safeShellPolicy.js';

export function openExternalSafe(url) {
  if (!isAllowedExternalUrl(url)) return false;
  try {
    shell.openExternal(new URL(String(url)).toString());
    return true;
  } catch {
    return false;
  }
}
