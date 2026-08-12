/**
 * Simulated extension auth tabs in the main process.
 * Electron does not fire chrome.tabs.onUpdated for BrowserWindows — we relay
 * navigation events back to extension service workers via guest page bridges
 * and direct service-worker IPC when available.
 */
import { BrowserWindow, webContents } from 'electron';
import { isExtensionOAuthRedirectUrl } from './extensionPreloadWire.js';

export { isExtensionOAuthRedirectUrl } from './extensionPreloadWire.js';

let nextTabId = 900_001;

/** @type {Map<number, { win: BrowserWindow, wc: import('electron').WebContents, session: import('electron').Session, url: string }>} */
const authTabs = new Map();

function tabSnapshot(tabId, wc, url = '') {
  let liveUrl = url;
  try {
    liveUrl = liveUrl || String(wc.getURL() || '');
  } catch {
    liveUrl = url || '';
  }
  return {
    id: tabId,
    index: 0,
    windowId: wc.id,
    active: true,
    pinned: false,
    audible: false,
    discarded: false,
    autoDiscardable: true,
    highlighted: true,
    incognito: false,
    url: liveUrl || 'about:blank',
    title: '',
    status: liveUrl ? 'loading' : 'complete',
  };
}

function broadcastToSession(session, channel, payload) {
  if (!session) return;
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed?.()) continue;
    try {
      if (wc.session !== session) continue;
      wc.send(channel, payload);
    } catch {
      // ignore
    }
  }
}

async function notifyServiceWorkers(session, payload) {
  if (!session?.serviceWorkers || !session.extensions) return;
  let extensions = [];
  try {
    extensions = session.extensions.getAllExtensions?.() || [];
  } catch {
    extensions = [];
  }
  for (const ext of extensions) {
    const id = String(ext?.id || '').trim();
    if (!id) continue;
    try {
      const sw = await session.serviceWorkers.startWorkerForScope(
        `chrome-extension://${id}/`,
      );
      sw?.send?.('aspera-ext:tab-event', payload);
    } catch {
      // ignore
    }
  }
}

function emitTabUpdated(session, tabId, changeInfo, tab) {
  const payload = {
    __asperaHub: 'tab-updated',
    tabId,
    changeInfo,
    tab,
  };
  broadcastToSession(session, 'aspera-ext:tab-updated', payload);
  notifyServiceWorkers(session, payload).catch(() => {});
}

function emitTabRemoved(session, tabId, removeInfo = {}) {
  const payload = {
    __asperaHub: 'tab-removed',
    tabId,
    removeInfo,
  };
  broadcastToSession(session, 'aspera-ext:tab-removed', payload);
  notifyServiceWorkers(session, payload).catch(() => {});
}

function attachAuthTabListeners(tabId, entry) {
  const { win, wc, session } = entry;
  let redirectHandled = false;

  const notify = (changeInfo) => {
    if (!authTabs.has(tabId)) return;
    const snap = tabSnapshot(tabId, wc, changeInfo.url || entry.url);
    emitTabUpdated(session, tabId, changeInfo, snap);
  };

  const handlePossibleRedirect = (url, event) => {
    if (!isExtensionOAuthRedirectUrl(url) || redirectHandled) return false;
    redirectHandled = true;
    entry.url = url;
    try {
      event?.preventDefault?.();
    } catch {
      // ignore
    }
    notify({ url, status: 'complete' });
    // Give the extension a moment to exchange the code, then close.
    setTimeout(() => {
      try {
        if (!win.isDestroyed()) win.close();
      } catch {
        // ignore
      }
    }, 750);
    return true;
  };

  wc.on('will-redirect', (event, url) => {
    handlePossibleRedirect(url, event);
  });
  wc.on('will-navigate', (event, url) => {
    handlePossibleRedirect(url, event);
  });
  wc.on('did-navigate', (_event, url) => {
    entry.url = url;
    if (handlePossibleRedirect(url)) return;
    notify({ url, status: 'loading' });
  });
  wc.on('did-navigate-in-page', (_event, url) => {
    entry.url = url;
    if (handlePossibleRedirect(url)) return;
    notify({ url });
  });
  wc.on('did-finish-load', () => {
    let url = entry.url;
    try {
      url = String(wc.getURL() || url);
    } catch {
      // ignore
    }
    if (handlePossibleRedirect(url)) return;
    notify({ status: 'complete', url });
  });
  wc.on('page-title-updated', (_event, title) => {
    notify({ title });
  });

  win.on('closed', () => {
    authTabs.delete(tabId);
    emitTabRemoved(session, tabId, { windowClosing: true });
  });
}

export function removeAuthTab(tabId) {
  const id = Number(tabId);
  const entry = authTabs.get(id);
  if (!entry) return false;
  authTabs.delete(id);
  try {
    if (!entry.win.isDestroyed()) entry.win.close();
  } catch {
    // ignore
  }
  return true;
}

/**
 * Watch an already-created popup (e.g. window.open fallback) for OAuth redirects.
 * Returns the synthetic tab id used in extension onUpdated events.
 */
export function adoptAuthPopupWebContents(wc, session, startUrl = '') {
  if (!wc || wc.isDestroyed?.()) return null;
  for (const [id, entry] of authTabs.entries()) {
    if (entry.wc === wc) return id;
  }
  const tabId = nextTabId++;
  let win = null;
  try {
    win = BrowserWindow.fromWebContents(wc);
  } catch {
    win = null;
  }
  const entry = {
    win: win || {
      isDestroyed: () => wc.isDestroyed?.() || false,
      close: () => {
        try {
          wc.close?.();
        } catch {
          // ignore
        }
      },
    },
    wc,
    session: session || wc.session,
    url: String(startUrl || ''),
  };
  authTabs.set(tabId, entry);
  attachAuthTabListeners(tabId, entry);
  if (entry.url) {
    emitTabUpdated(entry.session, tabId, { url: entry.url, status: 'loading' }, tabSnapshot(tabId, wc, entry.url));
  }
  return tabId;
}

export function createAuthTab(session, details = {}, { attachPopupHandler, parent } = {}) {
  const url = String(details?.url || '').trim();
  const tabId = nextTabId++;
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
  const wc = win.webContents;
  if (typeof attachPopupHandler === 'function') {
    attachPopupHandler(wc);
  }

  const entry = { win, wc, session, url };
  authTabs.set(tabId, entry);
  attachAuthTabListeners(tabId, entry);

  if (url) {
    wc.loadURL(url).catch(() => {});
  }

  return tabSnapshot(tabId, wc, url);
}

export function resetAuthTabsForTests() {
  authTabs.clear();
  nextTabId = 900_001;
}
