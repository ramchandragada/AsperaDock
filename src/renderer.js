import './index.css';
import { logoHtml } from './logos.js';
import { icon } from './icons.js';
import { BRAND, asperaAppIconSvg } from './brand.js';
// Renderer errors route through main → Sentry when DSN is configured.
import('@sentry/electron/renderer')
  .then((SentryRenderer) => {
    try {
      SentryRenderer.init();
    } catch {
      // ignore
    }
  })
  .catch(() => {
    // Optional — main process still captures crashes; missing module must not blank UI.
  });

const els = {
  appsTop: document.getElementById('apps-top'),
  appsLeft: document.getElementById('apps-left'),
  addAppBtn: document.getElementById('add-app-btn'),
  emptyState: document.getElementById('empty-state'),
  emptyAddBtn: document.getElementById('empty-add-btn'),
  focusBtn: document.getElementById('focus-btn'),
  muteBtn: document.getElementById('mute-btn'),
  freeRamBtn: null,
  reloadBtn: null,
  menuBtn: document.getElementById('menu-btn'),
  chromeMenu: document.getElementById('app-chrome-menu'),
  downloadsBtn: document.getElementById('downloads-btn'),
  searchBtn: document.getElementById('search-btn'),
  layoutBtn: document.getElementById('layout-btn'),
  globalBadge: document.getElementById('global-badge'),
  notifBtn: document.getElementById('notif-btn'),
  notifCenter: document.getElementById('notif-center'),
  notifList: document.getElementById('notif-list'),
  notifClear: document.getElementById('notif-clear'),
  notifReadAll: document.getElementById('notif-read-all'),
  monitorBlock: document.getElementById('monitor-block'),
  monitorList: document.getElementById('monitor-list'),
  topBar: document.getElementById('top-bar'),
  settingsModal: document.getElementById('settings-modal'),
  settingsSave: document.getElementById('settings-save'),
  settingsClose: document.getElementById('settings-close'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  shortcutsSave: document.getElementById('shortcuts-save'),
  shortcutsClose: document.getElementById('shortcuts-close'),
  shortcutsList: document.getElementById('shortcuts-list'),
  searchModal: document.getElementById('search-modal'),
  searchInput: document.getElementById('search-input'),
  searchResults: document.getElementById('search-results'),
  lockScreen: document.getElementById('lock-screen'),
  lockPassword: document.getElementById('lock-password'),
  unlockBtn: document.getElementById('unlock-btn'),
  lockError: document.getElementById('lock-error'),
  catalogList: document.getElementById('catalog-list'),
  instanceList: document.getElementById('instance-list'),
  browseDownload: document.getElementById('browse-download'),
  notifIconSlot: document.querySelector('#notif-btn .icon-slot'),
  appMenu: document.getElementById('app-menu'),
  appMenuTitle: document.getElementById('app-menu-title'),
  appMenuEdit: document.getElementById('app-menu-edit'),
  appMenuReload: document.getElementById('app-menu-reload'),
  appMenuEnabled: document.getElementById('app-menu-enabled'),
  appMenuSound: document.getElementById('app-menu-sound'),
  appMenuNotifications: document.getElementById('app-menu-notifications'),
  appMenuBack: document.getElementById('app-menu-back'),
  appMenuHome: document.getElementById('app-menu-home'),
  appMenuRefresh: document.getElementById('app-menu-refresh'),
  appMenuForward: document.getElementById('app-menu-forward'),
  appMenuDevtools: document.getElementById('app-menu-devtools'),
  editAppModal: document.getElementById('edit-app-modal'),
  editAppHeading: document.getElementById('edit-app-heading'),
  editAppLogo: document.getElementById('edit-app-logo'),
  editAppName: document.getElementById('edit-app-name'),
  editAppRemove: document.getElementById('edit-app-remove'),
  editAppSave: document.getElementById('edit-app-save'),
  editAppClose: document.getElementById('edit-app-close'),
  editAppClearSession: document.getElementById('edit-app-clear-session'),
  profilesModal: document.getElementById('profiles-modal'),
  profilesList: document.getElementById('profiles-list'),
  profilesCreate: document.getElementById('profiles-create'),
  profilesClose: document.getElementById('profiles-close'),
  profileNameModal: document.getElementById('profile-name-modal'),
  profileNameTitle: document.getElementById('profile-name-title'),
  profileNameInput: document.getElementById('profile-name-input'),
  profileNameOk: document.getElementById('profile-name-ok'),
  profileNameCancel: document.getElementById('profile-name-cancel'),
  profileNameX: document.getElementById('profile-name-x'),
  eaProfile: document.getElementById('ea-profile'),
  eaProfileAdd: document.getElementById('ea-profile-add'),
  customAppModal: document.getElementById('custom-app-modal'),
  customAppUrl: document.getElementById('custom-app-url'),
  customAppName: document.getElementById('custom-app-name'),
  customAppOk: document.getElementById('custom-app-ok'),
  customAppCancel: document.getElementById('custom-app-cancel'),
  customAppX: document.getElementById('custom-app-x'),
  findBar: document.getElementById('find-bar'),
  findInput: document.getElementById('find-input'),
  findStatus: document.getElementById('find-status'),
  findPrev: document.getElementById('find-prev'),
  findNext: document.getElementById('find-next'),
  findClose: document.getElementById('find-close'),
};

const SHORTCUT_DEFS = [
  {
    group: 'App navigation',
    items: [
      { id: 'switchTab', label: 'Go to specific tab', keys: 'Ctrl + 1–9' },
      { id: 'nextTab', label: 'Switch tabs', keys: 'Ctrl + Tab / Ctrl + Shift + Tab' },
      { id: 'backForward', label: 'Back / Forward in apps', keys: 'Alt + Left / Right' },
    ],
  },
  {
    group: 'Sections and features',
    items: [
      { id: 'search', label: 'Quick search', keys: 'Ctrl + /' },
      { id: 'find', label: 'Find in page', keys: 'Ctrl + F' },
      { id: 'print', label: 'Print page', keys: 'Ctrl + P' },
      { id: 'settings', label: 'Settings', keys: 'Ctrl + ,' },
      { id: 'focusMode', label: 'Focus mode', keys: 'Ctrl + Shift + D' },
      { id: 'mute', label: 'Mute', keys: 'Ctrl + Shift + M' },
      { id: 'hibernate', label: 'Hibernate background', keys: 'Ctrl + Shift + H' },
      { id: 'lock', label: 'Lock Aspera Dock', keys: 'Ctrl + Shift + L' },
    ],
  },
];

let menuServiceId = null;
let editServiceId = null;
let dragServiceId = null;
let dragDidMove = false;
let dropTargetId = null;
let dropPlace = 'before';

const SIDE_POSITIONS = ['left', 'right'];
const POSITION_CYCLE = ['top', 'left', 'right'];

function clearDropMarkers() {
  document.querySelectorAll('.app-tab.drop-before, .app-tab.drop-after').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after');
  });
}

function orderFromDrop(sourceId, targetId, place) {
  const ids = (state.services || []).map((s) => s.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || sourceId === targetId) return null;
  const next = ids.filter((id) => id !== sourceId);
  let insertAt = next.indexOf(targetId);
  if (place === 'after') insertAt += 1;
  next.splice(insertAt, 0, sourceId);
  return next;
}

