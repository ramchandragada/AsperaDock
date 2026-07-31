/** Chrome-like floating Extensions manager for guest apps (WhatsApp, etc.). */

export function buildExtensionsHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  const hover = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body { margin:0; padding:0; width:100%; height:100%; background:transparent; overflow:hidden;
    font:500 13px/1.4 "Segoe UI","Ubuntu","Cantarell",sans-serif; color:${text}; user-select:none; }
  .panel {
    margin:4px; width:calc(100% - 8px); height:calc(100% - 8px); box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:14px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); display:flex; flex-direction:column; min-height:0;
  }
  .head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px 8px; flex:0 0 auto; }
  .head h1 { margin:0; font-size:15px; font-weight:700; }
  .head .sub { margin:2px 0 0; font-size:11px; color:${muted}; font-weight:600; }
  .btn {
    border:0; border-radius:8px; padding:7px 10px; font:inherit; font-size:12px; font-weight:700;
    cursor:pointer; background:${card}; color:inherit;
  }
  .btn.primary { background:#2563eb; color:#fff; }
  .btn:disabled { opacity:0.55; cursor:default; }
  .actions { display:flex; gap:6px; flex-wrap:wrap; }
  .hint { padding:0 14px 8px; color:${muted}; font-size:12px; font-weight:500; flex:0 0 auto; }
  .list { flex:1 1 auto; min-height:0; overflow:auto; padding:4px 10px 12px; display:grid; gap:8px; align-content:start; }
  .empty { padding:24px 12px; text-align:center; color:${muted}; font-size:13px; }
  .row {
    display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center;
    padding:10px 12px; border-radius:10px; background:${card}; border:1px solid ${border};
  }
  .row:hover { background:${hover}; }
  .name { font-weight:700; font-size:13px; }
  .meta { color:${muted}; font-size:11px; margin-top:2px; }
  .desc { color:${muted}; font-size:12px; margin-top:4px; max-width:320px; }
  .row-actions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .err { color:#b91c1c; padding:0 14px 8px; font-size:12px; font-weight:600; }
  .foot { padding:8px 14px 12px; border-top:1px solid ${border}; display:flex; gap:8px; flex-wrap:wrap; flex:0 0 auto; }
</style>
</head>
<body>
  <div class="panel">
    <header class="head">
      <div>
        <h1>Extensions</h1>
        <p class="sub">Chrome extensions for WhatsApp, Arattai, and other apps</p>
      </div>
      <div class="actions">
        <button type="button" class="btn" id="close">Close</button>
      </div>
    </header>
    <p class="hint">
      Load an <strong>unpacked</strong> Chrome extension folder (must contain <code>manifest.json</code>).
      Example: WARocket exported/unpacked from Chrome. Extensions run in guest app sessions — not the Hub chrome.
    </p>
    <div class="err" id="error" hidden></div>
    <div class="list" id="list"><div class="empty">No extensions installed yet.</div></div>
    <footer class="foot">
      <button type="button" class="btn primary" id="load">Load unpacked</button>
      <button type="button" class="btn" id="reload">Reload apps</button>
    </footer>
  </div>
  <script>
    const api = window.extensionsApi;
    const listEl = document.getElementById('list');
    const errorEl = document.getElementById('error');

    function showError(msg) {
      if (!msg) { errorEl.hidden = true; errorEl.textContent = ''; return; }
      errorEl.hidden = false;
      errorEl.textContent = String(msg);
    }

    function render(data) {
      showError(data?.error || '');
      const items = Array.isArray(data?.extensions) ? data.extensions : [];
      listEl.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No extensions installed yet.';
        listEl.appendChild(empty);
        return;
      }
      for (const ext of items) {
        const row = document.createElement('div');
        row.className = 'row';
        const info = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = ext.name || 'Extension';
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = [
          ext.version ? 'v' + ext.version : '',
          ext.enabled ? 'Enabled' : 'Disabled',
          ext.exists === false ? 'Missing files' : '',
        ].filter(Boolean).join(' · ');
        info.append(name, meta);
        if (ext.description) {
          const desc = document.createElement('div');
          desc.className = 'desc';
          desc.textContent = ext.description;
          info.appendChild(desc);
        }
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn';
        toggle.textContent = ext.enabled ? 'Disable' : 'Enable';
        toggle.onclick = () => api.setEnabled(ext.id, !ext.enabled);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn';
        remove.textContent = 'Remove';
        remove.onclick = () => {
          if (confirm('Remove ' + (ext.name || 'this extension') + '?')) api.remove(ext.id);
        };
        actions.append(toggle, remove);
        row.append(info, actions);
        listEl.appendChild(row);
      }
    }

    api.onInit(render);
    document.getElementById('close').onclick = () => api.close();
    document.getElementById('load').onclick = () => api.loadUnpacked();
    document.getElementById('reload').onclick = () => api.reloadGuests();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
