/**
 * Shared shell helpers — keep openExternal behind a scheme allowlist everywhere.
 */
import { shell } from 'electron';

const ALLOWED = new Set(['http:', 'https:', 'mailto:']);

export function openExternalSafe(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (!ALLOWED.has(parsed.protocol)) return false;
    shell.openExternal(parsed.toString());
    return true;
  } catch {
    return false;
  }
}