function bindAppTabDrag(btn, service) {
  btn.draggable = true;

  btn.addEventListener('dragstart', (event) => {
    dragServiceId = service.id;
    dragDidMove = false;
    dropTargetId = null;
    btn.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', service.id);
    // Hide native tooltip while dragging.
    btn.removeAttribute('data-tooltip');
  });

  btn.addEventListener('dragend', () => {
    btn.classList.remove('dragging');
    clearDropMarkers();
    btn.dataset.tooltip = service.title || service.name;
    dragServiceId = null;
    dropTargetId = null;
  });

  btn.addEventListener('dragover', (event) => {
    if (!dragServiceId || dragServiceId === service.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragDidMove = true;
    const rect = btn.getBoundingClientRect();
    const side =
      state.settings?.appsPosition === 'left' ||
      state.settings?.appsPosition === 'right';
    const place = side
      ? event.clientY < rect.top + rect.height / 2
        ? 'before'
        : 'after'
      : event.clientX < rect.left + rect.width / 2
        ? 'before'
        : 'after';
    clearDropMarkers();
    btn.classList.add(place === 'before' ? 'drop-before' : 'drop-after');
    dropTargetId = service.id;
    dropPlace = place;
  });

  btn.addEventListener('dragleave', () => {
    btn.classList.remove('drop-before', 'drop-after');
  });

  btn.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = dragServiceId || event.dataTransfer.getData('text/plain');
    const targetId = dropTargetId || service.id;
    const place = dropPlace || 'before';
    clearDropMarkers();
    const next = orderFromDrop(sourceId, targetId, place);
    dragServiceId = null;
    if (!next) return;
    await window.asperadock.reorder(next);
  });
}

function paintToolbarIcons() {
  els.downloadsBtn.innerHTML = icon('download');
  els.searchBtn.innerHTML = icon('search');
  els.focusBtn.innerHTML = icon('focus');
  els.menuBtn.innerHTML = asperaAppIconSvg(22);
  els.layoutBtn.innerHTML = icon('layout-left');
  els.addAppBtn.innerHTML = icon('plus');
  if (els.notifIconSlot) els.notifIconSlot.innerHTML = icon('bell');
  els.appMenuEdit.innerHTML = icon('settings');
  els.appMenuReload.innerHTML = icon('sync');
  els.appMenuBack.innerHTML = icon('back');
  els.appMenuHome.innerHTML = icon('home');
  els.appMenuRefresh.innerHTML = icon('reload');
  els.appMenuForward.innerHTML = icon('forward');

  // Brand surfaces
  const emptyBrand = document.getElementById('empty-brand');
  if (emptyBrand) emptyBrand.src = BRAND.wordmarkUrl;
  const lockBrand = document.getElementById('lock-brand');
  if (lockBrand) lockBrand.innerHTML = asperaAppIconSvg(48);
  const settingsHead = document.getElementById('settings-head-ico');
  const shortcutsHead = document.getElementById('shortcuts-head-ico');
  if (settingsHead) settingsHead.innerHTML = icon('settings');
  if (shortcutsHead) shortcutsHead.innerHTML = icon('keyboard');
  for (const slot of document.querySelectorAll('.chrome-menu-ico, .modal-head-ico')) {
    slot.innerHTML = icon(slot.dataset.ico);
  }
}

let state = {
  activeServiceId: null,
  warmIds: [],
  services: [],
  catalog: [],
  profiles: [],
  notifications: [],
  appMemory: {},
  unread: {},
  totalUnread: 0,
  settings: {},
  locked: false,
};

let draft = {};

const THEMES = ['light', 'dark', 'darkest', 'glossy', 'mint'];
const DARK_THEMES = ['dark', 'darkest'];

function applyChromeClasses() {
  const s = state.settings || {};
  const theme =
    s.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : s.theme || 'light';

  for (const name of THEMES) {
    document.body.classList.toggle(`theme-${name}`, theme === name);
  }
  document.body.classList.toggle('theme-dark', DARK_THEMES.includes(theme));
  document.body.classList.toggle('theme-light', !DARK_THEMES.includes(theme));
  document.body.classList.toggle('wrap-tabs', s.wrapAppTabs !== false);
  document.body.classList.toggle(
    'layout-top',
    !SIDE_POSITIONS.includes(s.appsPosition),
  );
  document.body.classList.toggle('layout-left', s.appsPosition === 'left');
  document.body.classList.toggle('layout-right', s.appsPosition === 'right');
  document.body.classList.toggle('density-compact', s.density === 'compact');
  document.body.classList.toggle('density-normal', s.density === 'normal');
  document.body.classList.toggle(
    'density-comfortable',
    s.density !== 'compact' && s.density !== 'normal',
  );
  document.body.classList.toggle('hide-labels', !!s.hideAppLabels);
  document.body.classList.toggle('is-empty', !(state.services || []).length);
}

function makeAppIcon(service) {
  const el = document.createElement('span');
  el.className = 'app-icon has-logo';
  el.innerHTML = logoHtml(
    service.logo,
    (service.defaultName || service.name || '?').slice(0, 1),
    service.color,
  );
  return el;
}

function makeAppTab(service, index) {
  const unread = state.unread?.[service.id] || 0;
  const cfg = service.config || {};
  const muted = !!state.settings?.muted || cfg.allowSounds === false;
  const sleeping = !state.warmIds.includes(service.id);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'app-tab';
  btn.dataset.id = service.id;
  btn.dataset.tooltip = service.title || service.name;
  btn.setAttribute(
    'aria-label',
    `${service.title || service.name}${index < 9 ? ` — Ctrl+${index + 1}` : ''}`,
  );
  if (service.id === state.activeServiceId) btn.classList.add('active');
  if (state.warmIds.includes(service.id)) btn.classList.add('warm');
  else btn.classList.add('sleep');
  if (cfg.enabled === false) btn.classList.add('disabled');
  if (muted) btn.classList.add('muted');

  const logo = makeAppIcon(service);

  if (unread > 0 && cfg.displayUnreadInTab !== false) {
    const badge = document.createElement('span');
    badge.className = 'app-badge';
    badge.textContent = unread > 99 ? '99+' : String(unread);
    logo.appendChild(badge);
  }

  if (muted) {
    const muteMark = document.createElement('span');
    muteMark.className = 'app-mark mute';
    muteMark.innerHTML = icon('mute');
    logo.appendChild(muteMark);
  }

  if (sleeping && cfg.enabled !== false) {
    const sleepDot = document.createElement('span');
    sleepDot.className = 'app-mark sleep-dot';
    logo.appendChild(sleepDot);
  }

  btn.appendChild(logo);

  if (cfg.showNameInTab !== false && !state.settings?.hideAppLabels) {
    const label = document.createElement('span');
    label.className = 'app-label';
    label.textContent = service.name;
    btn.appendChild(label);
  }

  btn.addEventListener('click', () => {
    if (dragDidMove) {
      dragDidMove = false;
      return;
    }
    if (cfg.enabled === false) {
      openEditApp(service.id);
      return;
    }
    window.asperadock.activate(service.id);
  });
  btn.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openAppMenu(service, event.clientX, event.clientY);
  });
  bindAppTabDrag(btn, service);
  return btn;
}

function renderApps() {
  const list = state.services || [];
  els.appsTop.innerHTML = '';
  els.appsLeft.innerHTML = '';
  list.forEach((service, index) => {
    els.appsTop.appendChild(makeAppTab(service, index));
    els.appsLeft.appendChild(makeAppTab(service, index));
  });

  if (SIDE_POSITIONS.includes(state.settings?.appsPosition)) {
    const addLeft = document.createElement('button');
    addLeft.type = 'button';
    addLeft.className = 'icon-btn add-app-btn add-app-left';
    addLeft.title = 'Add app';
    addLeft.innerHTML = icon('plus');
    addLeft.addEventListener('click', openAppsSettings);
    els.appsLeft.appendChild(addLeft);
  }
}

