/**
 * Google / Gmail vendor quarantine.
 *
 * WHY: Google blocks "insecure browsers" and OAuth popups; we spoof Chrome UA-CH
 * and soften accounts.google.com with a Firefox UA. This is brittle — Google can
 * change checks anytime.
 *
 * LAST APPROACH: executeJavaScript spoof (no CDP) + webRequest Client Hints.
 * Kill switch: settings.googleSpoofEnabled === false (or edit settings.json).
 */
import { logBreadcrumb } from '../errorReporter.js';
import { applyGoogleRequestHeaders } from './googleHeaders.js';

export { applyGoogleRequestHeaders } from './googleHeaders.js';

const marketingNoted = new Set();

export function isGoogleService(service) {
  if (!service) return false;
  if (service.appId === 'gmail') return true;
  try {
    const host = new URL(service.url).hostname.toLowerCase();
    return (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'gmail.com' ||
      host.endsWith('.gmail.com')
    );
  } catch {
    return false;
  }
}

export function isGoogleMailAppUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === 'mail.google.com' ||
      host.endsWith('.mail.google.com') ||
      host === 'inbox.google.com'
    );
  } catch {
    return false;
  }
}

/** Public Gmail marketing / create-account landing (not the inbox). */
export function isGoogleMarketingLanding(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'mail.google.com' || host.endsWith('.mail.google.com')) {
      return false;
    }
    if (host === 'www.google.com' || host === 'google.com') {
      return /gmail/i.test(u.pathname);
    }
    if (host === 'workspace.google.com' || host.endsWith('.google.com')) {
      return /gmail|create.?account/i.test(`${u.pathname}${u.search}`);
    }
    return false;
  } catch {
    return false;
  }
}

export function noteGoogleMarketingLanding(serviceId, url) {
  if (!isGoogleMarketingLanding(url)) return;
  const key = String(serviceId || 'google');
  if (marketingNoted.has(key)) return;
  marketingNoted.add(key);
  logBreadcrumb('google-marketing-landing', {
    serviceId: key,
    url: String(url || '').slice(0, 200),
  });
}

export function buildGoogleChromeSpoofSource(chromeVersion, chromeMajor) {
  const full = chromeVersion;
  const major = chromeMajor;
  return `(() => {
  try {
    const full = ${JSON.stringify(full)};
    const major = ${JSON.stringify(major)};
    const brands = [
      { brand: 'Chromium', version: major },
      { brand: 'Google Chrome', version: major },
      { brand: 'Not_A Brand', version: '24' },
    ];
    const fullVersionList = [
      { brand: 'Chromium', version: full },
      { brand: 'Google Chrome', version: full },
      { brand: 'Not_A Brand', version: '24.0.0.0' },
    ];
    const high = {
      architecture: 'x86', bitness: '64', brands, fullVersionList,
      mobile: false, model: '', platform: 'Linux', platformVersion: '6.8.0',
      uaFullVersion: full, wow64: false,
    };
    const uaData = {
      brands, mobile: false, platform: 'Linux',
      getHighEntropyValues: () => Promise.resolve(high),
      toJSON: () => ({ brands, mobile: false, platform: 'Linux' }),
    };
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => uaData, configurable: true,
    });
    const t = Date.now() / 1000;
    const chrome = window.chrome || {};
    chrome.app = chrome.app || {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
    };
    chrome.runtime = chrome.runtime || {
      OnInstalledReason: {}, OnRestartRequiredReason: {}, PlatformArch: {}, PlatformOs: {},
      connect() {}, sendMessage() {},
    };
    chrome.loadTimes = chrome.loadTimes || function () {
      return {
        requestTime: t, startLoadTime: t, commitLoadTime: t,
        finishDocumentLoadTime: t, finishLoadTime: t, firstPaintTime: t,
        firstPaintAfterLoadTime: 0, navigationType: 'Other',
        wasFetchedViaSpdy: true, wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
      };
    };
    chrome.csi = chrome.csi || function () {
      return { startE: Date.now(), onloadT: Date.now(), pageT: 1000, tran: 15 };
    };
    window.chrome = chrome;
  } catch (e) {}
})();`;
}

/**
 * Attach lightweight page-world spoof. No CDP (Linux flicker).
 * No-op when enabled === false.
 */
export async function attachGoogleChromeSpoof(wc, { chromeVersion, chromeMajor, enabled = true } = {}) {
  if (!enabled || !wc || wc.isDestroyed() || wc.__asperaGoogleSpoof) return;
  wc.__asperaGoogleSpoof = true;
  const source = buildGoogleChromeSpoofSource(
    chromeVersion || '138.0.0.0',
    chromeMajor || '138',
  );
  const inject = () => {
    if (wc.isDestroyed()) return;
    wc.executeJavaScript(source, true).catch(() => {});
  };
  wc.on('dom-ready', inject);
  wc.on('did-finish-load', inject);
}
