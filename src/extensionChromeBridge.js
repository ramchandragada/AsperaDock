/**
 * Minimal chrome.tabs.create bridge for extension auth (Grammarly sign-in, etc.).
 * Electron supports only part of the tabs API — extensions that call tabs.create
 * from MV3 service workers otherwise fail silently.
 */
import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { isExtensionAuthPopupUrl } from './guestNav.js';
import { EXTENSION_AUTH_CLICK_BRIDGE_JS } from './extensionAuthClickBridge.js';
import {
  PRELOAD_FRAME_ID,
  TABS_CREATE_CHANNEL,
  planPreloadRegistration,
  isExtensionServiceWorkerScope,
} from './extensionPreloadWire.js';

export { EXTENSION_AUTH_CLICK_BRIDGE_JS } from './extensionAuthClickBridge.js';
export {
  PRELOAD_FRAME_ID,
  PRELOAD_SW_ID,
  TABS_CREATE_CHANNEL,
  planPreloadRegistration,
  isExtensionServiceWorkerScope,
} from './extensionPreloadWire.js';

const TABS_CREATE_CHANNEL_LOCAL = TABS_CREATE_CHANNEL;

let ipcReady = false;

/** @type {() => (BrowserWindow|null|undefined)} */
let mainWindowProvider = () => null;

/** @type {WeakSet<object>} */
const wiredSessions = new WeakSet();

/** @type {WeakSet<object>} */
const swIpcWiredSessions = new WeakSet();

function extensionSession(partitionSession) {
  return partitionSession || null;
}

async function openExtensionAuthTab(partitionSession, details = {}) {
  const session = extensionSession(partitionSession);
  const url = String(details?.url || '').trim();
  const parent =
    typeof mainWindowProvider === 'function' ? mainWindowProvider() : null;
  const parentOk = parent && !parent.isDestroyed?.();

  const win = new BrowserWindow({
    ...(parentOk ? { parent } : {}),
    modal: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    show: true,
    width: 1024,
    height: 720,
    webPreferences: {
      ...(session ? { session } : {}),
      contextIsolation: true,
      sandbox: true,
    },
  });

  attachExtensionPopupWindowOpen(win.webContents);

  if (url) {
    try {
      await win.webContents.loadURL(url);
    } catch {
      // OAuth may still proceed if the popup stays open.
    }
  }

  return {
    id: win.webContents.id,
    windowId: win.id,
    index: 0,
    active: details?.active !== false,
    pinned: false,
    audible: false,
    discarded: false,
    autoDiscardable: true,
    highlighted: true,
    incognito: false,
    url: url || 'about:blank',
    title: '',
    status: url ? 'loading' : 'complete',
  };
}

function tabsCreateHandler(partitionSession) {
  return async (event, details = {}) => {
    const session =
      event?.session || event?.sender?.session || partitionSession || null;
    if (event?.sender?.isDestroyed?.()) {
      return undefined;
    }
    return openExtensionAuthTab(session, details);
  };
}

function attachServiceWorkerTabsCreateHandler(partitionSession, serviceWorker) {
  if (!serviceWorker || serviceWorker.isDestroyed?.()) return;
  try {
    serviceWorker.ipc.removeHandler?.(TABS_CREATE_CHANNEL_LOCAL);
  } catch {
    // ignore
  }
  try {
    serviceWorker.ipc.handle(
      TABS_CREATE_CHANNEL_LOCAL,
      tabsCreateHandler(partitionSession),
    );
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
      const rawScope = String(scope || '');
      if (!isExtensionServiceWorkerScope(rawScope)) return;
      try {
        const sw =
          await partitionSession.serviceWorkers.startWorkerForScope(rawScope);
        attachServiceWorkerTabsCreateHandler(partitionSession, sw);
      } catch {
        // ignore
      }
    },
  );
}

export function configureExtensionChromeBridge({ getMainWindow } = {}) {
  if (typeof getMainWindow === 'function') {
    mainWindowProvider = getMainWindow;
  }
  if (ipcReady) return;
  ipcReady = true;

  ipcMain.handle(TABS_CREATE_CHANNEL_LOCAL, tabsCreateHandler(null));
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

function preloadScriptRegisteredOnSession(partitionSession, id) {
  try {
    const scripts = partitionSession.getPreloadScripts?.() || [];
    return scripts.some((entry) => entry?.id === id);
  } catch {
    return false;
  }
}

/** Attach session preload once per guest partition (extension sign-in bridge). */
export function wireExtensionSessionPreload(partitionSession) {
  if (!partitionSession) return false;

  const preloadAbs = extensionChromePreloadPath();
  let swPreloadNew = false;

  if (typeof partitionSession.registerPreloadScript === 'function') {
    try {
      const existing = partitionSession.getPreloadScripts?.() || [];
      const plan = planPreloadRegistration(existing, preloadAbs);
      swPreloadNew = plan.swPreloadNew;
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
  }

  wireServiceWorkerIpc(partitionSession);
  wiredSessions.add(partitionSession);
  return swPreloadNew;
}

export function attachExtensionAuthClickBridge(webContents) {
  if (!webContents || webContents.isDestroyed?.()) return;
  const inject = () => {
    if (webContents.isDestroyed()) return;
    webContents.executeJavaScript(EXTENSION_AUTH_CLICK_BRIDGE_JS, true).catch(() => {});
  };
  webContents.on('did-finish-load', inject);
  webContents.on('dom-ready', inject);
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