function renderEmptyState() {
  const empty = !(state.services || []).length;
  els.emptyState.classList.toggle('hidden', !empty || state.locked);
  paintAppVersion();
}

function paintAppVersion() {
  const version = state.appVersion || '';
  const dev = state.isPackaged === false;
  const label = version ? (dev ? `Version ${version} (dev)` : `Version ${version}`) : '';
  const short = version ? (dev ? `v${version}·dev` : `v${version}`) : '';
  const full = version
    ? (dev ? `Aspera Dock ${version} (dev)` : `Aspera Dock ${version}`)
    : 'Aspera Dock';

  const emptyVer = document.getElementById('empty-version');
  if (emptyVer) emptyVer.textContent = label || 'Version …';

  const chip = document.getElementById('settings-app-version');
  if (chip) {
    chip.textContent = short || 'v…';
    chip.title = full;
  }

  const running = document.getElementById('settings-running-version');
  if (running) running.textContent = full;

  const menuVer = document.getElementById('chrome-menu-version');
  if (menuVer) menuVer.textContent = full;
}

function renderChromeActions() {
  const s = state.settings || {};
  const folder = String(s.downloadPath || '').trim();
  els.downloadsBtn.title = folder
    ? `Open Downloads folder\n${folder}`
    : 'Open Downloads folder';
  els.focusBtn.classList.toggle('on', !!s.focusMode);
  els.focusBtn.title = s.focusMode
    ? 'Focus on — Ctrl+Shift+D'
    : 'Focus mode — Ctrl+Shift+D';
  els.muteBtn.classList.toggle('on', !!s.muted);
  els.muteBtn.innerHTML = icon(s.muted ? 'mute' : 'unmute');
  els.muteBtn.title = s.muted ? 'Unmute — Ctrl+Shift+M' : 'Mute — Ctrl+Shift+M';

  const total = state.totalUnread || 0;
  if (total > 0) {
    els.globalBadge.classList.remove('hidden');
    els.globalBadge.textContent = total > 99 ? '99+' : String(total);
  } else {
    els.globalBadge.classList.add('hidden');
  }

  const pos = s.appsPosition || 'top';
  const icons = {
    top: 'layout-left',
    left: 'layout-right',
    right: 'layout-top',
  };
  const titles = {
    top: 'Move app bar to left',
    left: 'Move app bar to right',
    right: 'Move app bar to top',
  };
  els.layoutBtn.innerHTML = icon(icons[pos] || 'layout-left');
  els.layoutBtn.title = titles[pos] || 'Move app bar';
}

function relativeTime(at) {
  const diff = Math.max(0, Date.now() - at);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function renderNotificationCenter() {
  const items = state.notifications || [];
  els.notifList.innerHTML = '';
  if (!items.length) {
    els.notifList.innerHTML = '<p class="notif-empty">No new notifications</p>';
  } else {
    for (const item of items) {
      const service = getServiceById(item.serviceId);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'notif-row';
      const logo = document.createElement('span');
      logo.className = 'app-icon has-logo notif-logo';
      logo.innerHTML = logoHtml(
        service?.logo,
        (item.title || '?').slice(0, 1),
        service?.color,
      );
      const text = document.createElement('span');
      text.className = 'notif-text';
      text.innerHTML = `<strong>${item.title}</strong><span>${item.body}</span>`;
      const time = document.createElement('span');
      time.className = 'notif-time';
      time.textContent = relativeTime(item.at);
      row.append(logo, text, time);
      row.addEventListener('click', async () => {
        closeNotificationCenter();
        if (item.serviceId) await window.asperadock.activate(item.serviceId);
      });
      els.notifList.appendChild(row);
    }
  }

  const monitorOn = !!state.settings?.consumptionMonitor;
  els.monitorBlock.classList.toggle('hidden', !monitorOn);
  if (!monitorOn) return;

  const memory = state.appMemory || {};
  const rows = (state.services || [])
    .map((service) => ({ service, mb: memory[service.id] || 0 }))
    .filter((row) => row.mb > 0)
    .sort((a, b) => b.mb - a.mb);

  els.monitorList.innerHTML = '';
  if (!rows.length) {
    els.monitorList.innerHTML = '<p class="notif-empty">No apps loaded</p>';
    return;
  }
  const peak = rows[0].mb;
  for (const { service, mb } of rows) {
    const row = document.createElement('div');
    row.className = 'monitor-row';
    row.innerHTML = `
      <span class="monitor-name">${service.name}</span>
      <span class="monitor-bar"><i style="width:${Math.max(6, Math.round((mb / peak) * 100))}%"></i></span>
      <span class="monitor-value">${mb} MB</span>`;
    els.monitorList.appendChild(row);
  }
}

/** Report measured chrome size so the BrowserView never overlaps wrapped rows. */
function reportChromeSize() {
  const pos = state.settings?.appsPosition || 'top';
  const sideWidth = els.appsLeft.getBoundingClientRect().width;
  const topHeight = els.topBar.getBoundingClientRect().height;
  window.asperadock.setChromeSize?.({
    top: Math.round(topHeight),
    left: pos === 'left' ? Math.round(sideWidth) : 0,
    right: pos === 'right' ? Math.round(sideWidth) : 0,
  });
}

function renderCatalog() {
  if (!els.catalogList) return;
  els.catalogList.innerHTML = '';
  for (const app of state.catalog || []) {
    const row = document.createElement('div');
    row.className = 'catalog-row';

    const logo = document.createElement('span');
    logo.className = 'app-icon has-logo';
    logo.innerHTML = logoHtml(app.logo, app.name.slice(0, 1), app.color);

    const meta = document.createElement('div');
    meta.className = 'catalog-meta';
    meta.innerHTML = `<strong>${app.title}</strong><span>${app.count}/${app.max} · dock ${app.totalApps || 0}/${app.maxTotal || 10}</span>`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    const totalFull = (app.totalApps || 0) >= (app.maxTotal || 10);
    btn.textContent = !app.canAdd ? (totalFull ? 'Dock full' : 'Max') : app.isCustom ? 'Add URL…' : 'Add';
    btn.disabled = !app.canAdd;
    btn.addEventListener('click', async () => {
      if (app.isCustom) {
        openCustomAppModal();
        return;
      }
      const result = await window.asperadock.addService(app.appId);
      if (!result.ok) alert(result.error || 'Could not add app');
    });

    row.append(logo, meta, btn);
    els.catalogList.appendChild(row);
  }
}

function renderInstances() {
  if (!els.instanceList) return;
  els.instanceList.innerHTML = '';
  if (!(state.services || []).length) {
    els.instanceList.innerHTML =
      '<p class="hint-text">No apps yet — add one above.</p>';
    return;
  }

  const heading = document.createElement('h4');
  heading.className = 'instance-heading';
  heading.textContent = 'Installed';
  els.instanceList.appendChild(heading);

  for (const service of state.services) {
    const row = document.createElement('div');
    row.className = 'instance-row';

    const logo = makeAppIcon(service);
  const label = document.createElement('span');
  label.innerHTML = `${service.title || service.name}<small class="instance-profile">${service.profileName || 'Primary'}</small>`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger-btn';
    remove.title = 'Remove app';
    remove.innerHTML = icon('trash');
    remove.addEventListener('click', async () => {
      if (
        confirm(
          `Remove ${service.title || service.name}? Login data for this instance stays until you clear the session.`,
        )
      ) {
        await window.asperadock.removeService(service.id);
      }
    });

    row.append(logo, label, remove);
    els.instanceList.appendChild(row);
  }
}

function fillSettingsForm() {
  const s = state.settings || {};
  draft = { ...s };
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value ?? '';
  };

  set('set-theme', s.theme || 'system');
  set('set-density', s.density || 'comfortable');
  set('set-apps-position', s.appsPosition || 'top');
  set('set-hide-labels', s.hideAppLabels);
  set('set-wrap-tabs', s.wrapAppTabs !== false);
  set('set-auto-hide-menu', s.autoHideMenuBar !== false);
  set('set-active-title', String(!!s.showActiveInTitle));
  set('set-focus-clear-badges', s.focusClearsBadges);
  set('set-download-path', s.downloadPath || '');
  set('set-open-folder', s.openFolderOnDownload);
  set('set-open-file', s.openFileOnDownload);
  set('set-autostart', String(!!s.autoStart));
  set('set-display', s.displayBehaviour || 'taskbar');
  set('set-close', s.closeBehaviour || 'quit');
  set('set-always-top', s.alwaysOnTop);
  set('set-tray-unread', s.trayUnreadIndicator);
  set('set-flash', s.flashTaskbar);
  set('set-confirm-quit', s.confirmQuit);
  set('set-lock-enabled', String(!!s.lockEnabled));
  set('set-lock-password', '');
  set('set-lock-idle', s.lockOnSystemIdle);
  set('set-proxy-mode', s.proxyMode || 'none');
  set('set-proxy-rules', s.proxyRules || '');
  set('set-proxy-bypass', s.proxyBypass ?? '<local>');
  set('set-hibernate', s.hibernateMinutes ?? 30);
  set('set-max-warm', s.maxWarmViews ?? 5);
  set('set-low-memory', s.lowMemoryMode === true);
  set('set-consumption', s.consumptionMonitor);
  set('set-error-reporting', s.errorReportingEnabled !== false);
  set('set-error-target', s.errorReportTarget || 'sentry');
  set('set-sentry-dsn', s.sentryDsn || '');
  set('set-error-repo', s.errorReportGithubRepo || '');
  set('set-error-token', s.errorReportGithubToken || '');
  set('set-error-url', s.errorReportUrl || '');
  set('set-auto-update', s.autoUpdateEnabled !== false);
  set('set-auto-download', s.autoUpdateDownload !== false);
  set('set-auto-install', s.autoUpdateInstall === true);
  set('set-update-channel', s.updateChannel || 'stable');
  set('set-update-url', s.updateFeedUrl || '');
  set('set-hw-accel', s.hardwareAcceleration === true);
  set('set-hidpi', s.hiDpiSupport !== false);
  set('set-media-keys', s.mediaKeys !== false);
  set('set-links', s.linkHandling || 'block');
  set(
    'set-spell',
    Array.isArray(s.spellChecker) ? s.spellChecker[0] : s.spellChecker || 'en-US',
  );
  set('set-hide-notif-body', s.hideNotificationContent);

  renderCatalog();
  renderInstances();
}

