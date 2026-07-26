import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getAppCatalogEntry, isKnownAppInstance } from './services.js';

export const PRIMARY_PROFILE_ID = 'primary';

export function makeProfileId() {
  return `p-${crypto.randomBytes(6).toString('hex')}`;
}

export function makeProfile(name, partition) {
  const id = makeProfileId();
  return {
    id,
    name: String(name || 'Profile').trim() || 'Profile',
    partition: partition || `persist:profile-${id}`,
  };
}

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
  /** Off by default — GPU process often costs 100–200 MB on Linux. */
  hardwareAcceleration: false,
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

  /**
   * Auto error / crash / freeze reporting.
   * Preferred: Sentry (paste DSN). Also saves local JSON reports.
   * Fallbacks: GitHub Issues, custom URL, or local-only.
   */
  errorReportingEnabled: true,
  /** sentry | github | url | none */
  errorReportTarget: 'sentry',
  /**
   * Sentry DSN override. Empty = use the built-in Aspera Dock project
   * (zarpat/asperadock) from sentryMain.js. ASPERADOCK_SENTRY_DSN wins over both.
   */
  sentryDsn: '',
  /** Optional override, e.g. owner/asperadock-errors */
  errorReportGithubRepo: '',
  /**
   * Fine-grained PAT with Issues: Write (only if errorReportTarget === 'github').
   * Never commit a real token — use Settings or ASPERADOCK_GITHUB_TOKEN.
   */
  errorReportGithubToken: '',
  /** Custom HTTPS endpoint (used when errorReportTarget === 'url'). */
  errorReportUrl: '',
  errorReportEmail: '',

  /**
   * Seamless self-update via GitHub Releases (incl. bundled Electron runtime).
   * Empty updateFeedUrl → https://github.com/ramchandragada/AsperaDock/releases/latest/download
   */
  autoUpdateEnabled: true,
  /** Override feed base URL. Leave empty to use GitHub Releases. */
  updateFeedUrl: '',
  updateChannel: 'stable', // stable | beta
  /** Download updates automatically in the background. */
  autoUpdateDownload: true,
  /** Install silently on next quit (no prompt). Mandatory updates always install. */
  autoUpdateInstall: false,
  updateCheckMinutes: 180,

  /**
   * Lean mode for refurbished / low-RAM PCs:
   * disables GPU accel, keeps fewer warm apps, hibernates faster.
   * Needs relaunch for hardwareAcceleration.
   * Off by default — on kills tab switching (apps reload every click).
   */
  lowMemoryMode: false,

  // Defaults for apps (overridden per-app via right-click Edit)
  linkHandling: 'block', // block | external
  spellChecker: ['en-US'],
  /** Hibernate idle background apps (keepWarm apps like WhatsApp are skipped). */
  hibernateMinutes: 30,
  /**
   * How many apps stay loaded while you switch tabs.
   * Rambox/Ferdium-style: keep several messaging apps warm so switching is instant.
   */
  maxWarmViews: 5,

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

  /**
   * Named Electron session profiles (Rambox-style).
   * Each profile owns one persist: partition — assign different profiles
   * to multiple WhatsApp / Arattai / Gmail tabs for separate logins.
   * @type {{ id: string, name: string, partition: string }[]}
   */
  profiles: [
    {
      id: PRIMARY_PROFILE_ID,
      name: 'Primary',
      partition: `persist:profile-${PRIMARY_PROFILE_ID}`,
    },
  ],

  // Session
  lastActiveServiceId: null,
  serviceOrder: [],
  /**
   * User-added app instances.
   * @type {{ id: string, appId: string, profileId: string, slot: number, partition?: string }[]}
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

/** Drop saved instances of apps that are no longer in the catalog (keep custom URLs). */
function dropRetiredApps(settings) {
  const instances = (settings.serviceInstances || []).filter((i) =>
    isKnownAppInstance(i),
  );
  if (instances.length === (settings.serviceInstances || []).length) return settings;

  const kept = new Set(instances.map((i) => i.id));
  return {
    ...settings,
    serviceInstances: instances,
    serviceOrder: (settings.serviceOrder || []).filter((id) => kept.has(id)),
    lastActiveServiceId: kept.has(settings.lastActiveServiceId)
      ? settings.lastActiveServiceId
      : null,
  };
}

