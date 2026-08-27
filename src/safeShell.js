/**
 * Shared shell helpers — keep openExternal behind a scheme allowlist everywhere.
 * Phone dial (tel:/callto:) prefers Aspera Connect binary over OS mime.
 */
import { shell } from 'electron';
import { isAllowedExternalUrl } from './safeShellPolicy.js';
import {
  isPhoneDialUrl,
  placeCallViaAsperaConnect,
} from './asperaConnectCall.js';

export { isAllowedExternalUrl } from './safeShellPolicy.js';

export function openExternalSafe(url) {
  if (!isAllowedExternalUrl(url)) return false;
  try {
    const href = new URL(String(url)).toString();
    if (isPhoneDialUrl(href)) {
      const result = placeCallViaAsperaConnect(href);
      if (result.ok) return true;
      // Fall back to OS handler (aspera-tel / xdg-open) if Connect spawn failed.
      shell.openExternal(href);
      return true;
    }
    shell.openExternal(href);
    return true;
  } catch {
    return false;
  }
}