function readSettingsForm() {
  const val = (id) => document.getElementById(id).value;
  const checked = (id) => document.getElementById(id).checked;
  const patch = {
    theme: val('set-theme'),
    density: val('set-density'),
    appsPosition: val('set-apps-position'),
    hideAppLabels: checked('set-hide-labels'),
    wrapAppTabs: checked('set-wrap-tabs'),
    autoHideMenuBar: checked('set-auto-hide-menu'),
    showActiveInTitle: val('set-active-title') === 'true',
    focusClearsBadges: checked('set-focus-clear-badges'),
    downloadPath: val('set-download-path'),
    openFolderOnDownload: checked('set-open-folder'),
    openFileOnDownload: checked('set-open-file'),
    autoStart: val('set-autostart') === 'true',
    displayBehaviour: val('set-display'),
    closeBehaviour: val('set-close'),
    alwaysOnTop: checked('set-always-top'),
    trayUnreadIndicator: checked('set-tray-unread'),
    flashTaskbar: checked('set-flash'),
    confirmQuit: checked('set-confirm-quit'),
    lockEnabled: val('set-lock-enabled') === 'true',
    lockOnSystemIdle: checked('set-lock-idle'),
    proxyMode: val('set-proxy-mode'),
    proxyRules: val('set-proxy-rules').trim(),
    proxyBypass: val('set-proxy-bypass').trim() || '<local>',
    hibernateMinutes: Number(val('set-hibernate')) || 2,
    maxWarmViews: Math.min(10, Math.max(1, Number(val('set-max-warm')) || 5)),
    lowMemoryMode: checked('set-low-memory'),
    consumptionMonitor: checked('set-consumption'),
    errorReportingEnabled: checked('set-error-reporting'),
    errorReportTarget: val('set-error-target'),
    sentryDsn: val('set-sentry-dsn').trim(),
    errorReportGithubRepo: val('set-error-repo').trim(),
    errorReportGithubToken: val('set-error-token').trim(),
    errorReportUrl: val('set-error-url').trim(),
    autoUpdateEnabled: checked('set-auto-update'),
    autoUpdateDownload: checked('set-auto-download'),
    autoUpdateInstall: checked('set-auto-install'),
    updateChannel: val('set-update-channel'),
    updateFeedUrl: val('set-update-url').trim(),
    hardwareAcceleration: checked('set-hw-accel'),
    hiDpiSupport: checked('set-hidpi'),
    mediaKeys: checked('set-media-keys'),
    linkHandling: val('set-links'),
    spellChecker: [val('set-spell') || 'en-US'],
    hideNotificationContent: checked('set-hide-notif-body'),
  };
  const password = val('set-lock-password');
  if (password) patch.lockPassword = password;
  return patch;
}

function fillShortcutsForm() {
  const enabled = state.settings?.shortcuts || {};
  els.shortcutsList.innerHTML = '';
  for (const group of SHORTCUT_DEFS) {
    const rule = document.createElement('div');
    rule.className = 'section-rule';
    rule.innerHTML = `<span>${group.group}</span>`;
    els.shortcutsList.appendChild(rule);

    const grid = document.createElement('div');
    grid.className = 'shortcut-grid';
    for (const item of group.items) {
      const row = document.createElement('label');
      row.className = 'shortcut-row';
      row.innerHTML = `
        <input type="checkbox" data-shortcut="${item.id}" ${enabled[item.id] !== false ? 'checked' : ''} />
        <span class="shortcut-label">${item.label}</span>
        <kbd>${item.keys}</kbd>`;
      grid.appendChild(row);
    }
    els.shortcutsList.appendChild(grid);
  }
}

function readShortcutsForm() {
  const shortcuts = { ...(state.settings?.shortcuts || {}) };
  for (const input of els.shortcutsList.querySelectorAll('input[data-shortcut]')) {
    shortcuts[input.dataset.shortcut] = input.checked;
  }
  return { shortcuts };
}