/**
 * Migrate pre-profile instances onto named profiles without losing logins.
 * Old `persist:<instanceId>` partitions are preserved on dedicated profiles.
 */
function migrateProfiles(settings) {
  let profiles = Array.isArray(settings.profiles) ? [...settings.profiles] : [];
  if (!profiles.length) {
    profiles = [
      {
        id: PRIMARY_PROFILE_ID,
        name: 'Primary',
        partition: `persist:profile-${PRIMARY_PROFILE_ID}`,
      },
    ];
  }

  // Ensure Primary always exists.
  if (!profiles.some((p) => p.id === PRIMARY_PROFILE_ID)) {
    profiles.unshift({
      id: PRIMARY_PROFILE_ID,
      name: 'Primary',
      partition: `persist:profile-${PRIMARY_PROFILE_ID}`,
    });
  }

  // Normalize profile shape.
  profiles = profiles.map((p) => ({
    id: String(p.id),
    name: String(p.name || 'Profile').trim() || 'Profile',
    partition:
      p.partition && String(p.partition).startsWith('persist:')
        ? String(p.partition)
        : `persist:profile-${p.id}`,
  }));

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const instances = (settings.serviceInstances || []).map((inst) => {
    const next = { ...inst };

    // Already on a known profile.
    if (next.profileId && byId.has(next.profileId)) {
      delete next.partition;
      return next;
    }

    // Legacy instance with its own partition — wrap as a dedicated profile
    // so existing WhatsApp/Gmail logins stay signed in.
    if (next.partition && String(next.partition).startsWith('persist:')) {
      const label =
        settings.serviceLabels?.[next.id]?.name ||
        getAppCatalogEntry(next.appId)?.name ||
        'Profile';
      const profile = {
        id: makeProfileId(),
        name: String(label),
        partition: String(next.partition),
      };
      profiles.push(profile);
      byId.set(profile.id, profile);
      next.profileId = profile.id;
      delete next.partition;
      return next;
    }

    // Fallback: Primary.
    next.profileId = PRIMARY_PROFILE_ID;
    delete next.partition;
    return next;
  });

  return { ...settings, profiles, serviceInstances: instances };
}

/**
 * Older builds defaulted to 1 warm view + low-memory mode, which destroys
 * every background tab on switch (WhatsApp reloads every time). One-shot migrate
 * existing installs to Rambox/Ferdium-style keep-alive.
 */
function migrateWarmKeepAlive(settings) {
  if (settings.warmKeepAliveV1) return settings;
  const maxWarm = Number(settings.maxWarmViews);
  const needsFix =
    settings.lowMemoryMode === true || !Number.isFinite(maxWarm) || maxWarm <= 1;
  return {
    ...settings,
    warmKeepAliveV1: true,
    ...(needsFix
      ? {
          lowMemoryMode: false,
          maxWarmViews: Math.max(5, maxWarm || 0),
          hibernateMinutes: Math.max(30, Number(settings.hibernateMinutes) || 0),
        }
      : {}),
  };
}

export function loadSettings() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = migrateWarmKeepAlive(
      migrateProfiles(
        dropRetiredApps({
          ...DEFAULTS,
          ...parsed,
          shortcuts: { ...DEFAULTS.shortcuts, ...(parsed.shortcuts || {}) },
          serviceLabels: parsed.serviceLabels || {},
          serviceConfigs: parsed.serviceConfigs || {},
          serviceInstances: parsed.serviceInstances || [],
          profiles: parsed.profiles,
        }),
      ),
    );
    // Persist migration so partitions/profileIds are stable next launch.
    try {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      fs.writeFileSync(settingsPath(), JSON.stringify(cache, null, 2), 'utf8');
    } catch {
      // ignore
    }
  } catch {
    cache = { ...DEFAULTS, profiles: [...DEFAULTS.profiles] };
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
