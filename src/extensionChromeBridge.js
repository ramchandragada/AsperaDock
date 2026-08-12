/**
 * Minimal chrome.tabs bridge for extension auth (Grammarly sign-in, etc.).
 * Electron lacks tabs.create/onUpdated — patched extensions relay through guest
 * pages; this module opens auth windows and emits tab navigation events.
 */
import { ipcMain } from 'electron';
import path from 'node:path';
import { isExtensionAuthPopupUrl } from './guestNav.js';
import { EXTENSION_AUTH_CLICK_BRIDGE_JS } from './extensionAuthClickBridge.js';
import { createAuthTab, removeAuthTab } from './extensionAuthTabs.js';
import {
  PRELOAD_FRAME_ID,
  TABS_CREATE_CHANNEL,
  TABS_REMOVE_CHANNEL,
  planPreloadRegistration,
  isExtensionServiceWorkerScope,
} from './extensionPreloadWire.js';

export { EXTENSION_AUTH_CLICK_BRIDGE_JS } from './extensionAuthClickBridge.js';
export {
  PRELOAD_FRAME_ID,
  PRELOAD_SW_ID,
  PRELOAD_GUEST_AUTH_ID,
  TABS_CREATE_CHANNEL,
  TABS_REMOVE_CHANNEL,
  planPreloadRegistration,
  isExtensionServiceWorkerScope,
} from './extensionPreloadWire.js';

let ipcReady = false;

/** @type {() => (import('electron').BrowserWindow|null|undefined)} */
let mainWindowProvider = () => null;

/** @type {WeakSet<object>} */
const swIpcWiredSessions = new WeakSet();

function sessionFromEvent(event, fallback = null) {
  return event?.session || event?.sender?.session || fallback || null;
}

function tabsCreateHandler(partitionSession) {
  return async (event, details = {}) => {
    if (event?.sender?.isDestroyed?.()) return undefined;
    const session = sessionFromEvent(event, partitionSession);
    const parent =
      typeof mainWindowProvider === 'function' ? mainWindowProvider() : null;
    return createAuthTab(session, details, {
      attachPopupHandler: attachExtensionPopupWindowOpen,
      parent,
    });
  };
}

function tabsRemoveHandler() {
  return async (_event, tabIds) => {
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    for (const id of ids) {
      removeAuthTab(id);
    }
    return undefined;
  };
}

function attachServiceWorkerHandlers(partitionSession, serviceWorker) {
  if (!serviceWorker || serviceWorker.isDestroyed?.()) return;
  for (const channel of [TABS_CREATE_CHANNEL, TABS_REMOVE_CHANNEL]) {
    try {
      serviceWorker.ipc.removeHandler?.(channel);
    } catch {
      // ignore
    }
  }
  try {
    serviceWorker.ipc.handle(
      TABS_CREATE_CHANNEL,
      tabsCreateHandler(partitionSession),
    );
    serviceWorker.ipc.handle(TABS_REMOVE_CHANNEL, tabsRemoveHandler());
  } catch {
    // ignore
  }
}

function wireServiceWorkerIpc(partitionSession) {
  if (!partitionSession?.serviceWorkers) return;
  if (swIpcWiredSessions.has(partitionSession)) return;
  swIpcWiredSessions.add(partitionSession);

  partitionSession.serviceWorkers.on(
    'registration-completed',
    async (_event, { scope }) => {
      if (!isExtensionServiceWorkerScope(scope)) return;
      try {
        const sw =
          await partitionSession.serviceWorkers.startWorkerForScope(scope);
        attachServiceWorkerHandlers(partitionSession, sw);
      } catch {
        // ignore
      }
    },
  );

  const api = partitionSession.extensions;
  if (api && typeof api.on === 'function') {
    api.on('extension-ready', async (_event, extension) => {
      const extId = String(extension?.id || '').trim();
      if (!extId) return;
      const scope = `chrome-extension://${extId}/`;
      try {
        const sw =
          await partitionSession.serviceWorkers.startWorkerForScope(scope);
        attachServiceWorkerHandlers(partitionSession, sw);
      } catch {
        // ignore
      }
    });
  }
}

export function configureExtensionChromeBridge({ getMainWindow } = {}) {
  if (typeof getMainWindow === 'function') {
    mainWindowProvider = getMainWindow;
  }
  if (ipcReady) return;
  ipcReady = true;

  ipcMain.handle(TABS_CREATE_CHANNEL, tabsCreateHandler(null));
  ipcMain.handle(TABS_REMOVE_CHANNEL, tabsRemoveHandler());
}