function anyOverlayOpen() {
  return (
    !els.settingsModal.classList.contains('hidden') ||
    !els.searchModal.classList.contains('hidden') ||
    !els.editAppModal.classList.contains('hidden') ||
    !els.profilesModal?.classList.contains('hidden') ||
    !els.profileNameModal?.classList.contains('hidden') ||
    !els.customAppModal?.classList.contains('hidden') ||
    !els.appMenu.classList.contains('hidden') ||
    !els.shortcutsModal.classList.contains('hidden') ||
    !els.chromeMenu.classList.contains('hidden') ||
    !els.notifCenter.classList.contains('hidden') ||
    state.locked
  );
}

function syncOverlayFromModals() {
  window.asperadock.setOverlay(anyOverlayOpen());
}

function closeAppMenu() {
  els.appMenu.classList.add('hidden');
  menuServiceId = null;
  syncOverlayFromModals();
}

function openAppMenu(service, x, y) {
  menuServiceId = service.id;
  const cfg = service.config || {};
  els.appMenuTitle.textContent = service.name;
  els.appMenuEnabled.checked = cfg.enabled !== false;
  els.appMenuSound.checked = cfg.allowSounds !== false;
  els.appMenuNotifications.checked = cfg.allowNotifications !== false;

  els.appMenu.classList.remove('hidden');
  els.appMenu.style.left = '0px';
  els.appMenu.style.top = '0px';
  window.asperadock.setOverlay(true);

  requestAnimationFrame(() => {
    const pad = 8;
    const rect = els.appMenu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = window.innerWidth - rect.width - pad;
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = window.innerHeight - rect.height - pad;
    }
    els.appMenu.style.left = `${Math.max(pad, left)}px`;
    els.appMenu.style.top = `${Math.max(pad, top)}px`;
  });
}

function getServiceById(id) {
  return (state.services || []).find((s) => s.id === id) || null;
}

function openEditApp(id) {
  const service = getServiceById(id);
  if (!service) return;
  closeAppMenu();
  editServiceId = id;
  const cfg = service.config || {};

  els.editAppHeading.textContent = `Edit ${service.name}`;
  els.editAppLogo.innerHTML = logoHtml(
    service.logo,
    service.name.slice(0, 1),
    service.color,
  );
  els.editAppName.value = service.name;
  els.editAppName.dataset.defaultName = service.defaultName || service.name;

  const urlField = document.getElementById('ea-url-field');
  const urlInput = document.getElementById('ea-url');
  if (urlField && urlInput) {
    if (service.isCustom || service.appId === 'custom') {
      urlField.classList.remove('hidden');
      urlInput.value = service.url || '';
    } else {
      urlField.classList.add('hidden');
      urlInput.value = '';
    }
  }

  const setChk = (elId, value) => {
    document.getElementById(elId).checked = !!value;
  };
  setChk('ea-enabled', cfg.enabled !== false);
  setChk('ea-show-name', cfg.showNameInTab !== false);
  setChk('ea-sounds', cfg.allowSounds !== false);
  setChk('ea-notifications', cfg.allowNotifications !== false);
  setChk('ea-hide-body', !!cfg.hideNotificationContent);
  setChk('ea-unread-tab', cfg.displayUnreadInTab !== false);
  setChk('ea-unread-global', cfg.includeUnreadInGlobal !== false);
  setChk('ea-start-hibernated', !!cfg.startHibernated);
  setChk('ea-mobile', !!cfg.forceMobile);
  setChk('ea-no-basic-auth', !!cfg.preventBasicAuth);

  document.getElementById('ea-hibernate').value = cfg.hibernateMinutes ?? 0;
  document.getElementById('ea-autowake').value = cfg.autoWakeMinutes ?? 0;
  document.getElementById('ea-inject-js').value = cfg.injectJs || '';
  document.getElementById('ea-inject-css').value = cfg.injectCss || '';
  document.getElementById('ea-stylish').value = cfg.stylishUrl || '';
  document.getElementById('ea-ua').value = cfg.userAgent || '';

  const spell = document.getElementById('ea-spell');
  if (!cfg.spellChecker) spell.value = 'default';
  else spell.value = Array.isArray(cfg.spellChecker) ? cfg.spellChecker[0] : cfg.spellChecker;

  const links = document.getElementById('ea-links');
  links.value = cfg.linkHandling || 'default';

  fillProfileSelect(service.profileId);
  els.editAppModal.classList.remove('hidden');
  window.asperadock.setOverlay(true);
}

function fillProfileSelect(selectedId) {
  if (!els.eaProfile) return;
  const profiles = state.profiles || [];
  els.eaProfile.innerHTML = '';
  for (const profile of profiles) {
    const opt = document.createElement('option');
    opt.value = profile.id;
    opt.textContent = profile.name;
    if (profile.id === selectedId) opt.selected = true;
    els.eaProfile.appendChild(opt);
  }
}

function closeEditApp() {
  els.editAppModal.classList.add('hidden');
  editServiceId = null;
  syncOverlayFromModals();
}

async function saveEditApp() {
  if (!editServiceId) return;
  const spellVal = document.getElementById('ea-spell').value;
  const linkVal = document.getElementById('ea-links').value;
  const patch = {
    name: (els.editAppName.value || '').trim().slice(0, 10),
    title: (els.editAppName.value || '').trim().slice(0, 10),
    profileId: els.eaProfile?.value || undefined,
    enabled: document.getElementById('ea-enabled').checked,
    showNameInTab: document.getElementById('ea-show-name').checked,
    allowSounds: document.getElementById('ea-sounds').checked,
    allowNotifications: document.getElementById('ea-notifications').checked,
    hideNotificationContent: document.getElementById('ea-hide-body').checked,
    displayUnreadInTab: document.getElementById('ea-unread-tab').checked,
    includeUnreadInGlobal: document.getElementById('ea-unread-global').checked,
    hibernateMinutes: Number(document.getElementById('ea-hibernate').value) || 0,
    startHibernated: document.getElementById('ea-start-hibernated').checked,
    autoWakeMinutes: Number(document.getElementById('ea-autowake').value) || 0,
    injectJs: document.getElementById('ea-inject-js').value,
    injectCss: document.getElementById('ea-inject-css').value,
    stylishUrl: document.getElementById('ea-stylish').value.trim(),
    userAgent: document.getElementById('ea-ua').value.trim(),
    forceMobile: document.getElementById('ea-mobile').checked,
    preventBasicAuth: document.getElementById('ea-no-basic-auth').checked,
    spellChecker: spellVal === 'default' ? null : [spellVal],
    linkHandling: linkVal === 'default' ? null : linkVal,
  };
  const urlInput = document.getElementById('ea-url');
  const service = getServiceById(editServiceId);
  if (service && (service.isCustom || service.appId === 'custom') && urlInput) {
    patch.url = urlInput.value.trim();
  }
  const result = await window.asperadock.saveAppConfig(editServiceId, patch);
  if (!result?.ok) {
    alert(result?.error || 'Could not save app');
    return;
  }
  closeEditApp();
}

