/** Floating result panel for Aspera AI skills. */

export function buildAiResultHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  const inputBg = dark ? '#111827' : '#fff';
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
  .btn.small { padding:6px 10px; font-size:12px; }
  .btn.danger { color:#b91c1c; }
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
  .replies-editor { display:flex; flex-direction:column; gap:14px; }
  .reply-lang {
    background:${card}; border-radius:12px; padding:12px 14px;
    display:flex; flex-direction:column; gap:10px;
  }
  .reply-lang-head {
    display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;
  }
  .reply-lang-head strong { font-size:14px; font-weight:700; }
  .reply-card {
    border:1px solid ${border}; border-radius:10px; padding:10px;
    background:${inputBg}; display:flex; flex-direction:column; gap:8px;
  }
  .reply-card textarea {
    width:100%; box-sizing:border-box; min-height:72px; resize:vertical;
    border:1px solid ${border}; border-radius:8px; padding:8px 10px;
    font:inherit; font-size:15px; line-height:1.5; color:inherit; background:transparent;
  }
  .reply-card textarea:focus { outline:2px solid #2563eb55; border-color:#2563eb; }
  .reply-card-actions { display:flex; gap:6px; flex-wrap:wrap; }
  .reply-status { color:${muted}; font-size:12px; font-weight:600; min-height:1.2em; }
  .refine-wrap { display:none; flex-direction:column; gap:12px; flex:0 0 auto; }
  .refine-wrap.show { display:flex; }
  .refine-lang {
    background:${card}; border-radius:12px; padding:12px 14px;
    display:flex; flex-direction:column; gap:8px;
  }
  .refine-lang-head {
    display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;
  }
  .refine-lang-head strong { font-size:14px; font-weight:700; }
  .refine-lang textarea {
    width:100%; box-sizing:border-box; min-height:88px; resize:vertical;
    border:1px solid ${border}; border-radius:10px; padding:10px 12px;
    font:inherit; font-size:15px; line-height:1.55; color:inherit; background:${inputBg};
  }
  .refine-lang textarea:focus { outline:2px solid #2563eb55; border-color:#2563eb; }
  .refine-lang-actions { display:flex; gap:6px; flex-wrap:wrap; }
  .inbox {
    display:none; flex-direction:column; gap:12px; flex:1 1 auto; min-height:0;
  }
  .inbox.show { display:flex; }
  .inbox textarea {
    width:100%; box-sizing:border-box; flex:1 1 auto; min-height:160px; resize:vertical;
    border:1px solid ${border}; border-radius:12px; padding:12px 14px;
    font:inherit; font-size:15px; line-height:1.55; color:inherit; background:${inputBg};
  }
  .inbox textarea:focus { outline:2px solid #2563eb55; border-color:#2563eb; }
  .inbox-skills {
    display:flex; flex-direction:column; gap:8px; flex:0 0 auto;
    padding:10px 12px; border-radius:10px; background:${card};
  }
  .inbox-skills label {
    display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; cursor:pointer;
  }
  .inbox-foot {
    color:${muted}; font-size:12px; font-weight:600; line-height:1.4; flex:0 0 auto;
  }
  .work-pane { display:flex; flex-direction:column; gap:12px; flex:1 1 auto; min-height:0; }
  .work-pane.hide { display:none; }
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
    <div class="inbox" id="inbox">
      <div class="section-label">Your text (paste from any app)</div>
      <textarea id="inbox-text" placeholder="Copy text in WhatsApp, Arattai, Gmail, or Zoho Mail — then paste here (Ctrl+V)."></textarea>
      <div class="actions">
        <button type="button" class="btn" id="inbox-paste">Paste from clipboard</button>
        <button type="button" class="btn" id="inbox-clear">Clear</button>
      </div>
      <div class="inbox-skills" role="radiogroup" aria-label="Aspera AI skill">
        <div class="section-label">What do you need?</div>
        <label><input type="radio" name="inbox-skill" value="summarize" checked /> Summarize</label>
        <label><input type="radio" name="inbox-skill" value="refine" /> Refine draft</label>
        <label><input type="radio" name="inbox-skill" value="suggest-reply" /> Suggest reply</label>
      </div>
      <div class="actions">
        <button type="button" class="btn primary" id="inbox-run">Run Aspera AI</button>
      </div>
      <p class="inbox-foot" id="inbox-status">
        Same on every app: copy → paste here → copy result → paste back. Hub never sends for you.
      </p>
    </div>
    <div class="work-pane" id="work-pane">
    <div class="toolbar" id="result-actions">
      <button type="button" class="btn" id="new-paste-any">New paste</button>
      <span class="hint">Same window — paste new text to run again</span>
    </div>
    <div class="toolbar" id="reply-bar">
      <button type="button" class="btn primary" id="suggest-reply">Suggest replies (EN · HI · MR)</button>
      <span class="hint" id="reply-hint">Rough drafts — copy and paste into the app yourself</span>
    </div>
    <div class="toolbar" id="refine-bar">
      <button type="button" class="btn" id="refine-again">Refine again (EN · HI · MR)</button>
      <button type="button" class="btn" id="new-paste">New paste</button>
      <span class="hint" id="refine-hint">Pick English, Hindi, or Marathi — then Copy and paste yourself</span>
    </div>
    <div class="scroll" id="scroll">
      <div class="section-label" id="summary-label" hidden>Summary · EN · HI · MR</div>
      <div class="body loading" id="body">Working…</div>
      <div class="refine-wrap" id="refine-wrap">
        <div class="section-label">Refined message · EN · HI · MR</div>
        <div id="refine-editor"></div>
        <div class="reply-status" id="refine-status" hidden></div>
      </div>
      <div class="replies-block" id="replies-wrap">
        <div class="section-label">Suggested replies · EN · HI · MR</div>
        <div id="replies-status" class="reply-status" hidden></div>
        <div class="replies-editor" id="replies-editor" hidden></div>
        <div class="body" id="replies" hidden></div>
      </div>
      <p class="inbox-foot" id="result-foot" hidden>
        Next: Copy result, then paste into the app yourself. Hub will not auto-send.
      </p>
    </div>
    </div>
  </div>
  <script>
    const api = window.aiResultApi;
    const body = document.getElementById('body');
    const copyBtn = document.getElementById('copy');
    const inbox = document.getElementById('inbox');
    const workPane = document.getElementById('work-pane');
    const inboxText = document.getElementById('inbox-text');
    const inboxStatus = document.getElementById('inbox-status');
    const inboxRun = document.getElementById('inbox-run');
    const resultFoot = document.getElementById('result-foot');
    const replyBar = document.getElementById('reply-bar');
    const refineBar = document.getElementById('refine-bar');
    const refineWrap = document.getElementById('refine-wrap');
    const refineEditor = document.getElementById('refine-editor');
    const refineStatus = document.getElementById('refine-status');
    const refineHint = document.getElementById('refine-hint');
    const refineAgainBtn = document.getElementById('refine-again');
    const suggestBtn = document.getElementById('suggest-reply');
    const replyHint = document.getElementById('reply-hint');
    const repliesWrap = document.getElementById('replies-wrap');
    const repliesEditor = document.getElementById('replies-editor');
    const repliesFallback = document.getElementById('replies');
    const repliesStatus = document.getElementById('replies-status');
    const summaryLabel = document.getElementById('summary-label');
    const scroll = document.getElementById('scroll');
    let latestSummary = '';
    let latestReplies = '';
    let latestRefine = '';
    let mode = '';
    let sections = [];
    let refineSections = [];
    let syncTimer = null;
    let refineSyncTimer = null;
    let renderSeq = 0;

    function selectedInboxSkill() {
      const el = document.querySelector('input[name="inbox-skill"]:checked');
      return el ? el.value : 'summarize';
    }

    function setInboxSkill(skill) {
      const id = skill === 'refine' || skill === 'suggest-reply' ? skill : 'summarize';
      const el = document.querySelector('input[name="inbox-skill"][value="' + id + '"]');
      if (el) el.checked = true;
    }

    async function pasteClipboardIntoInbox() {
      try {
        const text = await api.readClipboard();
        if (text) inboxText.value = text;
        inboxStatus.textContent = text
          ? 'Clipboard pasted. Choose a skill and Run.'
          : 'Clipboard is empty — copy text in the app first, then paste here.';
      } catch (err) {
        inboxStatus.textContent = String(err?.message || err || 'Could not read clipboard.');
      }
    }

    const REFINE_LANGS = [
      { id: 'en', heading: '## English', label: 'English' },
      { id: 'hi', heading: '## Hindi (हिन्दी)', label: 'Hindi (हिन्दी)' },
      { id: 'mr', heading: '## Marathi (मराठी)', label: 'Marathi (मराठी)' },
    ];

    const LANGS = [
      { id: 'en', heading: '## English replies', label: 'English' },
      { id: 'hi', heading: '## Hindi replies (हिन्दी)', label: 'Hindi (हिन्दी)' },
      { id: 'mr', heading: '## Marathi replies (मराठी)', label: 'Marathi (मराठी)' },
    ];

    function matchHeading(line) {
      const t = String(line || '').trim();
      if (!t) return null;
      const lower = t.toLowerCase();
      for (const section of LANGS) {
        if (t === section.heading || lower.startsWith(section.heading.toLowerCase())) return section.id;
      }
      if (/^##\\s*english/i.test(t)) return 'en';
      if (/^##\\s*hindi/i.test(t)) return 'hi';
      if (/^##\\s*marathi/i.test(t)) return 'mr';
      return null;
    }

    function stripOptionPrefix(line) {
      return String(line || '').replace(/^\\s*(?:\\d+[.)]|[-*•])\\s*/, '').trim();
    }

    function parseReplies(text) {
      const base = LANGS.map((s) => ({ id: s.id, heading: s.heading, label: s.label, items: [] }));
      const byId = Object.fromEntries(base.map((s) => [s.id, s]));
      const raw = String(text || '').replace(/\\r\\n/g, '\\n').trim();
      if (!raw) return base;
      let current = null;
      for (const line of raw.split('\\n')) {
        const headingId = matchHeading(line);
        if (headingId) { current = headingId; continue; }
        if (!current) current = 'en';
        const trimmed = line.trim();
        if (!trimmed) continue;
        const item = stripOptionPrefix(trimmed);
        if (!item) continue;
        byId[current].items.push({ text: item });
      }
      for (const section of base) {
        if (!section.items.length) section.items.push({ text: '' });
      }
      return base;
    }

    function serializeReplies(list) {
      return (list || []).map((section) => {
        const meta = LANGS.find((s) => s.id === section.id) || section;
        const items = (section.items || []).map((item) => String(item?.text || '').trim()).filter(Boolean);
        if (!items.length) return '';
        return meta.heading + '\\n' + items.map((t, i) => (i + 1) + ') ' + t).join('\\n');
      }).filter(Boolean).join('\\n\\n');
    }

    function matchRefineHeading(line) {
      const t = String(line || '').trim();
      if (!t) return null;
      const lower = t.toLowerCase();
      for (const section of REFINE_LANGS) {
        if (t === section.heading || lower.startsWith(section.heading.toLowerCase())) return section.id;
      }
      if (/^##\\s*english\\b/i.test(t)) return 'en';
      if (/^##\\s*hindi\\b/i.test(t)) return 'hi';
      if (/^##\\s*marathi\\b/i.test(t)) return 'mr';
      return null;
    }

    function parseRefineSections(text) {
      const base = REFINE_LANGS.map((s) => ({ id: s.id, heading: s.heading, label: s.label, text: '' }));
      const byId = Object.fromEntries(base.map((s) => [s.id, s]));
      const raw = String(text || '').replace(/\\r\\n/g, '\\n').trim();
      if (!raw) return base;
      if (!/^##\\s+/m.test(raw)) {
        byId.en.text = raw;
        return base;
      }
      let current = null;
      const buckets = { en: [], hi: [], mr: [] };
      for (const line of raw.split('\\n')) {
        const headingId = matchRefineHeading(line);
        if (headingId) { current = headingId; continue; }
        if (!current) current = 'en';
        buckets[current].push(line);
      }
      for (const id of Object.keys(buckets)) {
        byId[id].text = buckets[id].join('\\n').trim();
      }
      return base;
    }

    function serializeRefineSections(list) {
      return (list || []).map((section) => {
        const meta = REFINE_LANGS.find((s) => s.id === section.id) || section;
        const body = String(section?.text || '').trim();
        if (!body) return '';
        return meta.heading + '\\n' + body;
      }).filter(Boolean).join('\\n\\n');
    }

    function copyText() {
      if (mode === 'refine') {
        return refineSections.length
          ? serializeRefineSections(refineSections)
          : String(latestRefine || '').trim();
      }
      const repliesText = sections.length ? serializeReplies(sections) : latestReplies;
      const parts = [latestSummary, repliesText].filter(Boolean);
      return parts.join('\\n\\n—\\n\\n');
    }

    function setRefineStatus(msg) {
      if (!msg) {
        refineStatus.hidden = true;
        refineStatus.textContent = '';
        return;
      }
      refineStatus.hidden = false;
      refineStatus.textContent = msg;
    }

    function scheduleRefineSync() {
      latestRefine = serializeRefineSections(refineSections);
      clearTimeout(refineSyncTimer);
      refineSyncTimer = setTimeout(() => {
        if (api.syncRefine) api.syncRefine({ sections: refineSections, text: latestRefine });
      }, 200);
    }

    function anyRefineText() {
      return refineSections.some((s) => String(s.text || '').trim());
    }

    function renderRefineEditor() {
      refineEditor.innerHTML = '';
      refineSections.forEach((section) => {
        const wrap = document.createElement('div');
        wrap.className = 'refine-lang';
        const head = document.createElement('div');
        head.className = 'refine-lang-head';
        const title = document.createElement('strong');
        title.textContent = section.label;
        head.appendChild(title);
        wrap.appendChild(head);

        const ta = document.createElement('textarea');
        ta.value = section.text || '';
        ta.rows = 3;
        ta.placeholder = 'Refined draft in ' + section.label + '…';
        ta.oninput = () => {
          section.text = ta.value;
          scheduleRefineSync();
          copyBtn.disabled = !anyRefineText();
          refineAgainBtn.disabled = !anyRefineText();
        };

        const actions = document.createElement('div');
        actions.className = 'refine-lang-actions';

        const copyOne = document.createElement('button');
        copyOne.type = 'button';
        copyOne.className = 'btn small primary';
        copyOne.textContent = 'Copy';
        copyOne.onclick = async () => {
          const t = String(ta.value || '').trim();
          if (!t) return;
          await api.copy(t);
          copyOne.textContent = 'Copied';
          setTimeout(() => { copyOne.textContent = 'Copy'; }, 1000);
        };

        actions.appendChild(copyOne);
        wrap.appendChild(ta);
        wrap.appendChild(actions);
        refineEditor.appendChild(wrap);
      });
    }

    function scheduleSync() {
      latestReplies = serializeReplies(sections);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        if (api.syncReplies) api.syncReplies(latestReplies);
      }, 200);
    }

    function setStatus(msg) {
      if (!msg) {
        repliesStatus.hidden = true;
        repliesStatus.textContent = '';
        return;
      }
      repliesStatus.hidden = false;
      repliesStatus.textContent = msg;
    }

    function renderEditor() {
      const seq = ++renderSeq;
      repliesEditor.hidden = false;
      repliesFallback.hidden = true;
      repliesEditor.innerHTML = '';
      sections.forEach((section, sIdx) => {
        const wrap = document.createElement('div');
        wrap.className = 'reply-lang';
        const head = document.createElement('div');
        head.className = 'reply-lang-head';
        const title = document.createElement('strong');
        title.textContent = section.label;
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn small';
        addBtn.textContent = 'Add reply';
        addBtn.onclick = () => {
          section.items.push({ text: '' });
          renderEditor();
          scheduleSync();
          const last = repliesEditor.querySelectorAll('textarea');
          const el = last[last.length - 1];
          if (el) el.focus();
        };
        head.appendChild(title);
        head.appendChild(addBtn);
        wrap.appendChild(head);

        section.items.forEach((item, iIdx) => {
          const card = document.createElement('div');
          card.className = 'reply-card';
          const ta = document.createElement('textarea');
          ta.value = item.text || '';
          ta.rows = 3;
          ta.placeholder = 'Edit this reply, or write your own…';
          ta.oninput = () => {
            item.text = ta.value;
            scheduleSync();
          };
          const actions = document.createElement('div');
          actions.className = 'reply-card-actions';

          const copyOne = document.createElement('button');
          copyOne.type = 'button';
          copyOne.className = 'btn small primary';
          copyOne.textContent = 'Copy';
          copyOne.onclick = async () => {
            const t = String(ta.value || '').trim();
            if (!t) return;
            await api.copy(t);
            copyOne.textContent = 'Copied';
            setTimeout(() => { if (seq === renderSeq) copyOne.textContent = 'Copy'; }, 1000);
          };

          const revise = document.createElement('button');
          revise.type = 'button';
          revise.className = 'btn small';
          revise.textContent = 'Revise with AI';
          revise.onclick = async () => {
            const draft = String(ta.value || '').trim();
            if (!draft) {
              setStatus('Type a reply first, then Revise with AI.');
              return;
            }
            revise.disabled = true;
            ta.disabled = true;
            setStatus('Revising reply…');
            try {
              const result = await api.reviseReply({
                replyText: draft,
                language: section.id,
              });
              if (result?.ok && result.text) {
                item.text = String(result.text).trim();
                ta.value = item.text;
                scheduleSync();
                setStatus('Revised — edit further if needed, then Copy.');
              } else {
                setStatus(String(result?.error || 'Could not revise reply.'));
              }
            } catch (err) {
              setStatus(String(err?.message || err || 'Could not revise reply.'));
            } finally {
              revise.disabled = false;
              ta.disabled = false;
            }
          };

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn small danger';
          remove.textContent = 'Remove';
          remove.onclick = () => {
            if (section.items.length <= 1) {
              item.text = '';
              ta.value = '';
            } else {
              section.items.splice(iIdx, 1);
              renderEditor();
            }
            scheduleSync();
          };

          actions.appendChild(copyOne);
          actions.appendChild(revise);
          actions.appendChild(remove);
          card.appendChild(ta);
          card.appendChild(actions);
          wrap.appendChild(card);
        });
        repliesEditor.appendChild(wrap);
      });
    }

    function showPlainReplies(text, className) {
      repliesEditor.hidden = true;
      repliesEditor.innerHTML = '';
      sections = [];
      repliesFallback.hidden = false;
      repliesFallback.className = 'body' + (className ? ' ' + className : '');
      repliesFallback.textContent = text;
    }

    api.onInit((data) => {
      document.getElementById('title').textContent = data?.title || 'Aspera AI';
      document.getElementById('meta').textContent = data?.meta || '';
      mode = String(data?.mode || (data?.canUseInCompose ? 'refine' : ''));
      latestSummary = String(data?.text || '');
      latestReplies = String(data?.repliesText || '');
      const err = !!data?.error;
      const loading = !!data?.loading;
      const isInbox = mode === 'inbox';
      const isRefine = mode === 'refine';
      const resultActions = document.getElementById('result-actions');

      inbox.classList.toggle('show', isInbox);
      workPane.classList.toggle('hide', isInbox);
      copyBtn.style.display = isInbox ? 'none' : '';
      resultFoot.hidden = true;
      if (resultActions) {
        resultActions.classList.toggle('show', !isInbox && !loading);
      }

      if (isInbox) {
        if (data?.pasteText != null) inboxText.value = String(data.pasteText || '');
        if (data?.skill) setInboxSkill(data.skill);
        inboxStatus.textContent =
          data?.hint ||
          'Same on every app: copy → paste here → copy result → paste back. Hub never sends for you.';
        inboxRun.disabled = false;
        copyBtn.disabled = true;
        return;
      }

      if (isRefine && !loading && !err) {
        body.hidden = true;
        refineWrap.classList.add('show');
        latestRefine = latestSummary;
        if (Array.isArray(data?.refineSections) && data.refineSections.length) {
          refineSections = data.refineSections.map((s) => ({
            id: s.id,
            heading: s.heading,
            label: s.label,
            text: String(s?.text || ''),
          }));
        } else {
          refineSections = parseRefineSections(latestRefine);
        }
        latestRefine = serializeRefineSections(refineSections);
        renderRefineEditor();
        setRefineStatus('');
        summaryLabel.hidden = true;
        copyBtn.textContent = 'Copy all';
        resultFoot.hidden = false;
      } else {
        body.hidden = false;
        refineWrap.classList.remove('show');
        refineEditor.innerHTML = '';
        refineSections = [];
        body.className = 'body' + (err ? ' error' : loading ? ' loading' : '');
        body.textContent = latestSummary || (err ? String(data.error) : '…');
        summaryLabel.hidden = !(data?.showTrilingual && !loading && !err && latestSummary);
        copyBtn.textContent = 'Copy all';
        if (isRefine && (loading || err)) {
          setRefineStatus('');
        }
        if (!loading && !err && latestSummary) resultFoot.hidden = false;
      }

      const showReplyToolbar = !!(data?.canSuggestReply && !loading && !err && !isRefine);
      replyBar.classList.toggle('show', showReplyToolbar);
      refineBar.classList.toggle('show', !!(isRefine && !loading && !err));
      refineAgainBtn.disabled = isRefine ? !anyRefineText() : true;
      refineHint.textContent = 'Edit any language, then Copy and paste into the app yourself';

      suggestBtn.disabled = !!data?.repliesLoading;
      suggestBtn.textContent = latestReplies || data?.repliesError
        ? 'Regenerate replies'
        : 'Suggest replies (EN · HI · MR)';
      replyHint.textContent = data?.repliesLoading
        ? 'Writing reply drafts…'
        : latestReplies
          ? 'Edit, add, or revise any reply, then Copy'
          : 'Rough drafts — copy and paste into the app yourself';

      if (isRefine) {
        repliesWrap.classList.remove('show');
        setStatus('');
        showPlainReplies('');
        repliesFallback.textContent = '';
      } else if (data?.repliesLoading) {
        repliesWrap.classList.add('show');
        setStatus('');
        showPlainReplies('Writing reply drafts in English, Hindi, and Marathi…', 'loading');
        scroll.scrollTop = scroll.scrollHeight;
      } else if (latestReplies) {
        repliesWrap.classList.add('show');
        setStatus('');
        if (Array.isArray(data?.repliesSections) && data.repliesSections.length) {
          sections = data.repliesSections.map((s) => ({
            id: s.id,
            heading: s.heading,
            label: s.label,
            items: (s.items || []).map((item) => ({ text: String(item?.text || '') })),
          }));
        } else {
          sections = parseReplies(latestReplies);
        }
        renderEditor();
        latestReplies = serializeReplies(sections);
        resultFoot.hidden = false;
      } else if (data?.repliesError) {
        repliesWrap.classList.add('show');
        setStatus('');
        showPlainReplies(String(data.repliesError), 'error');
      } else {
        repliesWrap.classList.remove('show');
        setStatus('');
        showPlainReplies('');
        repliesFallback.textContent = '';
      }
      const hasReplyText = sections.some((s) => s.items.some((i) => String(i.text || '').trim()));
      copyBtn.disabled =
        (isRefine ? !anyRefineText() : (!latestSummary && !latestReplies && !hasReplyText))
        || err
        || loading;
    });

    document.getElementById('inbox-paste').onclick = () => {
      pasteClipboardIntoInbox().catch(() => {});
    };
    document.getElementById('inbox-clear').onclick = () => {
      inboxText.value = '';
      inboxStatus.textContent = 'Cleared. Paste text from any app, then Run.';
      inboxText.focus();
    };
    async function goNewPaste() {
      if (api.newPaste) await api.newPaste();
    }
    document.getElementById('new-paste')?.addEventListener('click', () => {
      goNewPaste().catch(() => {});
    });
    document.getElementById('new-paste-any')?.addEventListener('click', () => {
      goNewPaste().catch(() => {});
    });
    inboxRun.onclick = async () => {
      const text = String(inboxText.value || '').trim();
      if (!text) {
        inboxStatus.textContent = 'Paste text first (copy from the app, then Ctrl+V here).';
        inboxText.focus();
        return;
      }
      inboxRun.disabled = true;
      inboxStatus.textContent = 'Running Aspera AI…';
      try {
        const result = await api.runClipboard({
          skill: selectedInboxSkill(),
          text,
        });
        if (result?.ok === false) {
          inboxStatus.textContent = String(result.error || 'Could not run Aspera AI.');
          inboxRun.disabled = false;
        }
      } catch (err) {
        inboxStatus.textContent = String(err?.message || err || 'Could not run Aspera AI.');
        inboxRun.disabled = false;
      }
    };

    refineAgainBtn.onclick = async () => {
      refineAgainBtn.disabled = true;
      setRefineStatus('Refining again in English, Hindi, and Marathi…');
      await api.refineAgain({});
    };

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
