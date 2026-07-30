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
  html, body {
    margin:0; padding:0; width:100%; height:100%;
    background:transparent; overflow:hidden;
    font:500 16px/1.55 "Segoe UI","Ubuntu","Cantarell",sans-serif;
    color:${text}; user-select:text;
  }
  .card {
    margin:4px; width:calc(100% - 8px); height:calc(100% - 8px); box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:14px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:14px 16px;
    display:flex; flex-direction:column; gap:12px; min-height:0;
  }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex:0 0 auto; }
  .head strong { font-size:17px; font-weight:700; }
  .meta { color:${muted}; font-size:12px; font-weight:600; margin-top:3px; line-height:1.4; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .btn {
    border:0; border-radius:9px; padding:9px 12px; font:inherit; font-size:13px; font-weight:700;
    cursor:pointer; background:${card}; color:inherit;
  }
  .btn.primary { background:#2563eb; color:#fff; }
  .btn:disabled { opacity:0.55; cursor:default; }
  .toolbar {
    flex:0 0 auto; display:none; gap:10px; flex-wrap:wrap; align-items:center;
    padding:10px 12px; border-radius:10px; background:${card};
  }
  .toolbar.show { display:flex; }
  .toolbar .hint { color:${muted}; font-size:12px; font-weight:600; line-height:1.4; }
  .scroll {
    flex:1 1 auto; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:12px;
    padding-right:4px;
  }
  .body {
    flex:0 0 auto;
    background:${card}; border-radius:12px; padding:14px 16px; min-height:120px;
    white-space:pre-wrap; word-break:break-word; font-weight:500;
    font-size:16px; line-height:1.6;
  }
  .body.error { color:#b91c1c; }
  .body.loading { color:${muted}; }
  .section-label {
    flex:0 0 auto;
    font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:${muted};
  }
  .replies-block { display:none; flex-direction:column; gap:10px; flex:0 0 auto; }
  .replies-block.show { display:flex; }
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
        <button type="button" class="btn primary" id="copy" disabled>Copy all</button>
        <button type="button" class="btn" id="close">Close</button>
      </div>
    </header>
    <div class="toolbar" id="reply-bar">
      <button type="button" class="btn primary" id="suggest-reply">Suggest replies (EN · HI · MR)</button>
      <span class="hint" id="reply-hint">Rough drafts for this message — select text and right-click to copy</span>
    </div>
    <div class="scroll" id="scroll">
      <div class="section-label" id="summary-label" hidden>Summary · EN · HI · MR</div>
      <div class="body loading" id="body">Working…</div>
      <div class="replies-block" id="replies-wrap">
        <div class="section-label">Suggested replies · EN · HI · MR</div>
        <div class="body" id="replies"></div>
      </div>
    </div>
  </div>
  <script>
    const api = window.aiResultApi;
    const body = document.getElementById('body');
    const copyBtn = document.getElementById('copy');
    const replyBar = document.getElementById('reply-bar');
    const suggestBtn = document.getElementById('suggest-reply');
    const replyHint = document.getElementById('reply-hint');
    const repliesWrap = document.getElementById('replies-wrap');
    const replies = document.getElementById('replies');
    const summaryLabel = document.getElementById('summary-label');
    const scroll = document.getElementById('scroll');
    let latestSummary = '';
    let latestReplies = '';

    function copyText() {
      const parts = [latestSummary, latestReplies].filter(Boolean);
      return parts.join('\\n\\n—\\n\\n');
    }

    api.onInit((data) => {
      document.getElementById('title').textContent = data?.title || 'Aspera AI';
      document.getElementById('meta').textContent = data?.meta || '';
      latestSummary = String(data?.text || '');
      latestReplies = String(data?.repliesText || '');
      const err = !!data?.error;
      const loading = !!data?.loading;
      body.className = 'body' + (err ? ' error' : loading ? ' loading' : '');
      body.textContent = latestSummary || (err ? String(data.error) : '…');
      summaryLabel.hidden = !(data?.showTrilingual && !loading && !err && latestSummary);

      const showToolbar = !!(data?.canSuggestReply && !loading && !err);
      replyBar.classList.toggle('show', showToolbar);
      suggestBtn.disabled = !!data?.repliesLoading;
      suggestBtn.textContent = latestReplies || data?.repliesError
        ? 'Regenerate replies'
        : 'Suggest replies (EN · HI · MR)';
      replyHint.textContent = data?.repliesLoading
        ? 'Writing reply drafts…'
        : latestReplies
          ? 'Select any reply text, then right-click → Copy'
          : 'Rough drafts for this message';

      if (data?.repliesLoading) {
        repliesWrap.classList.add('show');
        replies.className = 'body loading';
        replies.textContent = 'Writing reply drafts in English, Hindi, and Marathi…';
        scroll.scrollTop = scroll.scrollHeight;
      } else if (latestReplies) {
        repliesWrap.classList.add('show');
        replies.className = 'body';
        replies.textContent = latestReplies;
      } else if (data?.repliesError) {
        repliesWrap.classList.add('show');
        replies.className = 'body error';
        replies.textContent = String(data.repliesError);
      } else {
        repliesWrap.classList.remove('show');
        replies.textContent = '';
      }
      copyBtn.disabled = (!latestSummary && !latestReplies) || err || loading;
    });

    suggestBtn.onclick = async () => {
      suggestBtn.disabled = true;
      replyHint.textContent = 'Writing reply drafts…';
      await api.suggestReply();
    };

    copyBtn.onclick = async () => {
      const text = copyText();
      if (!text) return;
      await api.copy(text);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy all'; }, 1200);
    };
    document.getElementById('close').onclick = () => api.close();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
