/**
 * Guest window-open + navigation gates (Phase 3 extract from main.js).
 * Behavior-preserving: callers inject Hub-specific helpers via `api`.
 */
import {
  isInternalUrl,
  isForbiddenGuestNavigation,
  isAuthOrLoginUrl,
  extractGoogleOutboundUrl,
  isGoogleOwnedUrl,
  mustKeepGoogleUrlInApp,
  isAllowedGmailTabUrl,
} from './guestNav.js';

/**
 * @typedef {object} GuestNavigationApi
 * @property {(service: object) => object} liveService
 * @property {(service: object) => boolean} isGoogleService
 * @property {(service: object) => string} startUrlForService
 * @property {(service: object, url: string, wc: Electron.WebContents) => boolean} handleOutboundOrNewWindowLink
 * @property {(service: object) => object} guestWebPreferences
 */

/**
 * @param {Electron.WebContents} wc
 * @param {object} service
 * @param {GuestNavigationApi} api
 */
export function configureGuestWindowOpen(wc, service, api) {
  const {
    liveService,
    isGoogleService,
    startUrlForService,
    handleOutboundOrNewWindowLink,
    guestWebPreferences,
  } = api;

  const allowPopup = () => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      autoHideMenuBar: true,
      width: 1024,
      height: 720,
      webPreferences: guestWebPreferences(service),
    },
  });

  wc.setWindowOpenHandler(({ url }) => {
    const raw = String(url || '');
    const live = liveService(service);
    if (!raw || raw === 'about:blank' || raw.startsWith('about:blank')) {
      return allowPopup();
    }

    if (raw.startsWith('http')) {
      // Temporary Hub link tabs (WhatsApp/Arattai → Canva, etc.): never spawn
      // another top-bar tab for login/redirects. Keep browsing in this tab,
      // except Google auth popups which need a real window.
      if (live?.isCustom || live?.linkTab) {
        if (isAuthOrLoginUrl(raw) && isGoogleOwnedUrl(raw)) {
          return allowPopup();
        }
        if (mustKeepGoogleUrlInApp(raw)) {
          return allowPopup();
        }
        wc.loadURL(raw).catch(() => {});
        return { action: 'deny' };
      }

      // Zoho Books should always stay in one app tab.
      if (live?.appId === 'zoho-books') {
        if ((isAuthOrLoginUrl(raw) && isGoogleOwnedUrl(raw)) || mustKeepGoogleUrlInApp(raw)) {
          return allowPopup();
        }
        wc.loadURL(raw).catch(() => {});
        return { action: 'deny' };
      }

      if (isGoogleService(live)) {
        const outbound = extractGoogleOutboundUrl(raw);
        if (outbound) {
          if (mustKeepGoogleUrlInApp(outbound) || isGoogleOwnedUrl(outbound)) {
            wc.loadURL(outbound).catch(() => {});
            return { action: 'deny' };
          }
          handleOutboundOrNewWindowLink(live, outbound, wc);
          return { action: 'deny' };
        }
        if (isGoogleOwnedUrl(raw) && !isAllowedGmailTabUrl(raw)) {
          wc.loadURL(startUrlForService(live) || live.url).catch(() => {});
          return { action: 'deny' };
        }
        if (!isAllowedGmailTabUrl(raw)) {
          handleOutboundOrNewWindowLink(live, raw, wc);
          return { action: 'deny' };
        }
        wc.loadURL(raw).catch(() => {});
        return { action: 'deny' };
      }

      if (isAuthOrLoginUrl(raw) && isGoogleOwnedUrl(raw)) {
        return allowPopup();
      }
      if (mustKeepGoogleUrlInApp(raw)) {
        return allowPopup();
      }

      if (handleOutboundOrNewWindowLink(live, raw, wc)) {
        return { action: 'deny' };
      }

      return allowPopup();
    }

    if (raw.startsWith('blob:') || raw.startsWith('data:')) {
      return allowPopup();
    }

    return { action: 'deny' };
  });
}

