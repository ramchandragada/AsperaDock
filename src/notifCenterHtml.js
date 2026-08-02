/** Inline HTML for the floating notification center. */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildNotifCenterHtml(dark = false) {
  const bg = dark ? '#0f172a' : '#ffffff';
  const text = dark ? '#e2e8f0' : '#0f172a';
  const muted = dark ? '#94a3b8' : '#64748b';
  const soft = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.05)';
  const hover = dark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';
  const border = dark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
  const card = dark ? '#1e293b' : '#f8fafc';
  const accent = '#1d4ed8';

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;" />
<style>
  html, body {
    margin: 0; padding: 0; background: transparent; overflow: hidden;
    font: 500 13px/1.4 "Segoe UI", "Ubuntu", "Cantarell", sans-serif;
    color: ${text}; user-select: none;
  }
  .card {
    margin: 6px; width: 400px; height: 560px; max-height: calc(100vh - 24px);
    box-sizing: border-box;
    background: ${bg}; border: 1px solid ${border}; border-radius: 14px;
    box-shadow: 0 16px 48px rgba(15, 23, 42, 0.24);
    padding: 14px 14px 12px;
    display: flex; flex-direction: column; gap: 0; min-height: 0;
  }
  .head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding-bottom: 12px; border-bottom: 1px solid ${border}; flex: 0 0 auto;
  }
  .head-copy { display: grid; gap: 2px; min-width: 0; }
  .head-copy strong { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
  .head-copy span { font-size: 12px; color: ${muted}; font-weight: 500; }
  .links { display: flex; gap: 10px; flex: 0 0 auto; padding-top: 2px; }
  .link {
    border: 0; background: transparent; color: ${accent}; font: inherit;
    font-size: 12px; font-weight: 600; cursor: pointer; padding: 0;
  }
  .link:hover { text-decoration: underline; }

  .body {
    flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px;
    padding: 12px 2px 4px 0; scrollbar-width: thin;
  }
  .list { display: grid; gap: 8px; }
  .empty {
    margin: 0; padding: 28px 16px; border-radius: 10px; background: ${soft};
    color: ${muted}; font-size: 13px; font-weight: 500; text-align: center;
  }

  .notif-item {
    display: grid; gap: 8px; background: ${card}; border: 1px solid ${border};
    border-radius: 12px; padding: 10px;
  }
  .notif-item:hover { border-color: ${dark ? 'rgba(148,163,184,0.28)' : 'rgba(15,23,42,0.16)'}; background: ${hover}; }
  .open-btn {
    border: 0; background: transparent; color: inherit; padding: 0; margin: 0; font: inherit;
    display: grid; grid-template-columns: 40px 1fr; gap: 10px; align-items: start;
    cursor: pointer; text-align: left; width: 100%;
  }
  .open-btn:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; border-radius: 8px; }
  .avatar {
    width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center;
    background: #cbd5e1; color: #0f172a; font-size: 14px; font-weight: 700; overflow: hidden;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .notif-text { display: grid; gap: 3px; min-width: 0; }
  .notif-text strong, .notif-text .body-line {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .notif-text strong { font-size: 13.5px; font-weight: 700; }
  .notif-text .body-line { color: ${muted}; font-size: 12.5px; font-weight: 500; }
  .meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .account, .time { color: ${muted}; font-size: 11.5px; white-space: nowrap; }
  .account { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .actions { display: flex; gap: 6px; }
  .btn {
    border: 1px solid ${border}; background: ${bg}; color: inherit; border-radius: 8px;
    font: 600 11.5px/1 inherit; padding: 7px 10px; cursor: pointer; white-space: nowrap;
  }
  .btn:hover { background: ${soft}; }
  .btn.primary { background: ${accent}; border-color: ${accent}; color: #fff; }
  .btn:disabled { opacity: 0.55; cursor: default; }
  .reply-box { display: none; gap: 6px; }
  .reply-box.open { display: grid; }
  .reply-box textarea {
    width: 100%; min-height: 56px; resize: vertical; box-sizing: border-box;
    border: 1px solid ${border}; border-radius: 8px; padding: 8px 10px;
    font: 500 12.5px/1.4 inherit; color: inherit; background: ${bg};
  }
  .reply-actions { display: flex; gap: 6px; justify-content: flex-end; }
  .status { color: ${muted}; font-size: 11px; min-height: 14px; }

  .monitor {
    display: grid; gap: 8px; padding-top: 10px; border-top: 1px solid ${border}; flex: 0 0 auto;
  }
  .monitor-head {
    font-size: 11px; font-weight: 700; color: ${muted};
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .mrow {
    display: grid; grid-template-columns: 84px 1fr 52px; gap: 8px; align-items: center; font-size: 12px;
  }
  .bar { height: 6px; border-radius: 999px; background: ${soft}; overflow: hidden; }
  .bar > i { display: block; height: 100%; background: ${accent}; border-radius: 999px; }
  .hidden { display: none !important; }
</style>
</head>
<body>
  <div class="card">
    <header class="head">
      <div class="head-copy">
        <strong>Notifications</strong>
        <span>Recent alerts from your apps</span>
      </div>
      <div class="links">
        <button type="button" class="link" id="read-all">Mark all read</button>
        <button type="button" class="link" id="clear">Clear</button>
      </div>
    </header>

    <div class="body">
      <div class="list" id="list"></div>
    </div>

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
        list.innerHTML = '<p class="empty">No new notifications.<br/>Pin important WhatsApp / Arattai chats in the strip above for quick focus.</p>';
      } else {
        list.innerHTML = items.map((item, index) => {
          const initial = esc((item.title || '?').slice(0, 1).toUpperCase());
          const logo = item.logo
            ? '<img src="' + esc(item.logo) + '" alt="" />'
            : initial;
          const account = esc(item.accountLabel || '');
          const reply = item.canReply
            ? '<div class="actions">' +
              '<button type="button" class="btn reply-toggle" data-index="' + index + '">Quick reply</button>' +
              '</div>' +
              '<div class="reply-box" data-reply="' + index + '">' +
              '<textarea maxlength="2000" placeholder="Type a short reply…"></textarea>' +
              '<div class="reply-actions">' +
              '<button type="button" class="btn cancel-reply">Cancel</button>' +
              '<button type="button" class="btn primary send-reply" data-index="' + index + '">Send</button>' +
              '</div><div class="status"></div></div>'
            : '';
          return '<article class="notif-item" data-index="' + index + '">' +
            '<button type="button" class="open-btn" data-index="' + index + '" title="Open">' +
            '<span class="avatar" style="background:' + esc(item.color || '#cbd5e1') + '">' + logo + '</span>' +
            '<span class="notif-text">' +
            '<strong>' + esc(item.title) + '</strong>' +
            '<span class="body-line">' + esc(item.body || '') + '</span>' +
            '<span class="meta">' +
            '<span class="account">' + account + '</span>' +
            '<span class="time">' + esc(relativeTime(item.at)) + '</span>' +
            '</span></span></button>' +
            reply + '</article>';
        }).join('');

        list.querySelectorAll('.open-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const item = items[Number(btn.dataset.index)];
            if (!item) return;
            api.action('activate', {
              serviceId: item.serviceId || '',
              chatName: item.chatName || item.title || '',
              chatKey: item.chatKey || '',
            });
          });
        });
        list.querySelectorAll('.reply-toggle').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const box = list.querySelector('[data-reply="' + btn.dataset.index + '"]');
            if (!box) return;
            const open = box.classList.contains('open');
            list.querySelectorAll('.reply-box').forEach((el) => el.classList.remove('open'));
            if (!open) {
              box.classList.add('open');
              box.querySelector('textarea')?.focus();
            }
          });
        });
        list.querySelectorAll('.cancel-reply').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.closest('.reply-box')?.classList.remove('open');
          });
        });
        list.querySelectorAll('.send-reply').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = items[Number(btn.dataset.index)];
            const box = btn.closest('.reply-box');
            const ta = box?.querySelector('textarea');
            const status = box?.querySelector('.status');
            const text = String(ta?.value || '').trim();
            if (!item || !text) {
              if (status) status.textContent = 'Type a short reply first.';
              return;
            }
            btn.disabled = true;
            if (status) status.textContent = 'Sending…';
            try {
              const result = await api.action('reply', {
                serviceId: item.serviceId || '',
                chatName: item.chatName || item.title || '',
                chatKey: item.chatKey || '',
                text,
              });
              if (status) {
                status.textContent = result?.ok
                  ? 'Sent — review in chat if needed.'
                  : (result?.error || 'Could not send.');
              }
            } catch (err) {
              if (status) status.textContent = String(err?.message || err || 'Failed');
            } finally {
              btn.disabled = false;
            }
          });
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

export { escapeHtml };
