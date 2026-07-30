/** Floating result panel for Aspera AI skills. */

export function buildAiResultHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body { margin:0; padding:0; background:transparent; overflow:hidden; font:500 13px/1.45 "Segoe UI","Ubuntu","Cantarell",sans-serif; color:${text}; user-select:text; }
  .card {
    margin:4px; width:420px; max-height:560px; box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:14px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:12px; display:grid; gap:10px;
  }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
  .head strong { font-size:14px; }
  .meta { color:${muted}; font-size:11px; font-weight:600; margin-top:2px; }
  .actions { display:flex; gap:6px; flex-wrap:wrap; }
  .btn {
    border:0; border-radius:8px; padding:7px 10px; font:inherit; font-size:12px; font-weight:700;
    cursor:pointer; background:${card}; color:inherit;
  }
  .btn.primary { background:#2563eb; color:#fff; }
  .btn:disabled { opacity:0.55; cursor:default; }
  .body {
    background:${card}; border-radius:10px; padding:10px 12px; min-height:120px; max-height:420px;
    overflow:auto; white-space:pre-wrap; word-break:break-word; font-weight:500;
  }
  .body.error { color:#b91c1c; }
  .body.loading { color:${muted}; }
</style>
</head>
<body>
  <div class="card">
    <header class="head">
      <div>
        <strong id="title">Aspera AI</strong>
        <div class="meta" id="meta"></div>
      </div>
      <div class="actions">
        <button type="button" class="btn primary" id="copy" disabled>Copy</button>
        <button type="button" class="btn" id="close">Close</button>
      </div>
    </header>
    <div class="body loading" id="body">Working…</div>
  </div>
  <script>
    const api = window.aiResultApi;
    const body = document.getElementById('body');
    const copyBtn = document.getElementById('copy');
    let latest = '';
    api.onInit((data) => {
      document.getElementById('title').textContent = data?.title || 'Aspera AI';
      document.getElementById('meta').textContent = data?.meta || '';
      latest = String(data?.text || '');
      body.className = 'body' + (data?.error ? ' error' : data?.loading ? ' loading' : '');
      body.textContent = latest || (data?.error ? String(data.error) : '…');
      copyBtn.disabled = !latest || !!data?.error || !!data?.loading;
    });
    copyBtn.onclick = async () => {
      if (!latest) return;
      await api.copy(latest);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
    };
    document.getElementById('close').onclick = () => api.close();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
