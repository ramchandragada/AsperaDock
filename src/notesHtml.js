/** Floating Aspera Notes pad — copy links / repeated text, paste yourself. */

export function buildNotesHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  const inputBg = dark ? '#111827' : '#fff';
  const hover = dark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.06)';
  const active = dark ? 'rgba(37,99,235,0.28)' : 'rgba(37,99,235,0.12)';
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body {
    margin:0; padding:0; width:100%; height:100%;
    background:transparent; overflow:hidden;
    font:500 14px/1.45 "Segoe UI","Ubuntu","Cantarell",sans-serif;
    color:${text};
  }
  .card {
    margin:4px; width:calc(100% - 8px); height:calc(100% - 8px); box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:14px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:12px 14px;
    display:flex; flex-direction:column; gap:10px; min-height:0;
  }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex:0 0 auto; }
  .head strong { font-size:16px; font-weight:700; }
  .meta { color:${muted}; font-size:12px; font-weight:600; margin-top:2px; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .btn {
    border:0; border-radius:9px; padding:8px 11px; font:inherit; font-size:13px; font-weight:700;
    cursor:pointer; background:${card}; color:inherit;
  }
  .btn.primary { background:#2563eb; color:#fff; }
  .btn.danger { color:#b91c1c; }
  .btn:disabled { opacity:0.5; cursor:default; }
  .layout { display:flex; gap:10px; flex:1 1 auto; min-height:0; }
  .list-pane {
    width:168px; flex:0 0 168px; min-height:0; display:flex; flex-direction:column; gap:8px;
  }
  .search {
    width:100%; box-sizing:border-box; height:34px; border-radius:8px;
    border:1px solid ${border}; padding:0 10px; background:${inputBg}; color:inherit; font:inherit;
  }
  .list { flex:1 1 auto; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:4px; }
  .item {
    text-align:left; border:0; border-radius:8px; padding:8px 9px; cursor:pointer;
    background:transparent; color:inherit; font:inherit;
  }
  .item:hover { background:${hover}; }
  .item.active { background:${active}; }
  .item .t { display:block; font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .item .p { display:block; color:${muted}; font-size:11px; font-weight:600; margin-top:2px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .empty { color:${muted}; font-size:12px; font-weight:600; padding:8px 4px; }
  .editor {
    flex:1 1 auto; min-width:0; min-height:0; display:flex; flex-direction:column; gap:8px;
  }
  .title-in, .body-in {
    width:100%; box-sizing:border-box; border:1px solid ${border}; border-radius:10px;
    padding:8px 10px; background:${inputBg}; color:inherit; font:inherit;
  }
  .title-in { font-weight:700; }
  .body-in { flex:1 1 auto; min-height:120px; resize:none; }
  .title-in:focus, .body-in:focus, .search:focus { outline:2px solid #2563eb55; border-color:#2563eb; }
  .foot { color:${muted}; font-size:12px; font-weight:600; min-height:1.2em; }
</style>
</head>
<body>
  <div class="card">
    <header class="head">
      <div>
        <strong>Notes</strong>
        <div class="meta">Copy, then paste where you want. Hub never sends.</div>
      </div>
      <div class="actions">
        <button type="button" class="btn" id="close">Close</button>
      </div>
    </header>
    <div class="layout">
      <div class="list-pane">
        <input class="search" id="search" type="search" placeholder="Search notes…" />
        <button type="button" class="btn primary" id="new">New note</button>
        <div class="list" id="list"></div>
      </div>
      <div class="editor">
        <input class="title-in" id="title" type="text" placeholder="Title (optional)" maxlength="80" />
        <textarea class="body-in" id="body" placeholder="Links, addresses, or text you send often…"></textarea>
        <div class="actions">
          <button type="button" class="btn primary" id="copy">Copy</button>
          <button type="button" class="btn" id="copy-all">Copy title + text</button>
          <button type="button" class="btn danger" id="del">Delete</button>
        </div>
        <p class="foot" id="status">Pick a note or click New. Then Copy and paste with Ctrl+V.</p>
      </div>
    </div>
  </div>
  <script>
    const api = window.notesApi;
    const listEl = document.getElementById('list');
    const searchEl = document.getElementById('search');
    const titleEl = document.getElementById('title');
    const bodyEl = document.getElementById('body');
    const statusEl = document.getElementById('status');
    const copyBtn = document.getElementById('copy');
    const copyAllBtn = document.getElementById('copy-all');
    const delBtn = document.getElementById('del');
    let notes = [];
    let activeId = '';
    let saveTimer = null;
    let dirty = false;

    function preview(note) {
      const t = String(note.title || '').trim();
      const b = String(note.body || '').replace(/\\s+/g, ' ').trim();
      return t || b || 'Untitled';
    }
    function snippet(note) {
      const t = String(note.title || '').trim();
      const b = String(note.body || '').replace(/\\s+/g, ' ').trim();
      if (t && b) return b;
      return b || t || '';
    }
    function copyText(includeTitle) {
      const title = String(titleEl.value || '').trim();
      const body = String(bodyEl.value || '').trim();
      if (includeTitle && title && body) return title + '\\n' + body;
      return body || title;
    }
    function setStatus(msg) { statusEl.textContent = msg || ''; }
    function filtered() {
      const q = String(searchEl.value || '').trim().toLowerCase();
      if (!q) return notes;
      return notes.filter((n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.body || '').toLowerCase().includes(q)
      );
    }
    function renderList() {
      const rows = filtered();
      listEl.innerHTML = '';
      if (!rows.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = notes.length ? 'No matches.' : 'No notes yet.';
        listEl.appendChild(empty);
        return;
      }
      rows.forEach((note) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item' + (note.id === activeId ? ' active' : '');
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = preview(note);
        const p = document.createElement('span');
        p.className = 'p';
        p.textContent = snippet(note);
        btn.appendChild(t);
        if (snippet(note) && preview(note) !== snippet(note)) btn.appendChild(p);
        btn.onclick = () => selectNote(note.id);
        listEl.appendChild(btn);
      });
    }
    function loadIntoEditor(note) {
      titleEl.value = note?.title || '';
      bodyEl.value = note?.body || '';
      dirty = false;
      const has = !!(String(titleEl.value).trim() || String(bodyEl.value).trim());
      copyBtn.disabled = !has;
      copyAllBtn.disabled = !has;
      delBtn.disabled = !note?.id;
    }
    function selectNote(id) {
      const note = notes.find((n) => n.id === id) || null;
      activeId = note ? note.id : '';
      loadIntoEditor(note);
      renderList();
      setStatus('Edit, then Copy and paste with Ctrl+V.');
    }
    async function persist() {
      const title = String(titleEl.value || '');
      const body = String(bodyEl.value || '');
      if (!title.trim() && !body.trim()) return;
      const result = await api.save({ id: activeId || undefined, title, body });
      if (result?.ok && Array.isArray(result.notes)) {
        notes = result.notes;
        if (result.note?.id) activeId = result.note.id;
        dirty = false;
        renderList();
      } else if (result?.error) {
        setStatus(String(result.error));
      }
    }
    function scheduleSave() {
      dirty = true;
      const has = !!(String(titleEl.value).trim() || String(bodyEl.value).trim());
      copyBtn.disabled = !has;
      copyAllBtn.disabled = !has;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { persist().catch(() => {}); }, 280);
    }
    async function copyNow(includeTitle) {
      if (dirty) await persist();
      const text = copyText(includeTitle);
      if (!text) {
        setStatus('Type something first, then Copy.');
        return;
      }
      await api.copy(text);
      setStatus('Copied — paste with Ctrl+V wherever you want.');
    }

    api.onInit((data) => {
      notes = Array.isArray(data?.notes) ? data.notes : [];
      if (!activeId || !notes.some((n) => n.id === activeId)) {
        activeId = notes[0]?.id || '';
      }
      const note = notes.find((n) => n.id === activeId) || null;
      loadIntoEditor(note);
      renderList();
      if (!notes.length) {
        setStatus('Click New note, paste a link or repeated text, then Copy.');
        titleEl.focus();
      }
    });
    searchEl.oninput = () => renderList();
    titleEl.oninput = scheduleSave;
    bodyEl.oninput = scheduleSave;
    document.getElementById('new').onclick = () => {
      activeId = '';
      loadIntoEditor({ title: '', body: '' });
      renderList();
      setStatus('New note — type, then Copy.');
      titleEl.focus();
    };
    copyBtn.onclick = () => copyNow(false);
    copyAllBtn.onclick = () => copyNow(true);
    delBtn.onclick = async () => {
      if (!activeId) {
        loadIntoEditor({ title: '', body: '' });
        return;
      }
      const result = await api.delete(activeId);
      if (result?.ok && Array.isArray(result.notes)) {
        notes = result.notes;
        activeId = notes[0]?.id || '';
        loadIntoEditor(notes[0] || { title: '', body: '' });
        renderList();
        setStatus('Deleted.');
      }
    };
    document.getElementById('close').onclick = () => api.close();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') api.close();
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        persist().catch(() => {});
      }
    });
  </script>
</body>
</html>`;
}
