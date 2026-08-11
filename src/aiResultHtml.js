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
  .reply-lang-head strong, .lang-label {
    font-size:14px; font-weight:700;
  }
  .lang-label.lang-en { color:#1d4ed8; }
  .lang-label.lang-hi { color:#c2410c; }
  .lang-label.lang-mr { color:#047857; }
  .lang-label.lang-bn { color:#be185d; }
  .lang-label.lang-te { color:#7c3aed; }
  .lang-label.lang-ta { color:#0f766e; }
  .lang-label.lang-gu { color:#b45309; }
  .lang-label.lang-kn { color:#4338ca; }
  .lang-label.lang-or { color:#e11d48; }
  .lang-label.lang-ml { color:#0284c7; }
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
  .refine-lang-head, .summary-lang-head {
    display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;
  }
  .summary-wrap { display:none; flex-direction:column; gap:12px; flex:0 0 auto; }
  .summary-wrap.show { display:flex; }
  .summary-lang {
    background:${card}; border-radius:12px; padding:12px 14px;
    display:flex; flex-direction:column; gap:8px;
  }
  .summary-lang-body {
    white-space:pre-wrap; word-break:break-word; font-weight:500;
    font-size:15px; line-height:1.55;
    border:1px solid ${border}; border-radius:10px; padding:10px 12px;
    background:${inputBg}; min-height:64px;
  }
  .summary-lang-actions, .refine-lang-actions { display:flex; gap:6px; flex-wrap:wrap; }
  .refine-lang textarea {
    width:100%; box-sizing:border-box; min-height:88px; resize:vertical;
    border:1px solid ${border}; border-radius:10px; padding:10px 12px;
    font:inherit; font-size:15px; line-height:1.55; color:inherit; background:${inputBg};
  }
  .refine-lang textarea:focus { outline:2px solid #2563eb55; border-color:#2563eb; }
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
  .attach-row {
    display:flex; flex-wrap:wrap; gap:8px; align-items:center; flex:0 0 auto;
  }
  .attach-chip {
    display:none; align-items:center; gap:8px; max-width:100%;
    padding:7px 10px; border-radius:9px; background:${card};
    border:1px solid ${border}; font-size:12px; font-weight:600;
  }
  .attach-chip.show { display:inline-flex; }
  .attach-chip .name {
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;
  }
  .attach-chip .meta { color:${muted}; font-weight:600; }
  .drop-hint {
    color:${muted}; font-size:12px; font-weight:600; line-height:1.4;
  }
  .inbox.drag {
    outline:2px dashed #2563eb88; outline-offset:-4px; border-radius:12px;
  }
  .inbox-foot {
    color:${muted}; font-size:12px; font-weight:600; line-height:1.4; flex:0 0 auto;
  }
  .voice-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; flex:0 0 auto; }
  .btn.recording { background:#dc2626; color:#fff; }
  .btn.recording:hover { background:#b91c1c; color:#fff; }
  .voice-timer { color:${muted}; font-size:12px; font-weight:700; min-width:3.5em; }
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
      <div class="section-label">Your text (or paste a screenshot)</div>
      <textarea id="inbox-text" placeholder="Copy text — or use the mic below for voice. Or attach a PDF/image for Summarize."></textarea>
      <div class="actions">
        <button type="button" class="btn" id="inbox-paste">Paste from clipboard</button>
        <button type="button" class="btn" id="inbox-clear">Clear text</button>
      </div>
      <div class="section-label">Or speak (voice → text in your languages)</div>
      <div class="voice-row">
        <button type="button" class="btn" id="voice-mic" title="Record up to 30 seconds">🎤 Record</button>
        <button type="button" class="btn danger" id="voice-stop" disabled>Stop</button>
        <button type="button" class="btn primary" id="voice-send" disabled>Send voice</button>
        <span class="voice-timer" id="voice-timer"></span>
      </div>
      <div class="section-label">Or attach a file (Summarize)</div>
      <div class="attach-row">
        <button type="button" class="btn" id="inbox-attach">Upload PDF / image…</button>
        <input type="file" id="inbox-file" accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif" hidden />
        <span class="drop-hint">or drop a file / paste a screenshot</span>
      </div>
      <div class="attach-chip" id="attach-chip">
        <span class="name" id="attach-name">file</span>
        <span class="meta" id="attach-meta"></span>
        <button type="button" class="btn small danger" id="attach-remove">Remove</button>
      </div>
      <div class="inbox-skills" role="radiogroup" aria-label="Aspera AI skill">
        <div class="section-label">What do you need?</div>
        <label><input type="radio" name="inbox-skill" value="summarize" checked /> Summarize</label>
        <label id="skill-refine-label"><input type="radio" name="inbox-skill" value="refine" /> Refine draft</label>
        <label id="skill-suggest-label"><input type="radio" name="inbox-skill" value="suggest-reply" /> Suggest reply</label>
      </div>
      <div class="actions">
        <button type="button" class="btn primary" id="inbox-run">Run Aspera AI</button>
      </div>
      <p class="inbox-foot" id="inbox-status">
        Paste text, record your voice (mic), or attach a PDF/image. Voice uses Sarvam or Gemini (max 30s). Hub never sends for you.
      </p>
    </div>
    <div class="work-pane" id="work-pane">
    <div class="toolbar" id="result-actions">
      <button type="button" class="btn" id="new-paste-any">New paste</button>
      <span class="hint">Same window — paste new text to run again</span>
    </div>
    <div class="toolbar" id="reply-bar">
      <button type="button" class="btn primary" id="suggest-reply">Suggest replies</button>
      <span class="hint" id="reply-hint">Rough drafts — copy and paste into the app yourself</span>
    </div>
    <div class="toolbar" id="refine-bar">
      <button type="button" class="btn" id="refine-again">Refine again</button>
      <button type="button" class="btn" id="new-paste">New paste</button>
      <span class="hint" id="refine-hint">Pick a language — then Copy and paste yourself</span>
    </div>
    <div class="scroll" id="scroll">
      <div class="section-label" id="summary-label" hidden>Summary</div>
      <div class="body loading" id="body">Working…</div>
      <div class="summary-wrap" id="summary-wrap">
        <div id="summary-editor"></div>
      </div>
      <div class="refine-wrap" id="refine-wrap">
        <div class="section-label" id="refine-section-label">Refined message</div>
        <div id="refine-editor"></div>
        <div class="reply-status" id="refine-status" hidden></div>
      </div>
      <div class="replies-block" id="replies-wrap">
        <div class="section-label" id="replies-section-label">Suggested replies</div>
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
    const summaryWrap = document.getElementById('summary-wrap');
    const summaryEditor = document.getElementById('summary-editor');
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
    let summarySections = [];
    let syncTimer = null;
    let refineSyncTimer = null;
    let renderSeq = 0;
    let stagedAttachment = null;
    const VOICE_MAX_SEC = 30;
    let mediaRecorder = null;
    let voiceStream = null;
    let voiceChunks = [];
    let voiceBlob = null;
    let voiceMime = 'audio/webm';
    let voiceTimerId = null;
    let voiceStartedAt = 0;

    const voiceMicBtn = document.getElementById('voice-mic');
    const voiceStopBtn = document.getElementById('voice-stop');
    const voiceSendBtn = document.getElementById('voice-send');
    const voiceTimerEl = document.getElementById('voice-timer');

    function resetVoiceUi() {
      if (!voiceMicBtn) return;
      voiceMicBtn.disabled = false;
      voiceMicBtn.classList.remove('recording');
      voiceMicBtn.textContent = '🎤 Record';
      if (voiceStopBtn) voiceStopBtn.disabled = true;
      if (voiceSendBtn) voiceSendBtn.disabled = !voiceBlob;
      if (voiceTimerEl) voiceTimerEl.textContent = voiceBlob ? 'Ready' : '';
      if (voiceTimerId) {
        clearInterval(voiceTimerId);
        voiceTimerId = null;
      }
    }

    function clearVoiceState() {
      if (voiceTimerId) {
        clearInterval(voiceTimerId);
        voiceTimerId = null;
      }
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      } catch {
        // ignore
      }
      stopVoiceStream();
      mediaRecorder = null;
      voiceChunks = [];
      voiceBlob = null;
      voiceMime = 'audio/webm';
      voiceStartedAt = 0;
      resetVoiceUi();
    }

    function stopVoiceStream() {
      try {
        if (voiceStream) voiceStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      voiceStream = null;
    }

    function pickVoiceMimeType() {
      if (typeof MediaRecorder === 'undefined') return '';
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      for (const t of candidates) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return '';
    }

    function updateVoiceTimer() {
      if (!voiceStartedAt || !voiceTimerEl) return;
      const sec = Math.min(VOICE_MAX_SEC, Math.floor((Date.now() - voiceStartedAt) / 1000));
      voiceTimerEl.textContent = sec + 's / ' + VOICE_MAX_SEC + 's';
      if (sec >= VOICE_MAX_SEC) stopVoiceRecording();
    }

    async function startVoiceRecording() {
      if (!navigator.mediaDevices?.getUserMedia) {
        inboxStatus.textContent =
          'Microphone not available in this window — paste text instead.';
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        inboxStatus.textContent = 'Voice recording is not supported here.';
        return;
      }
      try {
        stopVoiceStream();
        voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceChunks = [];
        voiceBlob = null;
        const mimeType = pickVoiceMimeType();
        mediaRecorder = mimeType
          ? new MediaRecorder(voiceStream, { mimeType })
          : new MediaRecorder(voiceStream);
        voiceMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size) voiceChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          stopVoiceStream();
          if (voiceChunks.length) {
            voiceBlob = new Blob(voiceChunks, { type: voiceMime });
            if (voiceSendBtn) voiceSendBtn.disabled = false;
            if (voiceTimerEl) voiceTimerEl.textContent = 'Ready';
            inboxStatus.textContent =
              'Recording ready — click Send voice to convert to text in your languages.';
          } else {
            inboxStatus.textContent = 'No audio captured — try Record again.';
          }
          resetVoiceUi();
          if (voiceBlob && voiceSendBtn) voiceSendBtn.disabled = false;
        };
        mediaRecorder.start(250);
        voiceStartedAt = Date.now();
        voiceMicBtn.disabled = true;
        voiceMicBtn.classList.add('recording');
        voiceMicBtn.textContent = 'Recording…';
        if (voiceStopBtn) voiceStopBtn.disabled = false;
        if (voiceSendBtn) voiceSendBtn.disabled = true;
        if (voiceTimerEl) voiceTimerEl.textContent = '0s / ' + VOICE_MAX_SEC + 's';
        voiceTimerId = setInterval(updateVoiceTimer, 200);
        inboxStatus.textContent =
          'Recording… speak now (max ' + VOICE_MAX_SEC + ' seconds). Click Stop when done.';
      } catch (err) {
        stopVoiceStream();
        resetVoiceUi();
        inboxStatus.textContent = String(
          err?.message || err || 'Could not access microphone.',
        );
      }
    }

    function stopVoiceRecording() {
      if (voiceTimerId) {
        clearInterval(voiceTimerId);
        voiceTimerId = null;
      }
      if (voiceMicBtn) {
        voiceMicBtn.disabled = false;
        voiceMicBtn.classList.remove('recording');
        voiceMicBtn.textContent = '🎤 Record';
      }
      if (voiceStopBtn) voiceStopBtn.disabled = true;
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      } catch {
        // ignore
      }
    }

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf('base64,');
          resolve(idx >= 0 ? result.slice(idx + 7) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('Could not read audio'));
        reader.readAsDataURL(blob);
      });
    }

    voiceMicBtn?.addEventListener('click', () => {
      startVoiceRecording().catch(() => {});
    });
    voiceStopBtn?.addEventListener('click', () => {
      stopVoiceRecording();
    });
    voiceSendBtn?.addEventListener('click', async () => {
      if (!voiceBlob) {
        inboxStatus.textContent = 'Record your voice first, then Send.';
        return;
      }
      if (voiceSendBtn) voiceSendBtn.disabled = true;
      if (voiceMicBtn) voiceMicBtn.disabled = true;
      inboxStatus.textContent = 'Sending voice for transcription…';
      try {
        const base64 = await blobToBase64(voiceBlob);
        const result = await api.transcribeVoice({
          base64,
          mime: voiceMime,
        });
        if (result?.ok === false) {
          inboxStatus.textContent = String(result.error || 'Voice input failed.');
          if (voiceSendBtn) voiceSendBtn.disabled = false;
          if (voiceMicBtn) voiceMicBtn.disabled = false;
        }
      } catch (err) {
        inboxStatus.textContent = String(err?.message || err || 'Voice input failed.');
        if (voiceSendBtn) voiceSendBtn.disabled = false;
        if (voiceMicBtn) voiceMicBtn.disabled = false;
      }
    });

    function langLabelClass(id) {
      const key = String(id || 'en').toLowerCase().replace(/[^a-z]/g, '');
      return 'lang-label lang-' + (key || 'en');
    }

    function bindCopyButton(btn, getText) {
      btn.type = 'button';
      btn.className = 'btn small primary';
      btn.textContent = 'Copy';
      btn.onclick = async () => {
        const t = String(getText() || '').trim();
        if (!t) return;
        await api.copy(t);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1000);
      };
      return btn;
    }

    function selectedInboxSkill() {
      const el = document.querySelector('input[name="inbox-skill"]:checked');
      return el ? el.value : 'summarize';
    }

    function setInboxSkill(skill) {
      const id = skill === 'refine' || skill === 'suggest-reply' ? skill : 'summarize';
      const el = document.querySelector('input[name="inbox-skill"][value="' + id + '"]');
      if (el) el.checked = true;
    }

    function formatSize(n) {
      const b = Number(n) || 0;
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
      return (b / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function syncAttachmentUi() {
      const chip = document.getElementById('attach-chip');
      const nameEl = document.getElementById('attach-name');
      const metaEl = document.getElementById('attach-meta');
      const refineLab = document.getElementById('skill-refine-label');
      const suggestLab = document.getElementById('skill-suggest-label');
      const has = !!stagedAttachment;
      chip.classList.toggle('show', has);
      if (has) {
        nameEl.textContent = stagedAttachment.name || 'file';
        metaEl.textContent =
          (stagedAttachment.kind === 'pdf' ? 'PDF' : 'Image') +
          ' · ' +
          formatSize(stagedAttachment.size);
        setInboxSkill('summarize');
      }
      if (refineLab) refineLab.style.opacity = has ? '0.45' : '';
      if (suggestLab) suggestLab.style.opacity = has ? '0.45' : '';
      const refineIn = document.querySelector('input[name="inbox-skill"][value="refine"]');
      const suggestIn = document.querySelector('input[name="inbox-skill"][value="suggest-reply"]');
      if (refineIn) refineIn.disabled = has;
      if (suggestIn) suggestIn.disabled = has;
    }

    async function clearStagedAttachment() {
      stagedAttachment = null;
      try {
        if (api.clearAttachment) await api.clearAttachment();
      } catch {
        // ignore
      }
      syncAttachmentUi();
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf('base64,');
          resolve(idx >= 0 ? result.slice(idx + 7) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
    }

    async function stageLocalFile(file) {
      if (!file) return;
      inboxStatus.textContent = 'Attaching ' + (file.name || 'file') + '…';
      try {
        const base64 = await fileToBase64(file);
        const result = await api.attachFile({
          name: file.name || 'file',
          mime: file.type || '',
          base64,
        });
        if (!result?.ok) {
          inboxStatus.textContent = String(result?.error || 'Could not attach file.');
          return;
        }
        stagedAttachment = result.attachment;
        syncAttachmentUi();
        inboxStatus.textContent =
          'Attached ' +
          (stagedAttachment.name || 'file') +
          '. Summarize is selected — Run Aspera AI.';
      } catch (err) {
        inboxStatus.textContent = String(err?.message || err || 'Could not attach file.');
      }
    }

    async function pasteClipboardIntoInbox() {
      try {
        if (api.pasteClipboard) {
          const result = await api.pasteClipboard();
          if (!result?.ok) {
            inboxStatus.textContent = String(
              result?.error ||
                'Clipboard is empty — copy text, or take a screenshot and paste.',
            );
            return;
          }
          if (result.kind === 'image' && result.attachment) {
            stagedAttachment = result.attachment;
            syncAttachmentUi();
            inboxStatus.textContent =
              'Screenshot attached from clipboard. Summarize is selected — Run Aspera AI.';
            return;
          }
          const text = String(result.text || '');
          if (text) inboxText.value = text;
          inboxStatus.textContent = text
            ? 'Clipboard text pasted. Choose a skill and Run — or paste a screenshot for Summarize.'
            : 'Clipboard is empty — copy text, or take a screenshot and paste.';
          return;
        }
        const text = await api.readClipboard();
        if (text) inboxText.value = text;
        inboxStatus.textContent = text
          ? 'Clipboard pasted. Choose a skill and Run — or attach a PDF/image for Summarize.'
          : 'Clipboard is empty — paste text, or attach a PDF/image for Summarize.';
      } catch (err) {
        inboxStatus.textContent = String(err?.message || err || 'Could not read clipboard.');
      }
    }

    let languageMeta = 'EN · HI · MR';
    let REFINE_LANGS = [
      { id: 'en', heading: '## English', label: 'English', name: 'English' },
      { id: 'hi', heading: '## Hindi (हिन्दी)', label: 'Hindi (हिन्दी)', name: 'Hindi' },
      { id: 'mr', heading: '## Marathi (मराठी)', label: 'Marathi (मराठी)', name: 'Marathi' },
    ];
    let LANGS = [
      { id: 'en', heading: '## English replies', label: 'English', name: 'English' },
      { id: 'hi', heading: '## Hindi replies (हिन्दी)', label: 'Hindi (हिन्दी)', name: 'Hindi' },
      { id: 'mr', heading: '## Marathi replies (मराठी)', label: 'Marathi (मराठी)', name: 'Marathi' },
    ];

    function escapeRegExp(value) {
      return String(value || '').replace(/[.*+?^$()|[\\]\\\\{}]/g, '\\\\$&');
    }

    function applyOutputLanguages(list, meta) {
      if (Array.isArray(list) && list.length) {
        REFINE_LANGS = list.map((l) => ({
          id: l.id,
          name: l.name || l.label || l.id,
          label: l.label || l.name || l.id,
          heading: l.heading || ('## ' + (l.label || l.name || l.id)),
        }));
        LANGS = list.map((l) => ({
          id: l.id,
          name: l.name || l.label || l.id,
          label: l.label || l.name || l.id,
          heading:
            l.repliesHeading ||
            (l.id === 'en'
              ? '## English replies'
              : ('## ' + (l.name || l.label || l.id) + ' replies' + (l.native ? ' (' + l.native + ')' : ''))),
        }));
      }
      if (meta) languageMeta = String(meta);
      const suggestBtn = document.getElementById('suggest-reply');
      const refineAgainBtn = document.getElementById('refine-again');
      const summaryLabel = document.getElementById('summary-label');
      const refineLabel = document.getElementById('refine-section-label');
      const repliesLabel = document.getElementById('replies-section-label');
      if (suggestBtn) suggestBtn.textContent = 'Suggest replies (' + languageMeta + ')';
      if (refineAgainBtn) refineAgainBtn.textContent = 'Refine again (' + languageMeta + ')';
      if (summaryLabel) summaryLabel.textContent = 'Summary · ' + languageMeta;
      if (refineLabel) refineLabel.textContent = 'Refined message · ' + languageMeta;
      if (repliesLabel) repliesLabel.textContent = 'Suggested replies · ' + languageMeta;
    }

    function matchHeading(line) {
      const t = String(line || '').trim();
      if (!t) return null;
      const lower = t.toLowerCase();
      for (const section of LANGS) {
        if (t === section.heading || lower.startsWith(String(section.heading || '').toLowerCase())) return section.id;
      }
      for (const section of LANGS) {
        const name = section.name || String(section.label || '').split('(')[0].trim();
        if (!name) continue;
        if (new RegExp('^##\\\\s*' + escapeRegExp(name) + '(?:\\\\s+replies)?\\\\b', 'i').test(t)) return section.id;
      }
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
        if (t === section.heading || lower.startsWith(String(section.heading || '').toLowerCase())) return section.id;
      }
      for (const section of REFINE_LANGS) {
        const name = section.name || String(section.label || '').split('(')[0].trim();
        if (!name) continue;
        if (new RegExp('^##\\\\s*' + escapeRegExp(name) + '\\\\b', 'i').test(t)) return section.id;
      }
      return null;
    }

    function parseRefineSections(text) {
      const base = REFINE_LANGS.map((s) => ({ id: s.id, heading: s.heading, label: s.label, text: '' }));
      const byId = Object.fromEntries(base.map((s) => [s.id, s]));
      const raw = String(text || '').replace(/\\r\\n/g, '\\n').trim();
      if (!raw) return base;
      if (!/^##\\s+/m.test(raw)) {
        if (byId.en) byId.en.text = raw;
        else if (base[0]) base[0].text = raw;
        return base;
      }
      let current = null;
      const buckets = Object.fromEntries(base.map((s) => [s.id, []]));
      for (const line of raw.split('\\n')) {
        const headingId = matchRefineHeading(line);
        if (headingId) { current = headingId; continue; }
        if (!current) current = base[0] ? base[0].id : 'en';
        if (!buckets[current]) buckets[current] = [];
        buckets[current].push(line);
      }
      for (const id of Object.keys(buckets)) {
        if (!byId[id]) continue;
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
      const summaryText = summarySections.length
        ? serializeRefineSections(summarySections)
        : latestSummary;
      const repliesText = sections.length ? serializeReplies(sections) : latestReplies;
      const parts = [summaryText, repliesText].filter(Boolean);
      return parts.join('\\n\\n—\\n\\n');
    }

    function anySummaryText() {
      return summarySections.some((s) => String(s.text || '').trim());
    }

    function renderSummaryEditor() {
      if (!summaryEditor) return;
      summaryEditor.innerHTML = '';
      summarySections.forEach((section) => {
        if (!String(section.text || '').trim()) return;
        const wrap = document.createElement('div');
        wrap.className = 'summary-lang';
        const head = document.createElement('div');
        head.className = 'summary-lang-head';
        const title = document.createElement('strong');
        title.className = langLabelClass(section.id);
        title.textContent = section.label;
        const copyOne = document.createElement('button');
        bindCopyButton(copyOne, () => section.text);
        head.appendChild(title);
        head.appendChild(copyOne);
        wrap.appendChild(head);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'summary-lang-body';
        bodyEl.textContent = section.text || '';
        wrap.appendChild(bodyEl);
        summaryEditor.appendChild(wrap);
      });
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
        title.className = langLabelClass(section.id);
        title.textContent = section.label;

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

        const copyOne = document.createElement('button');
        bindCopyButton(copyOne, () => ta.value);
        head.appendChild(title);
        head.appendChild(copyOne);
        wrap.appendChild(head);
        wrap.appendChild(ta);
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
        title.className = langLabelClass(section.id);
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
      applyOutputLanguages(data?.outputLanguages, data?.languageMeta || data?.meta);
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
        stagedAttachment = data?.attachment || null;
        syncAttachmentUi();
        inboxStatus.textContent =
          data?.hint ||
          'Paste text or a screenshot, or attach a PDF/image for Summarize. Hub never sends for you.';
        inboxRun.disabled = false;
        copyBtn.disabled = true;
        return;
      }

      if (isRefine && !loading && !err) {
        body.hidden = true;
        if (summaryWrap) summaryWrap.classList.remove('show');
        summarySections = [];
        if (summaryEditor) summaryEditor.innerHTML = '';
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
      } else if (
        data?.showTrilingual &&
        !loading &&
        !err &&
        latestSummary &&
        !isRefine
      ) {
        // Summarize: per-language cards with colored labels + Copy (like Refine).
        body.hidden = true;
        refineWrap.classList.remove('show');
        refineEditor.innerHTML = '';
        refineSections = [];
        summarySections = parseRefineSections(latestSummary).filter((s) =>
          String(s.text || '').trim(),
        );
        if (!summarySections.length) {
          body.hidden = false;
          body.className = 'body';
          body.textContent = latestSummary;
          if (summaryWrap) summaryWrap.classList.remove('show');
          summaryLabel.hidden = false;
        } else {
          if (summaryWrap) summaryWrap.classList.add('show');
          renderSummaryEditor();
          summaryLabel.hidden = false;
        }
        copyBtn.textContent = 'Copy all';
        resultFoot.hidden = false;
      } else {
        body.hidden = false;
        refineWrap.classList.remove('show');
        refineEditor.innerHTML = '';
        refineSections = [];
        summarySections = [];
        if (summaryWrap) summaryWrap.classList.remove('show');
        if (summaryEditor) summaryEditor.innerHTML = '';
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
        : 'Suggest replies (' + languageMeta + ')';
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
        showPlainReplies('Writing reply drafts (' + languageMeta + ')…', 'loading');
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
        (isRefine
          ? !anyRefineText()
          : (!anySummaryText() && !latestSummary && !latestReplies && !hasReplyText))
        || err
        || loading;
    });

    document.getElementById('inbox-paste').onclick = () => {
      pasteClipboardIntoInbox().catch(() => {});
    };
    document.getElementById('inbox-clear').onclick = () => {
      inboxText.value = '';
      inboxStatus.textContent =
        'Text cleared. Paste text or a screenshot, or attach a PDF/image, then Run.';
      inboxText.focus();
    };
    // Ctrl+V image paste (screenshots) — text paste keeps default textarea behavior.
    document.addEventListener('paste', (event) => {
      if (!inbox.classList.contains('show')) return;
      const items = event.clipboardData?.items;
      if (!items?.length) return;
      for (const item of items) {
        if (item && String(item.type || '').startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          event.preventDefault();
          stageLocalFile(file).catch(() => {});
          return;
        }
      }
    });
    document.getElementById('inbox-attach').onclick = () => {
      document.getElementById('inbox-file')?.click();
    };
    document.getElementById('inbox-file').onchange = (event) => {
      const file = event.target?.files?.[0];
      event.target.value = '';
      stageLocalFile(file).catch(() => {});
    };
    document.getElementById('attach-remove').onclick = () => {
      clearStagedAttachment()
        .then(() => {
          inboxStatus.textContent =
            'Attachment removed. Paste text or a screenshot, or attach another file.';
        })
        .catch(() => {});
    };
    ;['dragenter', 'dragover'].forEach((type) => {
      inbox.addEventListener(type, (e) => {
        e.preventDefault();
        inbox.classList.add('drag');
      });
    });
    ;['dragleave', 'drop'].forEach((type) => {
      inbox.addEventListener(type, (e) => {
        e.preventDefault();
        if (type === 'dragleave') inbox.classList.remove('drag');
      });
    });
    inbox.addEventListener('drop', (e) => {
      inbox.classList.remove('drag');
      const file = e.dataTransfer?.files?.[0];
      stageLocalFile(file).catch(() => {});
    });
    async function goNewPaste() {
      clearVoiceState();
      stagedAttachment = null;
      syncAttachmentUi();
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
      const skill = selectedInboxSkill();
      if (!text && !stagedAttachment) {
        inboxStatus.textContent =
          'Paste text or a screenshot first, or attach a PDF/image and choose Summarize.';
        inboxText.focus();
        return;
      }
      if (stagedAttachment && skill !== 'summarize') {
        inboxStatus.textContent =
          'PDF/image attachments only work with Summarize. Clear the file for Refine or Suggest reply.';
        setInboxSkill('summarize');
        return;
      }
      inboxRun.disabled = true;
      inboxStatus.textContent = stagedAttachment
        ? 'Summarizing attachment…'
        : 'Running Aspera AI…';
      try {
        const result = await api.runClipboard({
          skill,
          text,
          attachmentId: stagedAttachment?.id || '',
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
