import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULTS = {
  // Layout (Top or Left only)
  appsPosition: 'top',
  hideAppLabels: false,
  density: 'comfortable', // compact | normal | comfortable
  theme: 'system', // system | light | dark | darkest | glossy | mint
  autoHideMenuBar: true,
  /** Let the app bar grow to a second row instead of scrolling. */
  wrapAppTabs: true,

  // Behaviour
  focusMode: false,
  muted: false,
  focusClearsBadges: false,
  showActiveInTitle: false,
  hideNotificationContent: false,

  // Downloads
  downloadPath: '',
  openFolderOnDownload: true,
  openFileOnDownload: false,

  // Startup & window
  autoStart: false,
  displayBehaviour: 'taskbar', // taskbar | tray | both
  closeBehaviour: 'quit', // quit | tray
  alwaysOnTop: false,
  trayUnreadIndicator: true,
  flashTaskbar: false,
  confirmQuit: false,

  // Security
  lockEnabled: false,
  lockPasswordHash: '',

  // Compatibility (needs relaunch)
  hardwareAcceleration: true,
  hiDpiSupport: true,
  mediaKeys: true,

  // Proxy (applies to every app session)
  proxyMode: 'none', // none | system | manual
  proxyRules: '',
  proxyBypass: '<local>',

  /** Lock the dock when the OS locks or suspends (needs Lock app enabled). */
  lockOnSystemIdle: false,
  /** Sample per-app memory usage for the resource monitor. */
  consumptionMonitor: false,

  // Defaults for apps (overridden per-app via right-click Edit)
  linkHandling: 'block', // block | external
  spellChecker: ['en-US'],
  hibernateMinutes: 5,
  maxWarmViews: 3,

  /** Toggleable global shortcuts */
  shortcuts: {
    switchTab: true,
    nextTab: true,
    focusMode: true,
    mute: true,
    hibernate: true,
    lock: true,
    settings: true,
    search: true,
    backForward: true,
  },

  // Session
  lastActiveServiceId: null,
  serviceOrder: [],
  /**
   * User-added app instances. Empty by default — user adds from the catalog.
   * @type {{ id: string, appId: string, partition: string, slot: number }[]}
   */
  serviceInstances: [],
  /** @type {Record<string, { name?: string, title?: string }>} */
  serviceLabels: {},
  /** @type {Record<string, object>} */
  serviceConfigs: {},
};

let cache = null;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = {
      ...DEFAULTS,
      ...parsed,
      shortcuts: { ...DEFAULTS.shortcuts, ...(parsed.shortcuts || {}) },
      serviceLabels: parsed.serviceLabels || {},
      serviceConfigs: parsed.serviceConfigs || {},
      serviceInstances: parsed.serviceInstances || [],
    };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function saveSettings(patch) {
  cache = { ...loadSettings(), ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // ignore write failures
  }
  return cache;
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export function verifyPassword(password, hash) {
  if (!hash) return false;
  return hashPassword(password) === hash;
}