function renderProfiles() {
  if (!els.profilesList) return;
  els.profilesList.innerHTML = '';
  const profiles = state.profiles || [];
  if (!profiles.length) {
    els.profilesList.innerHTML = '<p class="hint-text">No profiles yet.</p>';
    return;
  }

  for (const profile of profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row';

    const meta = document.createElement('div');
    meta.className = 'profile-meta';
    const apps = (state.services || []).filter((s) => s.profileId === profile.id);
    const appNames = apps.map((s) => s.name).join(', ') || 'No apps';
    meta.innerHTML = `<strong>${profile.name}</strong><span>${profile.appCount || 0} app${(profile.appCount || 0) === 1 ? '' : 's'} · ${appNames}</span>`;

    const actions = document.createElement('div');
    actions.className = 'profile-actions';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'icon-btn';
    renameBtn.title = 'Rename';
    renameBtn.innerHTML = icon('pencil');
    renameBtn.addEventListener('click', async () => {
      const name = await askProfileName({
        title: 'Rename profile',
        initial: profile.name,
      });
      if (!name || name === profile.name) return;
      const result = await window.asperadock.renameProfile(profile.id, name);
      if (!result.ok) alert(result.error || 'Could not rename');
    });

    const trashBtn = document.createElement('button');
    trashBtn.type = 'button';
    trashBtn.className = 'icon-btn danger-btn';
    trashBtn.title = profile.locked ? 'Primary cannot be deleted' : 'Delete profile';
    trashBtn.disabled = !!profile.locked || (profile.appCount || 0) > 0;
    trashBtn.innerHTML = icon('trash');
    trashBtn.addEventListener('click', async () => {
      if (
        !confirm(
          `Delete profile “${profile.name}”? Its login data will be cleared.`,
        )
      ) {
        return;
      }
      const result = await window.asperadock.deleteProfile(profile.id);
      if (!result.ok) alert(result.error || 'Could not delete');
    });

    actions.append(renameBtn, trashBtn);
    row.append(meta, actions);
    els.profilesList.appendChild(row);
  }
}

function openProfiles() {
  closeAppMenu();
  closeChromeMenu();
  closeNotificationCenter();
  closeSettings();
  closeEditApp();
  renderProfiles();
  els.profilesModal.classList.remove('hidden');
  window.asperadock.setOverlay(true);
}

function closeProfiles() {
  els.profilesModal.classList.add('hidden');
  syncOverlayFromModals();
}

/** Rambox-style centered name dialog. Resolves to trimmed name or null. */
let profileNameResolver = null;

function closeProfileNameModal(result = null) {
  if (!els.profileNameModal) return;
  els.profileNameModal.classList.add('hidden');
  const resolve = profileNameResolver;
  profileNameResolver = null;
  syncOverlayFromModals();
  if (resolve) resolve(result);
}

function askProfileName({ title = 'New profile', initial = '' } = {}) {
  return new Promise((resolve) => {
    // Cancel any previous waiter.
    if (profileNameResolver) profileNameResolver(null);
    profileNameResolver = resolve;
    els.profileNameTitle.textContent = title;
    els.profileNameInput.value = initial || '';
    els.profileNameInput.placeholder = "Profile's name";
    els.profileNameModal.classList.remove('hidden');
    window.asperadock.setOverlay(true);
    requestAnimationFrame(() => {
      els.profileNameInput.focus();
      els.profileNameInput.select();
    });
  });
}

async function createProfilePrompt(defaultName = '') {
  const name = await askProfileName({
    title: 'New profile',
    initial: defaultName && defaultName !== 'Profile' ? defaultName : '',
  });
  if (!name) return null;
  const result = await window.asperadock.createProfile(name);
  if (!result.ok) {
    alert(result.error || 'Could not create profile');
    return null;
  }
  return result.profile;
}

function openSettings() {
  closeAppMenu();
  closeChromeMenu();
  fillSettingsForm();
  els.settingsModal.classList.remove('hidden');
  window.asperadock.setOverlay(true);
}

function openAppsSettings() {
  openSettings();
  requestAnimationFrame(() => {
    document.getElementById('catalog-list')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

function openShortcuts() {
  closeAppMenu();
  closeChromeMenu();
  fillShortcutsForm();
  els.shortcutsModal.classList.remove('hidden');
  window.asperadock.setOverlay(true);
}

function closeShortcuts() {
  els.shortcutsModal.classList.add('hidden');
  syncOverlayFromModals();
}

function closeNotificationCenter() {
  els.notifCenter.classList.add('hidden');
  syncOverlayFromModals();
}

function openNotificationCenter() {
  closeAppMenu();
  closeChromeMenu();
  renderNotificationCenter();
  els.notifCenter.classList.remove('hidden');
  window.asperadock.setOverlay(true);
}

function toggleNotificationCenter() {
  if (els.notifCenter.classList.contains('hidden')) openNotificationCenter();
  else closeNotificationCenter();
}

function closeChromeMenu() {
  els.chromeMenu.classList.add('hidden');
  syncOverlayFromModals();
}

function openChromeMenu() {
  closeAppMenu();
  closeNotificationCenter();
  els.chromeMenu.classList.remove('hidden');
  // BrowserView paints above HTML — hide it while the ⋮ menu is open.
  window.asperadock.setOverlay(true);
}

function toggleChromeMenu() {
  if (els.chromeMenu.classList.contains('hidden')) openChromeMenu();
  else closeChromeMenu();
}

function closeSettings() {
  els.settingsModal.classList.add('hidden');
  syncOverlayFromModals();
}

function openSearch() {
  closeAppMenu();
  closeChromeMenu();
  els.searchModal.classList.remove('hidden');
  els.searchInput.value = '';
  renderSearch('');
  els.searchInput.focus();
  window.asperadock.setOverlay(true);
}

function closeSearch() {
  els.searchModal.classList.add('hidden');
  syncOverlayFromModals();
}

function renderSearch(query) {
  const q = query.trim().toLowerCase();
  const matches = (state.services || []).filter((s) => {
    const hay = `${s.name} ${s.title || ''} ${s.appId || ''}`.toLowerCase();
    return !q || hay.includes(q);
  });
  els.searchResults.innerHTML = '';
  if (!matches.length) {
    els.searchResults.innerHTML =
      '<li class="search-empty">No apps yet — click + to add one</li>';
    return;
  }
  matches.forEach((service, index) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    if (index === 0) btn.classList.add('active');
    btn.innerHTML = `${logoHtml(service.logo, (service.name || '?').slice(0, 1), service.color)}<span>${service.title || service.name}</span>`;
    btn.querySelector('svg')?.classList.add('search-logo');
    btn.addEventListener('click', async () => {
      await window.asperadock.activate(service.id);
      closeSearch();
    });
    li.appendChild(btn);
    els.searchResults.appendChild(li);
  });
}

function renderLock() {
  if (state.locked) {
    els.lockScreen.classList.remove('hidden');
    els.lockPassword.value = '';
    els.lockError.textContent = '';
    els.lockPassword.focus();
    window.asperadock.setOverlay(true);
  } else {
    els.lockScreen.classList.add('hidden');
    syncOverlayFromModals();
  }
}

function render() {
  applyChromeClasses();
  renderApps();
  renderEmptyState();
  renderChromeActions();
  paintAppVersion();
  renderLock();
  if (!els.settingsModal.classList.contains('hidden')) {
    renderCatalog();
    renderInstances();
  }
  if (!els.profilesModal?.classList.contains('hidden')) renderProfiles();
  if (!els.notifCenter.classList.contains('hidden')) renderNotificationCenter();
  requestAnimationFrame(reportChromeSize);
}

els.focusBtn.addEventListener('click', () => window.asperadock.toggleFocus());
els.muteBtn.addEventListener('click', () => window.asperadock.toggleMute());
els.downloadsBtn.addEventListener('click', async () => {
  const result = await window.asperadock.openDownloads?.();
  if (result && !result.ok) {
    alert(`Could not open Downloads folder.\n${result.error || result.path || ''}`);
  }
});
els.menuBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleChromeMenu();
});
els.settingsClose.addEventListener('click', closeSettings);
els.searchBtn.addEventListener('click', openSearch);
els.addAppBtn.addEventListener('click', openAppsSettings);
els.emptyAddBtn.addEventListener('click', openAppsSettings);

