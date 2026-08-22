/** Chrome-like floating Extensions manager for guest apps (WhatsApp, etc.). */

export function buildExtensionsHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  const hover = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const field = dark ? '#0b1220' : '#fff';
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
  .add {
    margin:0 14px 10px; padding:12px; border-radius:12px; background:${card}; border:1px solid ${border};
    display:grid; gap:8px; flex:0 0 auto;
  }
  .add-title { font-weight:700; font-size:13px; }
  .add-help { color:${muted}; font-size:12px; font-weight:500; }
  .row-input { display:flex; gap:6px; align-items:stretch; }
  .row-input input {
    flex:1 1 auto; min-width:0; border:1px solid ${border}; border-radius:8px;
    background:${field}; color:inherit; padding:8px 10px; font:inherit; font-size:12px; font-weight:600;
    outline:none;
  }
  .row-input input:focus { border-color:#2563eb; }
  .add-more { display:flex; gap:6px; flex-wrap:wrap; }
  .hint { padding:0 14px 8px; color:${muted}; font-size:11px; font-weight:500; flex:0 0 auto; }
  .list { flex:1 1 auto; min-height:0; overflow:auto; padding:4px 10px 12px; display:grid; gap:8px; align-content:start; }
  .empty { padding:18px 12px; text-align:center; color:${muted}; font-size:13px; }
  .row {
    display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center;
    padding:10px 12px; border-radius:10px; background:${card}; border:1px solid ${border};
  }
  .row:hover { background:${hover}; }
  .name { font-weight:700; font-size:13px; }
  .meta { color:${muted}; font-size:11px; margin-top:2px; }
  .desc { color:${muted}; font-size:12px; margin-top:4px; max-width:320px; }
  .row-actions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .err { color:#b91c1c; padding:0 14px 8px; font-size:12px; font-weight:600; white-space:pre-wrap; }
  .status { color:${muted}; padding:0 14px 8px; font-size:12px; font-weight:600; }
  .foot { padding:8px 14px 12px; border-top:1px solid ${border}; display:flex; gap:8px; flex-wrap:wrap; flex:0 0 auto; }
</style>
</head>
<body>
  <div class="panel">
    <header class="head">
      <div>
        <h1>Extensions</h1>
        <p class="sub">Add Chrome extensions to WhatsApp, Arattai, and other apps</p>
      </div>
      <div class="actions">
        <button type="button" class="btn" id="close">Close</button>
      </div>
    </header>
    <section class="add">
      <div class="add-title">Add from Chrome Web Store</div>
      <div class="add-help">
        Open the Web Store, copy an extension’s link, paste it here, then Install — same idea as Chrome’s “Add to Chrome”.
      </div>
      <div class="row-input">
        <input id="store-input" type="text" spellcheck="false" placeholder="Paste Chrome Web Store link or extension ID" />
        <button type="button" class="btn primary" id="install-store">Install</button>
      </div>
      <div class="add-more">
        <button type="button" class="btn" id="browse-store">Browse Web Store</button>
        <button type="button" class="btn" id="install-file">Install .crx / .zip</button>
        <button type="button" class="btn" id="load">Load unpacked</button>
      </div>
    </section>
    <p class="hint">
      Tip: some store extensions need Chrome APIs Aspera Hub doesn’t support — if one fails, try another or an unpacked build from the developer. Use <b>Open</b> to sign in to password managers (Bitwarden, etc.) — Hub has no extension toolbar or shortcut keys.
    </p>
    <div class="status" id="status" hidden></div>
    <div class="err" id="error" hidden></div>
    <div class="list" id="list"><div class="empty">No extensions installed yet.</div></div>
    <footer class="foot">
      <button type="button" class="btn" id="reload">Reload apps</button>
    </footer>
  </div>
  <script>
    const api = window.extensionsApi;
    const listEl = document.getElementById('list');
    const errorEl = document.getElementById('error');
    const statusEl = document.getElementById('status');
    const storeInput = document.getElementById('store-input');
    const installBtn = document.getElementById('install-store');

    function showError(msg) {
      if (!msg) { errorEl.hidden = true; errorEl.textContent = ''; return; }
      errorEl.hidden = false;
      errorEl.textContent = String(msg);
    }

    function showStatus(msg) {
      if (!msg) { statusEl.hidden = true; statusEl.textContent = ''; return; }
      statusEl.hidden = false;
      statusEl.textContent = String(msg);
    }

    function setBusy(busy, label) {
      installBtn.disabled = !!busy;
      document.getElementById('install-file').disabled = !!busy;
      document.getElementById('load').disabled = !!busy;
      document.getElementById('browse-store').disabled = !!busy;
      showStatus(busy ? (label || 'Working…') : '');
    }

    function render(data) {
      showError(data?.error || '');
      if (!data?.error) showStatus('');
      const items = Array.isArray(data?.extensions) ? data.extensions : [];
      listEl.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No extensions installed yet. Paste a Web Store link above to add one.';
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
          ext.chromeId ? 'Web Store' : '',
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
        if (ext.canOpen) {
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'btn primary';
          openBtn.textContent = 'Open';
          openBtn.disabled = !ext.enabled || ext.exists === false;
          openBtn.title = ext.enabled
            ? 'Open extension sign-in / popup window'
            : 'Enable the extension first';
          openBtn.onclick = async () => {
            showError('');
            showStatus('Opening ' + (ext.name || 'extension') + '…');
            try {
              const result = await api.open(ext.id);
              if (result?.ok) {
                showStatus('Opened ' + (ext.name || 'extension') + '. Sign in there, then use it in your apps.');
              } else {
                showError(result?.error || 'Could not open extension.');
              }
            } catch (error) {
              showError(String(error?.message || error));
            }
          };
          actions.appendChild(openBtn);
        }
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

    async function installFromStore() {
      const value = storeInput.value.trim();
      if (!value) {
        showError('Paste a Chrome Web Store link or extension ID first.');
        storeInput.focus();
        return;
      }
      setBusy(true, 'Downloading from Chrome Web Store…');
      showError('');
      try {
        const result = await api.installWebStore(value);
        if (result?.ok) {
          storeInput.value = '';
          showStatus('Installed ' + (result.extension?.name || 'extension') + '. Reloading apps…');
        } else if (!result?.cancelled) {
          showError(result?.error || 'Install failed.');
        }
      } catch (error) {
        showError(String(error?.message || error));
      } finally {
        setBusy(false);
      }
    }

    api.onInit(render);
    document.getElementById('close').onclick = () => api.close();
    installBtn.onclick = () => installFromStore();
    storeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') installFromStore();
    });
    document.getElementById('browse-store').onclick = () => {
      api.openWebStore(storeInput.value.trim());
    };
    document.getElementById('install-file').onclick = async () => {
      setBusy(true, 'Installing package…');
      showError('');
      try {
        const result = await api.installPackage();
        if (result && !result.ok && !result.cancelled) {
          showError(result.error || 'Install failed.');
        }
      } catch (error) {
        showError(String(error?.message || error));
      } finally {
        setBusy(false);
      }
    };
    document.getElementById('load').onclick = async () => {
      setBusy(true, 'Loading unpacked folder…');
      showError('');
      try {
        const result = await api.loadUnpacked();
        if (result && !result.ok && !result.cancelled) {
          showError(result.error || 'Load failed.');
        }
      } catch (error) {
        showError(String(error?.message || error));
      } finally {
        setBusy(false);
      }
    };
    document.getElementById('reload').onclick = async () => {
      setBusy(true, 'Reloading apps…');
      showError('');
      try {
        await api.reloadGuests();
        showStatus('Apps reloaded.');
      } catch (error) {
        showError(String(error?.message || error));
      } finally {
        setBusy(false);
      }
    };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
