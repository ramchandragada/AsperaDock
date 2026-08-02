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
    margin:4px; width:380px; max-height:620px; box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:12px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:10px; display:grid; gap:8px;
  }
  .head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .head strong { font-size:14px; }
  .links { display:flex; gap:8px; }
  .link { border:0; background:transparent; color:#2563eb; font:inherit; font-size:12px; font-weight:600; cursor:pointer; padding:0; }
  .section-head {
    display:flex; align-items:baseline; justify-content:space-between; gap:8px;
    font-size:11px; font-weight:700; color:${muted}; text-transform:uppercase; letter-spacing:0.04em;
    padding-top:2px;
  }
  .section-head .count {
    text-transform:none; letter-spacing:0; font-weight:600; color:${muted};
  }
  .inbox-list { display:grid; gap:6px; max-height:180px; overflow:auto; }
  .inbox-row {
    display:grid; grid-template-columns:28px 1fr auto; gap:8px; align-items:center;
    border:0; background:${card}; color:inherit; text-align:left; padding:8px; border-radius:10px; font:inherit;
    cursor:pointer; width:100%;
  }
  .inbox-row:hover { filter:brightness(0.98); outline:1px solid ${border}; }
  .inbox-badge {
    min-width:18px; padding:0 6px; border-radius:999px; background:#dc2626; color:#fff;
    font-size:10px; font-weight:700; line-height:18px; text-align:center;
  }
  .inbox-pin {
    border:1px solid ${border}; background:${bg}; color:inherit; border-radius:8px;
    font:600 11px/1 inherit; padding:5px 8px; cursor:pointer;
  }
  .list { display:grid; gap:6px; max-height:280px; overflow:auto; }
  .empty { margin:4px 0 8px; color:${muted}; font-size:12px; }
  .row {
    display:grid; grid-template-columns:28px 1fr; gap:8px; align-items:start;
    border:0; background:${card}; color:inherit; text-align:left; padding:8px; border-radius:10px; font:inherit;
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
  .meta { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:2px; }
  .time { color:${muted}; font-size:11px; white-space:nowrap; }
  .open-btn {
    border:0; background:transparent; color:inherit; padding:0; margin:0; font:inherit;
    display:grid; grid-template-columns:28px 1fr; gap:8px; align-items:start; cursor:pointer; text-align:left; width:100%;
  }
  .actions { display:flex; gap:6px; margin-top:6px; }
  .btn {
    border:1px solid ${border}; background:${bg}; color:inherit; border-radius:8px;
    font:600 11px/1 inherit; padding:5px 8px; cursor:pointer;
  }
  .btn.primary { background:#2563eb; border-color:#2563eb; color:#fff; }
  .btn:disabled { opacity:0.5; cursor:default; }
  .reply-box { display:none; gap:6px; margin-top:6px; }
  .reply-box.open { display:grid; }
  .reply-box textarea {
    width:100%; min-height:52px; resize:vertical; box-sizing:border-box;
    border:1px solid ${border}; border-radius:8px; padding:6px 8px;
    font:500 12px/1.35 inherit; color:inherit; background:${bg};
  }
  .reply-actions { display:flex; gap:6px; justify-content:flex-end; }
  .status { color:${muted}; font-size:11px; min-height:14px; }
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
    <div class="section-head">
      <span>Needs reply</span>
      <span class="count" id="inbox-count"></span>
    </div>
    <div class="inbox-list" id="inbox-list"></div>
    <div class="section-head"><span>Recent</span></div>
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
    function paintInbox(data) {
      const inboxList = document.getElementById('inbox-list');
      const countEl = document.getElementById('inbox-count');
      const inbox = data?.inbox || [];
      countEl.textContent = inbox.length ? inbox.length + ' chats' : 'All clear';
      if (!inbox.length) {
        inboxList.innerHTML = '<p class="empty">No unread WhatsApp / Arattai chats</p>';
        return;
      }
      inboxList.innerHTML = inbox.map((item, index) => {
        const initial = esc((item.name || '?').slice(0, 1).toUpperCase());
        const unread = Math.min(99, Number(item.unread) || 1);
        const preview = esc(item.preview || item.accountLabel || '');
        const account = esc(item.accountLabel || '');
        return '<div class="row" style="display:grid;gap:6px">' +
          '<button type="button" class="inbox-row open-inbox" data-index="' + index + '">' +
          '<span class="logo" style="background:' + esc(item.color || '#e2e8f0') + '">' + initial + '</span>' +
          '<span class="text"><strong>' + esc(item.name) + '</strong>' +
          '<span>' + (preview || account) + (account && preview ? ' · ' + account : '') + '</span></span>' +
          '<span class="inbox-badge">' + unread + '</span></button>' +
          '<div class="actions"><button type="button" class="inbox-pin" data-index="' + index + '">Pin</button></div>' +
          '</div>';
      }).join('');
      inboxList.querySelectorAll('.open-inbox').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = inbox[Number(btn.dataset.index)];
          if (!item) return;
          api.action('open-inbox', {
            serviceId: item.serviceId || '',
            name: item.name || '',
            chatKey: item.chatKey || '',
          });
        });
      });
      inboxList.querySelectorAll('.inbox-pin').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = inbox[Number(btn.dataset.index)];
          if (!item) return;
          api.action('pin-inbox', {
            serviceId: item.serviceId || '',
            name: item.name || '',
            chatKey: item.chatKey || '',
            appId: item.appId || '',
          });
          btn.textContent = 'Pinned';
          btn.disabled = true;
        });
      });
    }
    function paint(data) {
      paintInbox(data);
      const list = document.getElementById('list');
      const items = data?.notifications || [];
      if (!items.length) {
        list.innerHTML = '<p class="empty">No new notifications</p>';
      } else {
        list.innerHTML = items.map((item, index) => {
          const initial = esc((item.title || '?').slice(0, 1));
          const logo = item.logo
            ? '<img src="' + esc(item.logo) + '" alt="" />'
            : initial;
          const reply = item.canReply
            ? '<div class="actions"><button type="button" class="btn reply-toggle" data-index="' + index + '">Reply</button></div>' +
              '<div class="reply-box" data-reply="' + index + '">' +
              '<textarea maxlength="2000" placeholder="Type a short reply…"></textarea>' +
              '<div class="reply-actions">' +
              '<button type="button" class="btn cancel-reply">Cancel</button>' +
              '<button type="button" class="btn primary send-reply" data-index="' + index + '">Send</button>' +
              '</div><div class="status"></div></div>'
            : '';
          return '<div class="row" data-index="' + index + '">' +
            '<button type="button" class="open-btn" data-index="' + index + '">' +
            '<span class="logo" style="background:' + esc(item.color || '#e2e8f0') + '">' + logo + '</span>' +
            '<span class="text"><strong>' + esc(item.title) + '</strong><span>' + esc(item.body) + '</span>' +
            '<span class="meta"><span class="time">' + esc(relativeTime(item.at)) + '</span></span></span></button>' +
            reply + '</div>';
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

// Keep escapeHtml exported for tests / reuse if needed.
export { escapeHtml };
