/** Floating Find-in-page popup — paints above WebContentsView guests. */

export function buildFindBarHtml(dark = false) {
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
    font: 500 13px/1.3 "Segoe UI", "Ubuntu", "Cantarell", sans-serif;
    color: ${text}; user-select: none;
  }
  .bar {
    margin: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid ${border};
    background: ${bg};
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
    box-sizing: border-box;
  }
  input {
    width: 200px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid ${accent};
    padding: 0 10px;
    background: ${inputBg};
    color: ${text};
    outline: none;
    font: inherit;
    user-select: text;
  }
  input::placeholder { color: ${muted}; }
  .status {
    min-width: 4.5ch;
    font-size: 12px;
    color: ${muted};
    text-align: center;
  }
  button {
    height: 32px;
    min-width: 34px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  button:hover { background: ${hover}; }
  button.close { font-size: 14px; }
</style>
</head>
<body>
  <div class="bar" role="search">
    <input id="find-input" type="search" placeholder="Find in page" autocomplete="off" autofocus />
    <span id="find-status" class="status"></span>
    <button id="find-prev" type="button" title="Previous">↑</button>
    <button id="find-next" type="button" title="Next">↓</button>
    <button id="find-close" type="button" class="close" aria-label="Close" title="Close">✕</button>
  </div>
  <script>
    const input = document.getElementById('find-input');
    const status = document.getElementById('find-status');
    const api = window.findBarApi;

    function runFind(opts) {
      const text = input.value || '';
      api.find(text, opts || {});
      status.textContent = text ? '…' : '';
    }

    function focusInput() {
      try {
        input.focus();
        input.select();
      } catch (e) {}
    }

    api.onInit((data) => {
      if (data && typeof data.query === 'string') input.value = data.query;
      status.textContent = '';
      focusInput();
      setTimeout(focusInput, 0);
      setTimeout(focusInput, 40);
    });

    api.onResult((data) => {
      if (!data) return;
      if (!data.matches) {
        status.textContent = input.value ? '0/0' : '';
        return;
      }
      status.textContent = (data.activeMatchOrdinal || 0) + '/' + data.matches;
    });

    input.addEventListener('input', () => runFind({ findNext: false, forward: true }));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runFind({ findNext: true, forward: !event.shiftKey });
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        api.close();
      }
    });
    document.getElementById('find-prev').addEventListener('click', () => {
      runFind({ findNext: true, forward: false });
      focusInput();
    });
    document.getElementById('find-next').addEventListener('click', () => {
      runFind({ findNext: true, forward: true });
      focusInput();
    });
    document.getElementById('find-close').addEventListener('click', () => api.close());
    window.addEventListener('focus', focusInput);
    focusInput();
  </script>
</body>
</html>`;
}
