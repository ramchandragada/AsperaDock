export const PRELOAD_FRAME_ID = 'aspera-ext-chrome-frame';
export const PRELOAD_SW_ID = 'aspera-ext-chrome-sw';
export const TABS_CREATE_CHANNEL = 'aspera-ext:tabs-create';

export function preloadScriptRegistered(scripts, id) {
  return (scripts || []).some((entry) => entry?.id === id);
}

export function planPreloadRegistration(scripts, preloadAbs) {
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
  return {
    registrations,
    swPreloadNew: registrations.some((entry) => entry.id === PRELOAD_SW_ID),
  };
}

export function isExtensionServiceWorkerScope(scope) {
  return String(scope || '').startsWith('chrome-extension://');
}
