export const PRELOAD_FRAME_ID = 'aspera-ext-chrome-frame';
export const PRELOAD_SW_ID = 'aspera-ext-chrome-sw';
export const PRELOAD_GUEST_AUTH_ID = 'aspera-guest-auth-bridge';
export const TABS_CREATE_CHANNEL = 'aspera-ext:tabs-create';
export const TABS_REMOVE_CHANNEL = 'aspera-ext:tabs-remove';

export function preloadScriptRegistered(scripts, id) {
  return (scripts || []).some((entry) => entry?.id === id);
}

export function planPreloadRegistration(scripts, preloadAbs, guestPreloadAbs = '') {
  const registrations = [];
  if (!preloadScriptRegistered(scripts, PRELOAD_FRAME_ID)) {
    registrations.push({
      id: PRELOAD_FRAME_ID,
      type: 'frame',
      filePath: preloadAbs,
    });
  }
  if (!preloadScriptRegistered(scripts, PRELOAD_SW_ID)) {
    registrations.push({
      id: PRELOAD_SW_ID,
      type: 'service-worker',
      filePath: preloadAbs,
    });
  }
  if (
    guestPreloadAbs &&
    !preloadScriptRegistered(scripts, PRELOAD_GUEST_AUTH_ID)
  ) {
    registrations.push({
      id: PRELOAD_GUEST_AUTH_ID,
      type: 'frame',
      filePath: guestPreloadAbs,
    });
  }
  return {
    registrations,
    swPreloadNew: registrations.some((entry) => entry.id === PRELOAD_SW_ID),
    guestPreloadNew: registrations.some(
      (entry) => entry.id === PRELOAD_GUEST_AUTH_ID,
    ),
  };
}

export function isExtensionServiceWorkerScope(scope) {
  return String(scope || '').startsWith('chrome-extension://');
}

export function isExtensionOAuthRedirectUrl(url) {
  const raw = String(url || '');
  if (!raw) return false;
  if (raw.startsWith('chrome-extension://')) return true;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.endsWith('.chromiumapp.org');
  } catch {
    return /chromiumapp\.org/i.test(raw);
  }
}
