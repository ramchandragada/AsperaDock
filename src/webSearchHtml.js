/** Floating Google Web-search popup — paints above WebContentsView guests. */

export function buildWebSearchHtml(dark = false) {
  const bg = dark ? '#111827' : '#ffffff';
  const text = dark ? '#e2e8f0' : '#0f172a';
  const muted = dark ? '#94a3b8' : '#64748b';
  const border = dark ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.12)';
  const inputBg = dark ? 'rgba(148,163,184,0.10)' : 'rgba(15,23,42,0.04)';
  const hover = dark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';
  const accent = '#c9a227';

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body {
    margin: 0; padding: 0; background: transparent; overflow: hidden;
    font: 500 13px/1.35 "Segoe UI", "Ubuntu", "Cantarell", sans-serif;
    color: ${text}; user-select: none;
  }
  .panel {
    margin: 6px;
    padding: 12px 12px 10px;
    border-radius: 12px;
    border: 1px solid ${border};
    background: ${bg};
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.24);
    box-sizing: border-box;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 650;
    letter-spacing: 0.01em;
  }
  .title svg {
    width: 16px; height: 16px;
    stroke: ${accent}; fill: none; stroke-width: 2;
    stroke-linecap: round; stroke-linejoin: round;
  }
  .close {
    height: 28px; width: 28px; border: 0; border-radius: 6px;
    background: transparent; color: inherit; cursor: pointer; font: inherit;
  }
  .close:hover { background: ${hover}; }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  input {
    flex: 1;
    height: 38px;
    border-radius: 8px;
    border: 1px solid ${accent};
    padding: 0 12px;
    background: ${inputBg};
    color: ${text};
    outline: none;
    font: inherit;
    user-select: text;
  }
  input::placeholder { color: ${muted}; }
  .go {
    height: 38px;
    min-width: 72px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: ${accent};
    color: #111827;
    font: 650 13px/1 inherit;
    cursor: pointer;
  }
  .go:hover { filter: brightness(1.05); }
  .hint {
    margin: 8px 2px 0;
    font-size: 11px;
    color: ${muted};
    font-weight: 500;
  }
</style>
</head>
<body>
  <div class="panel" role="search">
    <div class="head">
      <div class="title">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.4-4.4"/></svg>
        <span>Web search</span>
      </div>
      <button type="button" class="close" id="close" aria-label="Close" title="Close">✕</button>
    </div>
    <div class="row">
      <input id="q" type="search" placeholder="Search Google…" autocomplete="off" autofocus />
      <button type="button" class="go" id="go" title="Search">Search</button>
    </div>
    <div class="hint">Enter opens Google in a Hub tab · Esc closes</div>
  </div>
  <script>
    const input = document.getElementById('q');
    const api = window.webSearchApi;

    function focusInput() {
      try {
        input.focus();
        input.select();
      } catch (e) {}
    }

    async function runSearch() {
      const text = input.value || '';
      if (!String(text).trim()) {
        focusInput();
        return;
      }
      try {
        await api.search(text);
      } catch (e) {}
    }

    api.onInit((data) => {
      if (data && typeof data.query === 'string') input.value = data.query;
      focusInput();
      setTimeout(focusInput, 0);
      setTimeout(focusInput, 40);
    });

    document.getElementById('go').addEventListener('click', () => runSearch());
    document.getElementById('close').addEventListener('click', () => api.close());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        api.close();
      }
    });
    window.addEventListener('focus', focusInput);
    focusInput();
  </script>
</body>
</html>`;
}
