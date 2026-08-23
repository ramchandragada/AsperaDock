/**
 * Guest window-open + navigation gates (Phase 3 extract from main.js).
 * Behavior-preserving: callers inject Hub-specific helpers via `api`.
 */
import {
  isInternalUrl,
  isForbiddenGuestNavigation,
  isAuthOrLoginUrl,
  extractGoogleOutboundUrl,
  linkTabWindowOpenAction,
  isGoogleOwnedUrl,
  mustKeepGoogleUrlInApp,
  isAllowedGmailTabUrl,
  isSameEcosystemUrl,
  isGoogleOauthClientUrl,
  shouldOpenZohoSharedDeepLinkAsHubTab,
  isMessagingAppId,
  isAllowedMessagingTabUrl,
  gmailWindowOpenAction,
  isExtensionAuthPopupUrl,
} from './guestNav.js';

/**
 * @typedef {object} GuestNavigationApi
 * @property {(service: object) => object} liveService
 * @property {(service: object) => boolean} isGoogleService
 * @property {(service: object) => string} startUrlForService
 * @property {(service: object, url: string, wc: Electron.WebContents) => boolean} handleOutboundOrNewWindowLink
 * @property {(service: object) => object} guestWebPreferences
 * @property {(service: object, url: string) => boolean} [tryOpenZohoSharedHubTab]
 * @property {() => (Electron.BrowserWindow|null|undefined)} [getMainWindow]
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
    tryOpenZohoSharedHubTab,
    getMainWindow,
  } = api;

  const allowPopup = () => {
    const parent =
      typeof getMainWindow === 'function' ? getMainWindow() : null;
    const parentOk = parent && !parent.isDestroyed?.();
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        // Keep SSO/auth popups off the Linux taskbar so they do not look like
        // extra Aspera Hub instances. Parent ties them to the shell window.
        ...(parentOk ? { parent } : {}),
        modal: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        width: 1024,
        height: 720,
        webPreferences: guestWebPreferences(service),
      },
    };
  };

  wc.setWindowOpenHandler(({ url }) => {
    const raw = String(url || '');
    const live = liveService(service);
    if (!raw || raw === 'about:blank' || raw.startsWith('about:blank')) {
      return allowPopup();
    }

    // Chrome extensions (Grammarly login pages, options, etc.) — never deny.
    if (raw.startsWith('chrome-extension://')) {
      return allowPopup();
    }

    // Extension vendor OAuth / sign-in — real popup in every app (incl. WhatsApp).
    if (isExtensionAuthPopupUrl(raw)) {
      return allowPopup();
    }

    if (raw.startsWith('http')) {
      // Temporary Hub link tabs (Web Search / WhatsApp → Canva, etc.): keep
      // browsing in this tab. Real popups only for IdP / Google auth.
      // Google /url search wrappers unwrap to the destination in-tab.
      if (live?.isCustom || live?.linkTab) {
        const action = linkTabWindowOpenAction(raw);
        if (action === 'popup') {
          return allowPopup();
        }
        const target = extractGoogleOutboundUrl(raw) || raw;
        wc.loadURL(target).catch(() => {});
        return { action: 'deny' };
      }

      // WhatsApp / Arattai: any outbound click → new Hub tab (never replace chat).
      if (isMessagingAppId(live?.appId) && !isAllowedMessagingTabUrl(live, raw)) {
        handleOutboundOrNewWindowLink(live, raw, wc, { allowHubTab: true });
        return { action: 'deny' };
      }

      // Gmail: email links → Hub tab. Only OAuth/SSO stays a floating popup.
      // (about:blank is allowed above; attachGmailPopupAdopt folds it later.)
      if (isGoogleService(live)) {
        const action = gmailWindowOpenAction(raw);
        if (action === 'oauth-popup') {
          return allowPopup();
        }
        if (action === 'hub-tab') {
          const target = extractGoogleOutboundUrl(raw) || raw;
          handleOutboundOrNewWindowLink(live, target, wc, { allowHubTab: true });
          return { action: 'deny' };
        }
        return { action: 'deny' };
      }

      // Catalog apps: same-ecosystem window.opens stay in-app (or auth popup).
      // Zoho CRM/Books/One deep links are an exception — open as shared Hub tabs.
      if (!(live?.isCustom || live?.linkTab) && isSameEcosystemUrl(live, raw)) {
        if (
          isGoogleOauthClientUrl(raw) ||
          (isAuthOrLoginUrl(raw) && isGoogleOwnedUrl(raw)) ||
          mustKeepGoogleUrlInApp(raw)
        ) {
          return allowPopup();
        }
        try {
          const cur = String(wc.getURL() || '');
          if (cur.split('#')[0] === raw.split('#')[0]) {
            return { action: 'deny' };
          }
        } catch {
          // ignore
        }
        if (
          typeof tryOpenZohoSharedHubTab === 'function' &&
          shouldOpenZohoSharedDeepLinkAsHubTab(live, raw) &&
          tryOpenZohoSharedHubTab(live, raw)
        ) {
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

    // WhatsApp / Arattai: never leave the messenger for Drive/Docs/Google login.
    // Open the destination as a Hub tab (same policy for both apps).
    if (isMessagingAppId(live?.appId)) {
      if (isAllowedMessagingTabUrl(live, url)) return;
      event.preventDefault();
      handleOutboundOrNewWindowLink(live, url, webContents, { allowHubTab: true });
      return;
    }

    if (isGoogleService(live)) {
      const outbound = extractGoogleOutboundUrl(url);
      if (outbound) {
        event.preventDefault();
        if (
          isGoogleOauthClientUrl(outbound) ||
          mustKeepGoogleUrlInApp(outbound) ||
          isGoogleOwnedUrl(outbound)
        ) {
          const action = gmailWindowOpenAction(outbound);
          if (action === 'hub-tab') {
            handleOutboundOrNewWindowLink(live, outbound, webContents, {
              allowHubTab: true,
            });
            return;
          }
          // OAuth/SSO: keep Gmail on current page; popup handler covers auth.
          if (isAllowedGmailTabUrl(outbound) && !isGoogleOauthClientUrl(outbound)) {
            webContents.loadURL(outbound).catch(() => {});
          }
          return;
        }
        handleOutboundOrNewWindowLink(live, outbound, webContents, {
          allowHubTab: true,
        });
        return;
      }
      if (isGoogleOauthClientUrl(url) || (isGoogleOwnedUrl(url) && !isAllowedGmailTabUrl(url))) {
        event.preventDefault();
        const action = gmailWindowOpenAction(url);
        if (action === 'hub-tab') {
          handleOutboundOrNewWindowLink(live, url, webContents, {
            allowHubTab: true,
          });
        }
        // OAuth: don't replace Gmail; popup handler covers client hosts.
        return;
      }
      if (!isAllowedGmailTabUrl(url)) {
        event.preventDefault();
        handleOutboundOrNewWindowLink(live, url, webContents, {
          allowHubTab: true,
        });
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
      // Messaging iframes: only first-party hosts; never promote Drive into chat.
      if (isMessagingAppId(live?.appId)) {
        if (isAllowedMessagingTabUrl(live, url)) return;
        if (typeof details.preventDefault === 'function') details.preventDefault();
        handleOutboundOrNewWindowLink(live, url, webContents, { allowHubTab: true });
        return;
      }
      // Zoho SPAs load many cross-origin iframes (CDN, widgets). Never promote
      // those into Hub tabs or the main frame — that blank/reload-loops Books.
      if (
        live?.appId === 'zoho-books' ||
        live?.appId === 'zoho-crm' ||
        live?.appId === 'zoho-workdrive' ||
        live?.appId === 'zoho-one' ||
        live?.appId === 'zoho-mail'
      ) {
        return;
      }
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
      // Never spawn Hub link tabs from a completed main-frame navigation —
      // that left blank Gmail-branded tabs. Reclaim inbox only.
      if (home && home.split('#')[0] !== String(url).split('#')[0]) {
        webContents.loadURL(home).catch(() => {});
      }
      return;
    }

    // WhatsApp / Arattai: if Drive/Google somehow loaded, reclaim messenger + Hub-tab.
    if (isMessagingAppId(live?.appId)) {
      if (isAllowedMessagingTabUrl(live, url)) return;
      const home = startUrlForService(live) || live.url;
      handleOutboundOrNewWindowLink(live, url, webContents, { allowHubTab: true });
      if (home && home.split('#')[0] !== String(url).split('#')[0]) {
        webContents.loadURL(home).catch(() => {});
      }
      return;
    }

    if (isInternalUrl(url, live)) return;
    if (isAuthOrLoginUrl(url) && isGoogleOwnedUrl(url)) return;
    if (mustKeepGoogleUrlInApp(url)) return;
    const home = startUrlForService(live) || live.url;
    // Catalog apps: if we somehow left the app, reclaim home — never Hub-tab.
    if (!(live?.isCustom || live?.linkTab)) {
      if (home && home.split('#')[0] !== String(url).split('#')[0]) {
        webContents.loadURL(home).catch(() => {});
      }
      return;
    }
    handleOutboundOrNewWindowLink(live, url, webContents);
    if (home && home !== url) webContents.loadURL(home).catch(() => {});
  });
}
