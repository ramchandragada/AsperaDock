/**
 * Minimal chrome.tabs.create bridge for extension auth (Grammarly sign-in, etc.).
 * Electron supports only part of the tabs API — extensions that call tabs.create
 * otherwise fail silently.
 */
import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { app } from 'electron';
import { isExtensionAuthPopupUrl } from './guestNav.js';
import { EXTENSION_AUTH_CLICK_BRIDGE_JS } from './extensionAuthClickBridge.js';

export { EXTENSION_AUTH_CLICK_BRIDGE_JS } from './extensionAuthClickBridge.js';

let ipcReady = false;

/** @type {() => (BrowserWindow|null|undefined)} */
let mainWindowProvider = () => null;

export function configureExtensionChromeBridge({ getMainWindow } = {}) {
  if (typeof getMainWindow === 'function') {
    mainWindowProvider = getMainWindow;
  }
  if (ipcReady) return;
  ipcReady = true;

  ipcMain.handle('aspera-ext:tabs-create', async (event, details = {}) => {
    const sender = event.sender;
    if (!sender || sender.isDestroyed?.()) {
      return undefined;
    }
    const url = String(details?.url || '').trim();
    const session = sender.session;
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
        session,
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
  });
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

/** Attach session preload once per guest partition (extension sign-in bridge). */
export function wireExtensionSessionPreload(partitionSession) {
  if (!partitionSession || typeof partitionSession.setPreloads !== 'function') {
    return;
  }
  const preloadAbs = extensionChromePreloadPath();
  let existing = [];
  try {
    existing = partitionSession.getPreloads?.() || [];
  } catch {
    existing = [];
  }
  if (existing.includes(preloadAbs)) return;
  partitionSession.setPreloads([...existing, preloadAbs]);
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
