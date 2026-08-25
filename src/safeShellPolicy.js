/**
 * Pure openExternal allowlist (no Electron import — unit-testable).
 */
import { mustKeepGoogleUrlInApp } from './guestNav.js';

// tel:/callto: → OS (Aspera Connect Call / aspera-tel) for Zoho click-to-call in Hub.
const ALLOWED = new Set(['http:', 'https:', 'mailto:', 'tel:', 'callto:']);

export function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (!ALLOWED.has(parsed.protocol)) return false;
    // Google SSO/consent handoffs 400 in the OS browser without Hub cookies.
    if (mustKeepGoogleUrlInApp(parsed.toString())) return false;
    return true;
  } catch {
    return false;
  }
}
