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
    margin:4px; width:440px; max-height:640px; box-sizing:border-box;
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
  .scroll {
    display:grid; gap:10px; max-height:500px; overflow:auto; padding-right:2px;
  }
  .body {
    background:${card}; border-radius:10px; padding:10px 12px; min-height:100px;
    white-space:pre-wrap; word-break:break-word; font-weight:500;
  }
  .body.error { color:#b91c1c; }
  .body.loading { color:${muted}; }
  .section-label {
    font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:${muted};
  }
  .reply-bar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .reply-bar .hint { color:${muted}; font-size:11px; font-weight:600; }
  .replies { display:none; }
  .replies.show { display:grid; gap:8px; }
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
    <div class="scroll">
      <div class="section-label" id="summary-label" hidden>Summary · EN · HI · MR</div>
      <div class="body loading" id="body">Working…</div>
      <div class="reply-bar" id="reply-bar" hidden>
        <button type="button" class="btn primary" id="suggest-reply">Suggest replies (EN · HI · MR)</button>
        <span class="hint" id="reply-hint">Rough drafts for this message</span>
      </div>
      <div class="replies" id="replies-wrap">
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
      replyBar.hidden = !(data?.canSuggestReply && !loading && !err);
      suggestBtn.disabled = !!data?.repliesLoading;
      replyHint.textContent = data?.repliesLoading
        ? 'Writing reply drafts…'
        : latestReplies
          ? 'Replies ready — edit before sending'
          : 'Rough drafts for this message';
      if (data?.repliesLoading) {
        repliesWrap.classList.add('show');
        replies.className = 'body loading';
        replies.textContent = 'Writing reply drafts in English, Hindi, and Marathi…';
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
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
    };
    document.getElementById('close').onclick = () => api.close();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