/**
 * @param {Electron.WebContents} webContents
 * @param {object} service
 * @param {GuestNavigationApi} api
 */
export function attachGuestNavigationGate(webContents, service, api) {
  const {
    liveService,
    isGoogleService,
    startUrlForService,
    handleOutboundOrNewWindowLink,
  } = api;

  const gate = (event, url) => {
    if (isForbiddenGuestNavigation(url)) {
      event.preventDefault();
      return;
    }
    if (!String(url || '').startsWith('http')) return;

    const live = liveService(service);
    if (live?.isCustom || live?.linkTab) return;

    if (isGoogleService(live)) {
      const outbound = extractGoogleOutboundUrl(url);
      if (outbound) {
        event.preventDefault();
        if (mustKeepGoogleUrlInApp(outbound) || isGoogleOwnedUrl(outbound)) {
          webContents.loadURL(outbound).catch(() => {});
          return;
        }
        handleOutboundOrNewWindowLink(live, outbound, webContents);
        return;
      }
      if (isGoogleOwnedUrl(url) && !isAllowedGmailTabUrl(url)) {
        event.preventDefault();
        webContents.loadURL(startUrlForService(live) || live.url).catch(() => {});
        return;
      }
      if (!isAllowedGmailTabUrl(url)) {
        event.preventDefault();
        handleOutboundOrNewWindowLink(live, url, webContents);
        return;
      }
      return;
    }

    if (isAuthOrLoginUrl(url) && isGoogleOwnedUrl(url)) return;
    if (mustKeepGoogleUrlInApp(url)) return;

    if (isInternalUrl(url, live)) return;
    event.preventDefault();
    if (isGoogleOwnedUrl(url)) return;
    handleOutboundOrNewWindowLink(live, url, webContents);
  };

  webContents.on('will-navigate', gate);
  webContents.on('will-redirect', gate);

  webContents.on('will-frame-navigate', (details) => {
    try {
      const url = String(details?.url || '');
      if (!url.startsWith('http')) return;
      if (details.isMainFrame) return;
      const live = liveService(service);
      if (live?.isCustom || live?.linkTab) return;
      if (isGoogleService(live)) return;
      if (isInternalUrl(url, live)) return;
      if (isAuthOrLoginUrl(url) && isGoogleOwnedUrl(url)) return;
      if (mustKeepGoogleUrlInApp(url)) return;
      if (typeof details.preventDefault === 'function') details.preventDefault();
      handleOutboundOrNewWindowLink(live, url, webContents);
    } catch {
      // ignore
    }
  });

  webContents.on('did-navigate', (_event, url) => {
    const live = liveService(service);
    if (!url || !String(url).startsWith('http')) return;
    if (live?.isCustom || live?.linkTab) return;

    if (isGoogleService(live)) {
      if (isAllowedGmailTabUrl(url)) return;
      const home = startUrlForService(live) || live.url;
      const outbound = extractGoogleOutboundUrl(url);
      if (outbound) {
        if (mustKeepGoogleUrlInApp(outbound) || isGoogleOwnedUrl(outbound)) {
          webContents.loadURL(outbound).catch(() => {});
          return;
        }
        handleOutboundOrNewWindowLink(live, outbound, webContents);
        webContents.loadURL(home).catch(() => {});
        return;
      }
      if (isGoogleOwnedUrl(url)) {
        webContents.loadURL(home).catch(() => {});
        return;
      }
      handleOutboundOrNewWindowLink(live, url, webContents);
      webContents.loadURL(home).catch(() => {});
      return;
    }

    if (isInternalUrl(url, live)) return;
    if (isAuthOrLoginUrl(url) && isGoogleOwnedUrl(url)) return;
    if (mustKeepGoogleUrlInApp(url)) return;
    const home = startUrlForService(live) || live.url;
    handleOutboundOrNewWindowLink(live, url, webContents);
    if (home && home !== url) webContents.loadURL(home).catch(() => {});
  });
}
