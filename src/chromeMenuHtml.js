/**
 * Floating chrome (Aspera) menu — structured like GNOME / Windows / Apple HIG:
 * related groups of 2–5 items, separators between groups, frequent actions first,
 * Settings / Shortcuts / About / Updates near the bottom.
 */

function svg(path) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const ICO = {
  search: svg('<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.4-4.4"/>'),
  focus: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  mute: svg(
    '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  ),
  unmute: svg(
    '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  ),
  /** Preferences / Settings — sliders (not the same glyph as AI settings). */
  settings: svg(
    '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  ),
  users: svg(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  ),
  keyboard: svg(
    '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h4M16 14h.01M18 14h.01"/>',
  ),
  reload: svg(
    '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3.5V9h-5.5"/><path d="M3 20.5V15h5.5"/>',
  ),
  home: svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-5h4v5h5V10"/>'),
  back: svg('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),
  forward: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  ram: svg(
    '<rect x="4" y="4" width="16" height="16" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>',
  ),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  lock: svg(
    '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  ),
  /** Updates — download arrow (distinct from reload). */
  updates: svg(
    '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  ),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>'),
  spark: svg(
    '<path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m16.3 7.7 2.1-2.1"/><path d="m5.6 18.4 2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  ),
  list: svg(
    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  ),
  /** AI settings — sparkle+gear hybrid feel without reusing Settings glyph. */
  aiSettings: svg(
    '<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="M18.5 14.5 19 16l1.5.5L19 17l-.5 1.5L18 17l-1.5-.5L18 16l.5-1.5Z"/><path d="M5 15.5 5.4 16.8 6.7 17.2 5.4 17.6 5 18.9 4.6 17.6 3.3 17.2 4.6 16.8 5 15.5Z"/>',
  ),
  puzzle: svg(
    '<path d="M12 2a2.5 2.5 0 0 1 2.5 2.5V6h2a2 2 0 0 1 2 2v2.1a2.4 2.4 0 1 0 0 3.8V16a2 2 0 0 1-2 2h-2.1a2.4 2.4 0 1 0-3.8 0H8a2 2 0 0 1-2-2v-2.1a2.4 2.4 0 1 0 0-3.8V8a2 2 0 0 1 2-2h2V4.5A2.5 2.5 0 0 1 12 2Z"/>',
  ),
  link: svg(
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ),
};

/** Stable action order for tests / docs (floating menu). */
export const CHROME_MENU_SECTIONS = [
  {
    id: 'presence',
    title: 'Presence',
    items: [
      { action: 'web-search', label: 'Web search' },
      { action: 'search', label: 'Quick search' },
      { action: 'focus', label: 'Focus mode', id: 'focus-item' },
      { action: 'mute', label: 'Mute', id: 'mute-item' },
    ],
  },
  {
    id: 'ai',
    title: 'Aspera AI',
    items: [
      { action: 'aspera-ai', label: 'Aspera AI…' },
      { action: 'catch-up', label: 'Catch me up' },
      { action: 'ai-settings', label: 'AI settings' },
    ],
  },
  {
    id: 'app',
    title: 'Current app',
    items: [
      { action: 'back', label: 'Back' },
      { action: 'forward', label: 'Forward' },
      { action: 'reload', label: 'Reload' },
      { action: 'home', label: 'Go to home' },
      { action: 'free-ram', label: 'Free RAM' },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    items: [
      { action: 'add-app', label: 'Add app' },
      { action: 'profiles', label: 'Profiles' },
      { action: 'extensions', label: 'Extensions' },
    ],
  },
  {
    id: 'security',
    title: '',
    items: [{ action: 'lock', label: 'Lock Hub' }],
  },
  {
    id: 'system',
    title: '',
    items: [
      { action: 'settings', label: 'Settings' },
      { action: 'shortcuts', label: 'Keyboard shortcuts' },
      { action: 'check-updates', label: 'Check for updates' },
      { action: 'website', label: 'asperahub.com' },
      { action: 'about', label: 'About Aspera Hub' },
    ],
  },
];

const ACTION_ICON = {
  'web-search': ICO.search,
  search: ICO.search,
  focus: ICO.focus,
  mute: ICO.unmute,
  'catch-up': ICO.list,
  'aspera-ai': ICO.spark,
  summarize: ICO.spark,
  'ai-settings': ICO.aiSettings,
  reload: ICO.reload,
  back: ICO.back,
  forward: ICO.forward,
  home: ICO.home,
  'free-ram': ICO.ram,
  'add-app': ICO.plus,
  profiles: ICO.users,
  extensions: ICO.puzzle,
  lock: ICO.lock,
  settings: ICO.settings,
  shortcuts: ICO.keyboard,
  'check-updates': ICO.updates,
  website: ICO.link,
  about: ICO.info,
};

function item(action, icon, label, id = '') {
  const idAttr = id ? ` id="${id}"` : '';
  return `<button type="button" class="item" role="menuitem" data-action="${action}"${idAttr}><span class="ico">${icon}</span><span class="label">${label}</span></button>`;
}

function sectionHtml(section) {
  const title = section.title
    ? `<div class="section-title" aria-hidden="true">${section.title}</div>`
    : '';
  const buttons = section.items
    .map((entry) =>
      item(
        entry.action,
        ACTION_ICON[entry.action] || ICO.info,
        entry.label,
        entry.id || '',
      ),
    )
    .join('');
  return `<div class="section" role="group"${section.title ? ` aria-label="${section.title}"` : ''}>${title}${buttons}</div>`;
}

export function buildChromeMenuHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const hover = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const sections = CHROME_MENU_SECTIONS.map(sectionHtml).join('<hr />');

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body { margin:0; padding:0; background:transparent; overflow:hidden; font:500 13px/1.35 system-ui,"Segoe UI","Ubuntu","Cantarell",sans-serif; color:${text}; user-select:none; }
  .card {
    margin:4px; width:248px; max-height:calc(100vh - 16px); box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:12px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:6px 6px 4px;
    overflow-y:auto; overscroll-behavior:contain;
  }
  .section { display:grid; gap:1px; }
  .section-title {
    padding:7px 10px 3px; font-size:10px; font-weight:700; letter-spacing:0.06em;
    text-transform:uppercase; color:${muted}; opacity:0.92;
  }
  .item {
    display:flex; align-items:center; gap:10px; border:0; background:transparent;
    color:inherit; text-align:left; padding:8px 10px; border-radius:8px; cursor:pointer; font:inherit;
    width:100%;
  }
  .item:hover, .item:focus-visible { background:${hover}; outline:none; }
  .ico { width:18px; height:18px; display:grid; place-items:center; color:${muted}; flex:0 0 auto; }
  .label { min-width:0; }
  hr { border:none; border-top:1px solid ${border}; margin:4px 2px; }
  .ver {
    padding:8px 10px 6px; font-size:11px; font-weight:600; color:${muted};
    border-top:1px solid ${border}; margin-top:2px;
  }
  .ver .site { display:block; margin-top:2px; font-weight:500; opacity:0.9; }
</style>
</head>
<body>
  <div class="card" role="menu" aria-label="Aspera Hub menu">
    ${sections}
    <div class="ver" id="version">Aspera Hub<span class="site">asperahub.com</span></div>
  </div>
  <script>
    const api = window.chromeMenuApi;
    const muteIcoOn = ${JSON.stringify(ICO.mute)};
    const muteIcoOff = ${JSON.stringify(ICO.unmute)};
    function applyState(data) {
      const ver = document.getElementById('version');
      if (ver && data?.versionLabel) {
        ver.innerHTML = data.versionLabel + '<span class="site">asperahub.com</span>';
      }
      const focus = document.getElementById('focus-item');
      if (focus) {
        const label = focus.querySelector('.label');
        if (label) label.textContent = data?.focusMode ? 'Focus mode on' : 'Focus mode';
      }
      const mute = document.getElementById('mute-item');
      if (mute) {
        const label = mute.querySelector('.label');
        const ico = mute.querySelector('.ico');
        if (label) label.textContent = data?.muted ? 'Unmute' : 'Mute';
        if (ico) ico.innerHTML = data?.muted ? muteIcoOn : muteIcoOff;
      }
    }
    api.onInit(applyState);
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => api.action(btn.dataset.action));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
