/**
 * Shared shell helpers — keep openExternal behind a scheme allowlist everywhere.
 */
import { shell } from 'electron';
import { mustKeepGoogleUrlInApp } from './guestNav.js';

const ALLOWED = new Set(['http:', 'https:', 'mailto:']);

export function openExternalSafe(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (!ALLOWED.has(parsed.protocol)) return false;
    // Google SSO/consent handoffs 400 in the OS browser without Hub cookies.
    if (mustKeepGoogleUrlInApp(parsed.toString())) return false;
    shell.openExternal(parsed.toString());
    return true;
  } catch {
    return false;
  }
}