function allowExtensionPopup(webContents) {
  const parent =
    typeof mainWindowProvider === 'function' ? mainWindowProvider() : null;
  const parentOk = parent && !parent.isDestroyed?.();
  const session = webContents?.session;
  return {
    action: 'allow',
    overrideBrowserWindowOptions: {
      ...(parentOk ? { parent } : {}),
      modal: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      width: 1024,
      height: 720,
      webPreferences: {
        ...(session ? { session } : {}),
        contextIsolation: true,
        sandbox: true,
      },
    },
  };
}

/** Popups opened from extension auth tabs / extension pages. */
export function attachExtensionPopupWindowOpen(webContents) {
  if (!webContents || webContents.isDestroyed?.()) return;
  try {
    webContents.setWindowOpenHandler(({ url }) => {
      const raw = String(url || '');
      if (!raw || raw.startsWith('about:blank')) {
        return allowExtensionPopup(webContents);
      }
      if (raw.startsWith('chrome-extension://')) {
        return allowExtensionPopup(webContents);
      }
      if (raw.startsWith('http') && isExtensionAuthPopupUrl(raw)) {
        return allowExtensionPopup(webContents);
      }
      if (raw.startsWith('http')) return allowExtensionPopup(webContents);
      if (raw.startsWith('blob:') || raw.startsWith('data:')) {
        return allowExtensionPopup(webContents);
      }
      return { action: 'deny' };
    });
  } catch {
    // ignore
  }
}

export function extensionChromePreloadPath() {
  return path.join(__dirname, 'extensionChromePreload.js');
}

export function extensionGuestAuthPreloadPath() {
  return path.join(__dirname, 'extensionGuestAuthPreload.js');
}

function preloadScriptRegisteredOnSession(partitionSession, id) {
  try {
    const scripts = partitionSession.getPreloadScripts?.() || [];
    return scripts.some((entry) => entry?.id === id);
  } catch {
    return false;
  }
}

/**
 * Register extension + guest auth preloads and wire service-worker IPC.
 * Returns true when a new service-worker or guest auth preload was registered.
 */
export function wireExtensionSessionPreload(partitionSession) {
  if (!partitionSession) return false;

  const preloadAbs = extensionChromePreloadPath();
  const guestPreloadAbs = extensionGuestAuthPreloadPath();
  let reloadExtensions = false;

  if (typeof partitionSession.registerPreloadScript === 'function') {
    try {
      const existing = partitionSession.getPreloadScripts?.() || [];
      const plan = planPreloadRegistration(
        existing,
        preloadAbs,
        guestPreloadAbs,
      );
      reloadExtensions = plan.swPreloadNew || plan.guestPreloadNew;
      for (const entry of plan.registrations) {
        partitionSession.registerPreloadScript(entry);
      }
    } catch {
      // fall through to legacy API
    }
  }

  if (
    typeof partitionSession.setPreloads === 'function' &&
    !preloadScriptRegisteredOnSession(partitionSession, PRELOAD_FRAME_ID)
  ) {
    let existing = [];
    try {
      existing = partitionSession.getPreloads?.() || [];
    } catch {
      existing = [];
    }
    if (!existing.includes(preloadAbs)) {
      partitionSession.setPreloads([...existing, preloadAbs]);
    }
    if (!existing.includes(guestPreloadAbs)) {
      partitionSession.setPreloads([
        ...partitionSession.getPreloads?.(),
        guestPreloadAbs,
      ]);
      reloadExtensions = true;
    }
  }

  wireServiceWorkerIpc(partitionSession);
  return reloadExtensions;
}

export function attachExtensionAuthClickBridge(_webContents) {
  // Intentionally no-op: intercepting Grammarly Log in / Sign up clicks opens
  // www.grammarly.com and skips extension OAuth. Auth must go through
  // launchAuthFlow → tabs.create → Hub auth tab + redirect relay.
}

export function attachExtensionWebContentsHandlers(webContents) {
  if (!webContents || webContents.isDestroyed?.()) return;
  let url = '';
  try {
    url = String(webContents.getURL() || '');
  } catch {
    url = '';
  }
  if (url.startsWith('chrome-extension://')) {
    attachExtensionPopupWindowOpen(webContents);
    attachExtensionAuthClickBridge(webContents);
  }
}
