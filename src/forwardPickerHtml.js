/** Floating picker: Forward with Aspera Hub → choose target account. */

export function buildForwardPickerHtml(dark = false) {
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https:;" />
<style>
  html, body {
    margin:0; padding:0; width:100%; height:100%; background:transparent; overflow:hidden;
    font:500 13px/1.4 "Segoe UI","Ubuntu","Cantarell",sans-serif; color:${text}; user-select:none;
  }
  .card {
    margin:4px; width:calc(100% - 8px); height:calc(100% - 8px); box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:12px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:12px;
    display:flex; flex-direction:column; gap:10px; min-height:0;
  }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; flex:0 0 auto; }
  .head strong { font-size:14px; font-weight:700; }
  .meta { color:${muted}; font-size:12px; font-weight:600; margin-top:3px; line-height:1.35; }
  .btn {
    border:0; border-radius:8px; padding:7px 10px; font:inherit; font-size:12px; font-weight:700;
    cursor:pointer; background:${card}; color:inherit;
  }
  .preview {
    flex:0 0 auto; background:${card}; border-radius:10px; padding:10px 12px;
    color:${muted}; font-size:12px; font-weight:600; line-height:1.4;
    max-height:72px; overflow:hidden;
  }
  .label {
    flex:0 0 auto; font-size:11px; font-weight:700; letter-spacing:0.04em;
    text-transform:uppercase; color:${muted};
  }
  .list { flex:1 1 auto; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:6px; }
  .row {
    display:grid; grid-template-columns:32px 1fr; gap:10px; align-items:center;
    border:0; background:${card}; color:inherit; text-align:left; padding:10px;
    border-radius:10px; cursor:pointer; font:inherit;
  }
  .row:hover { background:${hover}; outline:1px solid ${border}; }
  .logo {
    width:32px; height:32px; border-radius:9px; display:grid; place-items:center;
    color:#fff; font-size:12px; font-weight:800; overflow:hidden;
  }
  .logo img { width:100%; height:100%; object-fit:cover; }
  .text { display:grid; gap:2px; min-width:0; }
  .text strong, .text span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .text span { color:${muted}; font-size:12px; font-weight:500; }
  .empty { color:${muted}; font-size:12px; padding:8px 2px; }
  .hint { flex:0 0 auto; color:${muted}; font-size:11px; font-weight:600; line-height:1.35; }
</style>
</head>
<body>
  <div class="card">
    <header class="head">
      <div>
        <strong>Forward with Aspera Hub</strong>
        <div class="meta" id="meta">Choose an account</div>
      </div>
      <button type="button" class="btn" id="close">Close</button>
    </header>
    <div class="preview" id="preview">Preparing…</div>
    <div class="label">Send to account</div>
    <div class="list" id="list"></div>
    <div class="hint">Hub stages the content — open the chat, then send (or paste with Ctrl+V).</div>
  </div>
  <script>
    const api = window.forwardPickerApi;
    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    api.onInit((data) => {
      document.getElementById('meta').textContent = data?.sourceLabel
        ? ('From ' + data.sourceLabel)
        : 'Choose an account';
      document.getElementById('preview').textContent = data?.preview || 'Selected content';
      const list = document.getElementById('list');
      const targets = data?.targets || [];
      if (!targets.length) {
        list.innerHTML = '<p class="empty">Add another WhatsApp or Arattai account to forward across accounts.</p>';
        return;
      }
      list.innerHTML = targets.map((t) => {
        const initial = esc((t.name || t.appName || '?').slice(0, 1).toUpperCase());
        const logo = t.logoDataUrl
          ? '<img src="' + esc(t.logoDataUrl) + '" alt="" />'
          : initial;
        return '<button type="button" class="row" data-id="' + esc(t.id) + '">' +
          '<span class="logo" style="background:' + esc(t.color || '#64748b') + '">' + logo + '</span>' +
          '<span class="text"><strong>' + esc(t.name || t.appName || 'App') + '</strong>' +
          '<span>' + esc(t.appName || '') + (t.profileName ? ' · ' + esc(t.profileName) : '') + '</span></span></button>';
      }).join('');
      list.querySelectorAll('.row').forEach((btn) => {
        btn.addEventListener('click', () => api.pick(btn.dataset.id || ''));
      });
    });
    document.getElementById('close').onclick = () => api.close();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