els.chromeMenu.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  closeChromeMenu();
  if (action === 'settings') openSettings();
  if (action === 'profiles') openProfiles();
  if (action === 'shortcuts') openShortcuts();
  if (action === 'add-app') openAppsSettings();
  if (action === 'reload') window.asperadock.reloadActive();
  if (action === 'free-ram') window.asperadock.hibernateBackground();
  if (action === 'about') window.asperadock.showAbout?.();
});

els.settingsSave.addEventListener('click', async () => {
  const patch = readSettingsForm();
  if (patch.lockEnabled && patch.lockPassword === undefined && !state.settings.lockEnabled) {
    const pwd = document.getElementById('set-lock-password').value;
    if (!pwd) {
      alert('Set a password to enable lock.');
      return;
    }
  }
  await window.asperadock.saveSettings(patch);
  closeSettings();
});

els.shortcutsSave.addEventListener('click', async () => {
  await window.asperadock.saveSettings(readShortcutsForm());
  closeShortcuts();
});
els.shortcutsClose.addEventListener('click', closeShortcuts);
els.shortcutsModal.addEventListener('click', (event) => {
  if (event.target === els.shortcutsModal) closeShortcuts();
});

els.browseDownload.addEventListener('click', async () => {
  const result = await window.asperadock.pickDownloadDir();
  if (result.path) {
    document.getElementById('set-download-path').value = result.path;
  }
});

els.searchInput.addEventListener('input', () => renderSearch(els.searchInput.value));
els.searchInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Escape') closeSearch();
  if (event.key === 'Enter') {
    const first = els.searchResults.querySelector('button');
    first?.click();
  }
});

els.searchModal.addEventListener('click', (event) => {
  if (event.target === els.searchModal) closeSearch();
});

els.settingsModal.addEventListener('click', (event) => {
  if (event.target === els.settingsModal) closeSettings();
});

els.unlockBtn.addEventListener('click', async () => {
  const result = await window.asperadock.unlock(els.lockPassword.value);
  if (!result.ok) els.lockError.textContent = result.error || 'Failed';
});

els.lockPassword.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.unlockBtn.click();
});

els.notifBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleNotificationCenter();
});
els.notifClear.addEventListener('click', async () => {
  await window.asperadock.clearNotifications?.();
});
els.notifReadAll.addEventListener('click', async () => {
  await window.asperadock.markAllRead?.();
});
els.layoutBtn.addEventListener('click', async () => {
  const current = state.settings?.appsPosition || 'top';
  const index = POSITION_CYCLE.indexOf(current);
  const next = POSITION_CYCLE[(index + 1) % POSITION_CYCLE.length];
  await window.asperadock.saveSettings({ appsPosition: next });
});

window.addEventListener('resize', () => requestAnimationFrame(reportChromeSize));

window.asperadock.onOpenSettings(openSettings);
window.asperadock.onOpenAppsSettings?.(openAppsSettings);
window.asperadock.onOpenProfiles?.(openProfiles);
window.asperadock.onOpenSearch?.(openSearch);
window.asperadock.onOpenFind?.(openFindBar);
window.asperadock.onFindResult?.((data) => {
  if (!els.findStatus || !data) return;
  if (!data.matches) {
    els.findStatus.textContent = '0/0';
    return;
  }
  els.findStatus.textContent = `${data.activeMatchOrdinal || 0}/${data.matches}`;
});
window.asperadock.onSyncOverlay?.(syncOverlayFromModals);

async function patchMenuFlag(key, checked) {
  if (!menuServiceId) return;
  await window.asperadock.saveAppConfig(menuServiceId, { [key]: checked });
}

els.appMenuEdit.addEventListener('click', () => {
  if (menuServiceId) openEditApp(menuServiceId);
});
els.appMenuReload.addEventListener('click', async () => {
  if (!menuServiceId) return;
  await window.asperadock.appNavigate(menuServiceId, 'reload');
});
els.appMenuEnabled.addEventListener('change', () =>
  patchMenuFlag('enabled', els.appMenuEnabled.checked),
);
els.appMenuSound.addEventListener('change', () =>
  patchMenuFlag('allowSounds', els.appMenuSound.checked),
);
els.appMenuNotifications.addEventListener('change', () =>
  patchMenuFlag('allowNotifications', els.appMenuNotifications.checked),
);
els.appMenuBack.addEventListener('click', () =>
  menuServiceId && window.asperadock.appNavigate(menuServiceId, 'back'),
);
els.appMenuHome.addEventListener('click', () =>
  menuServiceId && window.asperadock.appNavigate(menuServiceId, 'home'),
);
els.appMenuRefresh.addEventListener('click', () =>
  menuServiceId && window.asperadock.appNavigate(menuServiceId, 'reload'),
);
els.appMenuForward.addEventListener('click', () =>
  menuServiceId && window.asperadock.appNavigate(menuServiceId, 'forward'),
);
els.appMenuDevtools.addEventListener('click', async () => {
  if (!menuServiceId) return;
  await window.asperadock.appNavigate(menuServiceId, 'devtools');
  closeAppMenu();
});

els.editAppClose.addEventListener('click', closeEditApp);
els.editAppSave.addEventListener('click', saveEditApp);
els.editAppRemove.addEventListener('click', async () => {
  if (!editServiceId) return;
  const service = getServiceById(editServiceId);
  if (confirm(`Remove ${service?.title || service?.name || 'this app'}?`)) {
    await window.asperadock.removeService(editServiceId);
    closeEditApp();
  }
});
els.editAppClearSession?.addEventListener('click', async () => {
  if (!editServiceId) return;
  const service = getServiceById(editServiceId);
  const profileName = service?.profileName || 'this profile';
  const shared = (state.services || []).filter(
    (s) => s.profileId === service?.profileId,
  );
  const extra =
    shared.length > 1
      ? `\n\nAlso signs out: ${shared.map((s) => s.name).join(', ')}`
      : '';
  if (
    confirm(
      `Clear login data for profile “${profileName}”?${extra}`,
    )
  ) {
    await window.asperadock.clearSession(editServiceId);
  }
});

els.eaProfileAdd?.addEventListener('click', async () => {
  const profile = await createProfilePrompt('');
  if (!profile) return;
  fillProfileSelect(profile.id);
});

els.profilesClose?.addEventListener('click', closeProfiles);
els.profilesCreate?.addEventListener('click', async () => {
  const profile = await createProfilePrompt('');
  if (profile) renderProfiles();
});
els.profilesModal?.addEventListener('click', (event) => {
  if (event.target === els.profilesModal) closeProfiles();
});

function submitProfileName() {
  const name = (els.profileNameInput?.value || '').trim();
  if (!name) {
    els.profileNameInput?.focus();
    return;
  }
  closeProfileNameModal(name);
}

els.profileNameOk?.addEventListener('click', submitProfileName);
els.profileNameCancel?.addEventListener('click', () => closeProfileNameModal(null));
els.profileNameX?.addEventListener('click', () => closeProfileNameModal(null));
els.profileNameModal?.addEventListener('click', (event) => {
  if (event.target === els.profileNameModal) closeProfileNameModal(null);
});
els.profileNameInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitProfileName();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeProfileNameModal(null);
  }
});

