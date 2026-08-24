/** Inline HTML for the Chrome-like recent download shelf. */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fileIcon(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return '📄';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜';
  if (['doc', 'docx', 'odt'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '📊';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return '🎬';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return '🎵';
  return '📁';
}

export function buildDownloadShelfHtml(dark = false) {
  const bg = dark ? '#0f172a' : '#ffffff';
  const text = dark ? '#e2e8f0' : '#0f172a';
  const muted = dark ? '#94a3b8' : '#64748b';
  const soft = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.05)';
  const hover = dark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';
  const border = dark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
  const accent = '#1d4ed8';

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body {
    margin: 0; padding: 0; background: transparent; overflow: hidden;
    font: 500 13px/1.4 "Segoe UI", "Ubuntu", "Cantarell", sans-serif;
    color: ${text}; user-select: none;
  }
  .card {
    margin: 6px; width: 380px; max-height: calc(100vh - 24px); box-sizing: border-box;
    background: ${bg}; border: 1px solid ${border}; border-radius: 12px;
    box-shadow: 0 16px 48px rgba(15, 23, 42, 0.24);
    display: flex; flex-direction: column; min-height: 0;
  }
  .head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 14px 10px; border-bottom: 1px solid ${border}; flex: 0 0 auto;
  }
  .head strong { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
  .close {
    border: 0; background: transparent; color: ${muted}; font-size: 18px; line-height: 1;
    cursor: pointer; padding: 2px 6px; border-radius: 6px;
  }
  .close:hover { background: ${soft}; color: ${text}; }
  .body {
    flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px 0;
    scrollbar-width: thin;
  }
  .row {
    display: grid; grid-template-columns: 1fr auto; align-items: center;
  }
  .empty {
    margin: 0; padding: 28px 18px; color: ${muted}; font-size: 13px; text-align: center;
  }
  .item {
    display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center;
    width: 100%; border: 0; background: transparent; color: inherit; text-align: left;
    padding: 10px 14px; cursor: pointer; font: inherit;
  }
  .item:hover:not(:disabled) { background: ${hover}; }
  .item:disabled { opacity: 0.55; cursor: default; }
  .item[draggable="true"] { cursor: grab; }
  .item[draggable="true"]:active { cursor: grabbing; }
  .ico { font-size: 18px; line-height: 1; text-align: center; }
  .copy { min-width: 0; display: grid; gap: 2px; }
  .name {
    font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta { font-size: 12px; color: ${muted}; }
  .prog {
    height: 3px; border-radius: 999px; background: ${soft}; overflow: hidden; margin-top: 4px;
  }
  .prog > i {
    display: block; height: 100%; background: ${accent}; border-radius: 999px; width: 0%;
    transition: width 0.15s ease;
  }
  .action {
    border: 0; background: transparent; color: ${muted}; cursor: pointer;
    padding: 4px; border-radius: 6px; font-size: 14px; line-height: 1;
  }
  .action:hover { background: ${soft}; color: ${text}; }
  .foot {
    border-top: 1px solid ${border}; padding: 10px 14px 12px; flex: 0 0 auto;
  }
  .foot-btn {
    border: 0; background: transparent; color: ${accent}; font: inherit;
    font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .foot-btn:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="card">
    <header class="head">
      <strong>Recent download history</strong>
      <button type="button" class="close" id="close" title="Close" aria-label="Close">×</button>
    </header>
    <div class="body" id="list"></div>
    <footer class="foot">
      <button type="button" class="foot-btn" id="open-folder">
        Full download history
        <span aria-hidden="true">↗</span>
      </button>
    </footer>
  </div>
  <script>
    const api = window.downloadShelfApi;
    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtBytes(n) {
      n = Number(n) || 0;
      if (n < 1024) return n + ' B';
      if (n < 1048576) return Math.round(n / 1024) + ' KB';
      if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
      return (n / 1073741824).toFixed(1) + ' GB';
    }
    function relativeTime(at) {
      const diff = Math.max(0, Date.now() - (at || 0));
      const secs = Math.floor(diff / 1000);
      if (secs < 60) return 'Just now';
      const mins = Math.floor(secs / 60);
      if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
      const days = Math.floor(hours / 24);
      return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    }
    function iconFor(name) {
      const ext = String(name || '').split('.').pop().toLowerCase();
      if (ext === 'pdf') return '📄';
      if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return '🖼';
      if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜';
      if (['doc','docx','odt'].includes(ext)) return '📝';
      if (['xls','xlsx','csv','ods'].includes(ext)) return '📊';
      if (['mp4','webm','mov','mkv'].includes(ext)) return '🎬';
      if (['mp3','wav','ogg','m4a'].includes(ext)) return '🎵';
      return '📁';
    }
    function paint(data) {
      const root = document.getElementById('list');
      const items = data?.downloads || [];
      if (!items.length) {
        root.innerHTML = '<p class="empty">No downloads yet.<br/>Files you save from WhatsApp, Gmail, Zoho, and other Hub apps appear here.</p>';
        return;
      }
      root.innerHTML = items.map((item) => {
        const progressing = item.state === 'progressing';
        const missing = item.state === 'completed' && item.exists === false;
        const meta = progressing
          ? (item.totalBytes
            ? fmtBytes(item.receivedBytes || item.bytes || 0) + ' / ' + fmtBytes(item.totalBytes)
            : 'Downloading…')
          : fmtBytes(item.bytes || 0) + ' • ' + relativeTime(item.at);
        const prog = progressing && item.progress != null
          ? '<div class="prog"><i style="width:' + item.progress + '%"></i></div>'
          : '';
        const folderBtn = !progressing && item.path
          ? '<button type="button" class="action show-folder" data-id="' + esc(item.id) + '" title="Show in folder">📂</button>'
          : '';
        const canDrag = !progressing && !missing && item.path;
        return '<div class="row">' +
          '<button type="button" class="item open-item" data-id="' + esc(item.id) + '"' +
          (progressing || missing ? ' disabled' : '') +
          (canDrag ? ' draggable="true" title="Open · or drag to Desktop / folder"' : '') + '>' +
          '<span class="ico">' + iconFor(item.name) + '</span>' +
          '<span class="copy"><span class="name">' + esc(item.name) + '</span>' +
          '<span class="meta">' + esc(meta) + (missing ? ' • File moved' : '') + '</span>' +
          prog + '</span></button>' +
          folderBtn + '</div>';
      }).join('');
    }
    document.getElementById('close').addEventListener('click', () => api.close());
    document.getElementById('open-folder').addEventListener('click', () => api.action('open-folder'));
    document.getElementById('list').addEventListener('click', (event) => {
      const openBtn = event.target.closest('.open-item');
      if (openBtn && !openBtn.disabled) {
        api.action('open', openBtn.dataset.id);
        return;
      }
      const folderBtn = event.target.closest('.show-folder');
      if (folderBtn) api.action('show-in-folder', folderBtn.dataset.id);
    });
    document.getElementById('list').addEventListener('dragstart', (event) => {
      const openBtn = event.target.closest('.open-item');
      if (!openBtn || openBtn.disabled || !openBtn.dataset.id) {
        event.preventDefault();
        return;
      }
      // Electron takes over the OS drag via main-process startDrag.
      event.preventDefault();
      api.startFileDrag?.(openBtn.dataset.id);
    });
    api.onInit((data) => paint(data));
  </script>
</body>
</html>`;
}
