/** Inline HTML for the floating chrome (Aspera) menu. */

function svg(path) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const ICO = {
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
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
  ram: svg(
    '<rect x="4" y="4" width="16" height="16" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>',
  ),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  sync: svg(
    '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3.5V9h-5.5"/><path d="M3 20.5V15h5.5"/>',
  ),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>'),
};

function item(action, icon, label) {
  return `<button type="button" class="item" data-action="${action}"><span class="ico">${icon}</span>${label}</button>`;
}

export function buildChromeMenuHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const hover = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body { margin:0; padding:0; background:transparent; overflow:hidden; font:500 13px/1.3 "Segoe UI","Ubuntu","Cantarell",sans-serif; color:${text}; user-select:none; }
  .card {
    margin:4px; width:210px; box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:12px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:6px; display:grid; gap:2px;
  }
  .item {
    display:flex; align-items:center; gap:10px; border:0; background:transparent;
    color:inherit; text-align:left; padding:9px 10px; border-radius:8px; cursor:pointer; font:inherit;
  }
  .item:hover { background:${hover}; }
  .ico { width:18px; height:18px; display:grid; place-items:center; color:${muted}; }
  hr { border:none; border-top:1px solid ${border}; margin:4px 0; }
  .ver { padding:6px 10px 4px; font-size:11px; font-weight:600; color:${muted}; }
</style>
</head>
<body>
  <div class="card">
    ${item('settings', ICO.settings, 'Settings')}
    ${item('profiles', ICO.users, 'Profiles')}
    ${item('shortcuts', ICO.keyboard, 'Shortcuts')}
    <hr />
    ${item('reload', ICO.reload, 'Reload app')}
    ${item('home', ICO.home, 'Go to app home')}
    ${item('free-ram', ICO.ram, 'Free RAM')}
    <hr />
    ${item('add-app', ICO.plus, 'Add app')}
    <hr />
    ${item('check-updates', ICO.sync, 'Check for updates')}
    ${item('about', ICO.info, 'About')}
    <div class="ver" id="version">Aspera Hub</div>
  </div>
  <script>
    const api = window.chromeMenuApi;
    api.onInit((data) => {
      const el = document.getElementById('version');
      if (el && data?.versionLabel) el.textContent = data.versionLabel;
    });
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => api.action(btn.dataset.action));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
