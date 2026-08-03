/** Inline HTML for the floating app context menu (child BrowserWindow). */

function svg(path) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const ICO = {
  home: svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-5h4v5h5V10"/>'),
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  ),
  sync: svg(
    '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3.5V9h-5.5"/><path d="M3 20.5V15h5.5"/>',
  ),
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
};

export function buildAppMenuHtml(dark = false) {
  const theme = dark ? 'dark' : 'light';
  return `<!doctype html>
<html class="${theme}">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none';" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    overflow: hidden;
    font: 600 13px/1.3 "Segoe UI", "Ubuntu", "Cantarell", sans-serif;
    color: ${dark ? '#e5e7eb' : '#0f172a'};
    user-select: none;
  }
  .card {
    margin: 4px;
    width: 220px;
    box-sizing: border-box;
    background: ${dark ? '#111827' : '#f3f4f6'};
    border: 1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)'};
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22);
    padding: 10px;
    display: grid;
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 2px 6px;
  }
  .head strong {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions { display: flex; gap: 2px; }
  .icon-btn {
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .icon-btn:hover { background: ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}; }
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    background: ${dark ? '#1f2937' : '#fff'};
    cursor: pointer;
  }
  .toggle input {
    appearance: none;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: ${dark ? '#4b5563' : '#d1d5db'};
    position: relative;
    outline: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .toggle input::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s ease;
  }
  .toggle input:checked { background: #2563eb; }
  .toggle input:checked::after { transform: translateX(16px); }
  .danger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    padding: 9px 12px;
    border: 0;
    border-radius: 10px;
    background: ${dark ? 'rgba(220,38,38,0.18)' : 'rgba(220,38,38,0.1)'};
    color: ${dark ? '#fca5a5' : '#b91c1c'};
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
  }
  .danger:hover { background: ${dark ? 'rgba(220,38,38,0.28)' : 'rgba(220,38,38,0.16)'}; }
  .danger svg { flex-shrink: 0; }
</style>
</head>
<body>
  <div class="card" id="card">
    <div class="head">
      <strong id="title">App</strong>
      <div class="actions">
        <button type="button" class="icon-btn" id="home" title="Go to app home">${ICO.home}</button>
        <button type="button" class="icon-btn" id="edit" title="Edit settings">${ICO.settings}</button>
        <button type="button" class="icon-btn" id="reload" title="Reload">${ICO.sync}</button>
      </div>
    </div>
    <label class="toggle"><span>Enabled</span><input id="enabled" type="checkbox" /></label>
    <label class="toggle"><span>Sound</span><input id="sound" type="checkbox" /></label>
    <label class="toggle"><span>Notifications</span><input id="notifications" type="checkbox" /></label>
    <label class="toggle"><span>Keep warm in memory</span><input id="warm" type="checkbox" /></label>
    <button type="button" class="danger" id="close-tab">${ICO.close}<span id="close-label">Close tab</span></button>
  </div>
  <script>
    const api = window.appMenuApi;
    function bindToggle(id, type) {
      const el = document.getElementById(id);
      el.addEventListener('change', () => api.action(type, el.checked));
    }
    api.onInit((data) => {
      document.getElementById('title').textContent = data.name || 'App';
      document.getElementById('enabled').checked = !!data.enabled;
      document.getElementById('sound').checked = !!data.sound;
      document.getElementById('notifications').checked = !!data.notifications;
      document.getElementById('warm').checked = !!data.warm;
      const closeLabel = document.getElementById('close-label');
      if (closeLabel) {
        closeLabel.textContent =
          data.linkTab || data.isCustom ? 'Close tab' : 'Remove app';
      }
    });
    document.getElementById('home').onclick = () => api.action('home');
    document.getElementById('edit').onclick = () => api.action('edit');
    document.getElementById('reload').onclick = () => api.action('reload');
    document.getElementById('close-tab').onclick = () => api.action('close');
    bindToggle('enabled', 'enabled');
    bindToggle('sound', 'sound');
    bindToggle('notifications', 'notifications');
    bindToggle('warm', 'warm');
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') api.close();
    });
  </script>
</body>
</html>`;
}
