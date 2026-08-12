/**
 * Simulated extension auth tabs in the main process.
 * Electron does not fire chrome.tabs.onUpdated for BrowserWindows — we relay
 * navigation events back to extension service workers via guest page bridges.
 */
import { BrowserWindow, webContents } from 'electron';

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

function emitTabUpdated(session, tabId, changeInfo, tab) {
  broadcastToSession(session, 'aspera-ext:tab-updated', {
    __asperaHub: 'tab-updated',
    tabId,
    changeInfo,
    tab,
  });
}

function emitTabRemoved(session, tabId, removeInfo = {}) {
  broadcastToSession(session, 'aspera-ext:tab-removed', {
    __asperaHub: 'tab-removed',
    tabId,
    removeInfo,
  });
}

function attachAuthTabListeners(tabId, entry) {
  const { win, wc, session } = entry;
  const notify = (changeInfo) => {
    if (!authTabs.has(tabId)) return;
    emitTabUpdated(session, tabId, changeInfo, tabSnapshot(tabId, wc, changeInfo.url));
  };

  wc.on('did-navigate', (_event, url) => {
    entry.url = url;
    notify({ url, status: 'loading' });
  });
  wc.on('did-navigate-in-page', (_event, url) => {
    entry.url = url;
    notify({ url });
  });
  wc.on('did-finish-load', () => {
    notify({ status: 'complete' });
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

export function createAuthTab(session, details = {}, { attachPopupHandler } = {}) {
  const url = String(details?.url || '').trim();
  const tabId = nextTabId++;
  const win = new BrowserWindow({
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
