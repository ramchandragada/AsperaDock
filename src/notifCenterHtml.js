/** Inline HTML for the floating notification center. */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildNotifCenterHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const hover = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;" />
<style>
  html, body { margin:0; padding:0; background:transparent; overflow:hidden; font:500 13px/1.35 "Segoe UI","Ubuntu","Cantarell",sans-serif; color:${text}; user-select:none; }
  .card {
    margin:4px; width:340px; max-height:520px; box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:12px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:10px; display:grid; gap:8px;
  }
  .head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .head strong { font-size:14px; }
  .links { display:flex; gap:8px; }
  .link { border:0; background:transparent; color:#2563eb; font:inherit; font-size:12px; font-weight:600; cursor:pointer; padding:0; }
  .list { display:grid; gap:6px; max-height:360px; overflow:auto; }
  .empty { margin:8px 0; color:${muted}; font-size:12px; }
  .row {
    display:grid; grid-template-columns:28px 1fr auto; gap:8px; align-items:center;
    border:0; background:${card}; color:inherit; text-align:left; padding:8px; border-radius:10px; cursor:pointer; font:inherit;
  }
  .row:hover { filter:brightness(0.98); outline:1px solid ${border}; }
  .logo {
    width:28px; height:28px; border-radius:8px; display:grid; place-items:center;
    background:#e2e8f0; color:#0f172a; font-size:12px; font-weight:700; overflow:hidden;
  }
  .logo img { width:100%; height:100%; object-fit:cover; }
  .text { display:grid; gap:2px; min-width:0; }
  .text strong, .text span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .text span { color:${muted}; font-size:12px; font-weight:500; }
  .time { color:${muted}; font-size:11px; white-space:nowrap; }
  .monitor { display:grid; gap:6px; padding-top:4px; border-top:1px solid ${border}; }
  .monitor-head { font-size:11px; font-weight:700; color:${muted}; text-transform:uppercase; letter-spacing:0.04em; }
  .mrow { display:grid; grid-template-columns:72px 1fr 52px; gap:8px; align-items:center; font-size:12px; }
  .bar { height:6px; border-radius:999px; background:${hover}; overflow:hidden; }
  .bar > i { display:block; height:100%; background:#2563eb; border-radius:999px; }
  .hidden { display:none !important; }
</style>
</head>
<body>
  <div class="card">
    <header class="head">
      <strong>Notifications</strong>
      <div class="links">
        <button type="button" class="link" id="read-all">Mark all read</button>
        <button type="button" class="link" id="clear">Clear</button>
      </div>
    </header>
    <div class="list" id="list"></div>
    <div class="monitor hidden" id="monitor">
      <div class="monitor-head">Memory per app</div>
      <div id="monitor-list"></div>
    </div>
  </div>
  <script>
    const api = window.notifCenterApi;
    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function relativeTime(at) {
      const diff = Math.max(0, Date.now() - (at || 0));
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + 'h ago';
      return Math.floor(hours / 24) + 'd ago';
    }
    function paint(data) {
      const list = document.getElementById('list');
      const items = data?.notifications || [];
      if (!items.length) {
        list.innerHTML = '<p class="empty">No new notifications</p>';
      } else {
        list.innerHTML = items.map((item) => {
          const initial = esc((item.title || '?').slice(0, 1));
          const logo = item.logo
            ? '<img src="' + esc(item.logo) + '" alt="" />'
            : initial;
          return '<button type="button" class="row" data-id="' + esc(item.serviceId || '') + '">' +
            '<span class="logo" style="background:' + esc(item.color || '#e2e8f0') + '">' + logo + '</span>' +
            '<span class="text"><strong>' + esc(item.title) + '</strong><span>' + esc(item.body) + '</span></span>' +
            '<span class="time">' + esc(relativeTime(item.at)) + '</span></button>';
        }).join('');
        list.querySelectorAll('.row').forEach((btn) => {
          btn.addEventListener('click', () => api.action('activate', btn.dataset.id || null));
        });
      }
      const monitor = document.getElementById('monitor');
      const monitorList = document.getElementById('monitor-list');
      const rows = data?.memoryRows || [];
      if (!data?.monitorOn || !rows.length) {
        monitor.classList.add('hidden');
        monitorList.innerHTML = '';
        return;
      }
      monitor.classList.remove('hidden');
      const peak = rows[0].mb || 1;
      monitorList.innerHTML = rows.map((row) => {
        const pct = Math.max(6, Math.round((row.mb / peak) * 100));
        return '<div class="mrow"><span>' + esc(row.name) + '</span>' +
          '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
          '<span>' + esc(row.mb) + ' MB</span></div>';
      }).join('');
    }
    api.onInit(paint);
    document.getElementById('read-all').onclick = () => api.action('read-all');
    document.getElementById('clear').onclick = () => api.action('clear');
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}

// Keep escapeHtml exported for tests / reuse if needed.
export { escapeHtml };