function openCustomAppModal() {
  closeSettings();
  if (!els.customAppModal) return;
  els.customAppUrl.value = '';
  els.customAppName.value = '';
  els.customAppModal.classList.remove('hidden');
  window.asperadock.setOverlay(true);
  requestAnimationFrame(() => els.customAppUrl?.focus());
}

function closeCustomAppModal() {
  els.customAppModal?.classList.add('hidden');
  syncOverlayFromModals();
}

async function submitCustomApp() {
  const url = (els.customAppUrl?.value || '').trim();
  const name = (els.customAppName?.value || '').trim();
  if (!url) {
    els.customAppUrl?.focus();
    return;
  }
  const result = await window.asperadock.addCustomService?.({ url, name });
  if (!result?.ok) {
    alert(result?.error || 'Could not add custom app');
    return;
  }
  closeCustomAppModal();
}

els.customAppOk?.addEventListener('click', submitCustomApp);
els.customAppCancel?.addEventListener('click', closeCustomAppModal);
els.customAppX?.addEventListener('click', closeCustomAppModal);
els.customAppModal?.addEventListener('click', (event) => {
  if (event.target === els.customAppModal) closeCustomAppModal();
});
els.customAppUrl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (!(els.customAppName?.value || '').trim()) {
      try {
        const host = new URL(
          els.customAppUrl.value.includes('://')
            ? els.customAppUrl.value
            : `https://${els.customAppUrl.value}`,
        ).hostname.replace(/^www\./, '');
        els.customAppName.value = host.slice(0, 10);
      } catch {
        // ignore
      }
    }
    submitCustomApp();
  }
  if (event.key === 'Escape') closeCustomAppModal();
});

function openFindBar() {
  if (!els.findBar) return;
  els.findBar.classList.remove('hidden');
  els.findInput.value = '';
  els.findStatus.textContent = '';
  requestAnimationFrame(() => {
    els.findInput?.focus();
    els.findInput?.select();
  });
}

function closeFindBar() {
  els.findBar?.classList.add('hidden');
  window.asperadock.stopFind?.();
  els.findStatus.textContent = '';
}

async function runFind({ findNext = false, forward = true } = {}) {
  const text = els.findInput?.value || '';
  await window.asperadock.findInPage?.(text, { findNext, forward });
  els.findStatus.textContent = text ? 'Searching…' : '';
}

els.findClose?.addEventListener('click', closeFindBar);
els.findNext?.addEventListener('click', () => runFind({ findNext: true, forward: true }));
els.findPrev?.addEventListener('click', () => runFind({ findNext: true, forward: false }));
els.findInput?.addEventListener('input', () => runFind({ findNext: false }));
els.findInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    runFind({ findNext: true, forward: !event.shiftKey });
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeFindBar();
  }
});

els.editAppModal.addEventListener('click', (event) => {
  if (event.target === els.editAppModal) closeEditApp();
});

document.addEventListener('click', (event) => {
  if (!els.chromeMenu.classList.contains('hidden')) {
    if (!event.target.closest('.menu-wrap')) closeChromeMenu();
  }
  if (!els.notifCenter.classList.contains('hidden')) {
    if (!event.target.closest('.menu-wrap')) closeNotificationCenter();
  }
  if (els.appMenu.classList.contains('hidden')) return;
  if (els.appMenu.contains(event.target)) return;
  if (event.target.closest?.('.app-tab')) return;
  closeAppMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!els.findBar?.classList.contains('hidden')) closeFindBar();
    else if (!els.customAppModal?.classList.contains('hidden')) closeCustomAppModal();
    else if (!els.profileNameModal?.classList.contains('hidden')) closeProfileNameModal(null);
    else if (!els.chromeMenu.classList.contains('hidden')) closeChromeMenu();
    else if (!els.notifCenter.classList.contains('hidden')) closeNotificationCenter();
    else if (!els.appMenu.classList.contains('hidden')) closeAppMenu();
    else if (!els.profilesModal?.classList.contains('hidden')) closeProfiles();
    else if (!els.editAppModal.classList.contains('hidden')) closeEditApp();
    else if (!els.shortcutsModal.classList.contains('hidden')) closeShortcuts();
  }
});

function installRendererErrorReporting() {
  const send = (kind, message, error = null, extra = null) => {
    try {
      window.asperadock.reportError?.({
        kind,
        message,
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : null,
        source: 'renderer',
        extra,
      });
    } catch {
      // ignore
    }
  };

  window.addEventListener('error', (event) => {
    send('window-error', event.message || 'window error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const error =
      reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
    send('unhandledrejection', error.message, error);
  });

  // Heartbeat so main can detect UI freezes.
  setInterval(() => {
    window.asperadock.heartbeat?.();
  }, 2000);

  // Animation-frame watchdog: if rAF stalls, report a freeze from the UI side too.
  let lastFrame = performance.now();
  let freezeSentAt = 0;
  const tick = (now) => {
    const gap = now - lastFrame;
    lastFrame = now;
    if (gap > 12000 && now - freezeSentAt > 30000) {
      freezeSentAt = now;
      send('ui-freeze', `requestAnimationFrame stalled ${Math.round(gap)}ms`, null, {
        gapMs: Math.round(gap),
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

document.getElementById('open-error-reports')?.addEventListener('click', () => {
  window.asperadock.openErrorReports?.();
});

function setUpdateStatus(text) {
  const el = document.getElementById('update-status-text');
  if (el) el.textContent = text;
}

async function refreshUpdateStatus() {
  try {
    const status = await window.asperadock.updateStatus?.();
    if (!status) return;
    if (status.pending) {
      setUpdateStatus(
        status.pending.downloaded
          ? `Update ${status.pending.version} ready — restart to apply`
          : `Update ${status.pending.version} available`,
      );
    } else {
      setUpdateStatus(`Up to date · v${status.currentVersion} (${status.channel})`);
    }
  } catch {
    setUpdateStatus('');
  }
}

document.getElementById('check-updates')?.addEventListener('click', async () => {
  setUpdateStatus('Checking for updates…');
  await window.asperadock.updateCheck?.();
  refreshUpdateStatus();
});

window.asperadock.onUpdateEvent?.((data) => {
  if (!data) return;
  switch (data.event) {
    case 'checking':
      setUpdateStatus('Checking for updates…');
      break;
    case 'up-to-date':
      setUpdateStatus(`Up to date · v${data.version || ''}`);
      break;
    case 'available':
      setUpdateStatus(`Update ${data.version} available — downloading…`);
      break;
    case 'download-progress':
      setUpdateStatus(`Downloading update… ${data.percent || 0}%`);
      break;
    case 'downloaded':
      setUpdateStatus(`Update ${data.version} ready — restart to apply`);
      break;
    case 'installing':
      setUpdateStatus('Installing update…');
      break;
    case 'error':
      setUpdateStatus(`Update error: ${data.message || 'unknown'}`);
      break;
    default:
      break;
  }
});

async function boot() {
  paintToolbarIcons();
  installRendererErrorReporting();
  state = await window.asperadock.getState();
  render();
  refreshUpdateStatus();
  window.asperadock.onState((next) => {
    state = next;
    render();
    if (menuServiceId && !els.appMenu.classList.contains('hidden')) {
      const service = getServiceById(menuServiceId);
      if (service) {
        els.appMenuTitle.textContent = service.name;
        const cfg = service.config || {};
        els.appMenuEnabled.checked = cfg.enabled !== false;
        els.appMenuSound.checked = cfg.allowSounds !== false;
        els.appMenuNotifications.checked = cfg.allowNotifications !== false;
      }
    }
  });
}

boot();
