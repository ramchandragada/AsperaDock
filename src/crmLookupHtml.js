/** Floating Zoho CRM Deals lookup panel. */

import {
  formatDealWhatsAppMessage,
  formatDealsWhatsAppDigest,
} from './zohoCrm/waDealMessage.js';

export function buildCrmLookupHtml(dark = false) {
  const bg = dark ? '#111827' : '#fff';
  const text = dark ? '#e5e7eb' : '#0f172a';
  const muted = dark ? '#9ca3af' : '#64748b';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const card = dark ? '#1f2937' : '#f8fafc';
  const accent = '#ea580c';
  const soft = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.05)';

  // Inject pure formatters into the float window (no module loader there).
  // Keep fallback path self-contained if prepare IPC fails (v0.4.67 lesson).
  const fmtDealSrc = formatDealWhatsAppMessage.toString();
  const fmtDigestSrc = formatDealsWhatsAppDigest.toString();

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body {
    margin:0; padding:0; width:100%; height:100%;
    background:transparent; overflow:hidden;
    font:500 12.5px/1.3 "Segoe UI","Ubuntu","Cantarell",sans-serif;
    color:${text}; user-select:text;
  }
  .shell {
    margin:3px; width:calc(100% - 6px); height:calc(100% - 6px); box-sizing:border-box;
    background:${bg}; border:1px solid ${border}; border-radius:12px;
    box-shadow:0 12px 40px rgba(15,23,42,0.22); padding:10px 10px 8px;
    display:flex; flex-direction:column; gap:7px; min-height:0;
  }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; flex:0 0 auto; }
  .head-copy { min-width:0; flex:1 1 auto; }
  .head strong { font-size:15px; font-weight:700; letter-spacing:-0.01em; }
  .meta { color:${muted}; font-size:11.5px; font-weight:500; margin-top:1px; }
  .head-actions { display:flex; gap:5px; flex:0 0 auto; flex-wrap:wrap; justify-content:flex-end; }
  .btn {
    border:0; border-radius:7px; padding:5px 9px; font:inherit; font-size:11.5px; font-weight:700;
    cursor:pointer; background:${card}; color:inherit;
  }
  .btn.primary { background:${accent}; color:#fff; }
  .btn:disabled { opacity:0.55; cursor:default; }
  .toolbar {
    display:none; flex:0 0 auto; gap:5px; flex-wrap:wrap;
  }
  .toolbar.show { display:flex; }
  .body { flex:1 1 auto; min-height:0; overflow:auto; display:grid; gap:6px; padding-right:2px; align-content:start; }
  .empty, .error, .loading {
    margin:0; padding:18px 12px; border-radius:8px; background:${soft};
    color:${muted}; text-align:center; font-size:12.5px;
  }
  .error { color:#b91c1c; }
  .deal {
    display:grid; gap:5px; padding:8px 9px; border-radius:9px;
    background:${card}; border:1px solid ${border};
  }
  .deal-top { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; }
  .deal-name { font-size:13px; font-weight:700; min-width:0; line-height:1.25; }
  .stage {
    flex:0 0 auto; border-radius:999px; padding:2px 7px;
    background:${accent}; color:#fff; font-size:10.5px; font-weight:700;
    max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  .fields {
    display:grid; grid-template-columns:1fr 1fr; gap:1px 10px;
    color:${muted}; font-size:11.5px; line-height:1.35;
  }
  .fields b { color:${text}; font-weight:600; }
  .fields .span-2 { grid-column:1 / -1; }
  .actions { display:flex; gap:5px; flex-wrap:wrap; }
</style>
</head>
<body>
  <div class="shell">
    <header class="head">
      <div class="head-copy">
        <strong>Zoho CRM Deals</strong>
        <div class="meta" id="meta">Looking up…</div>
      </div>
      <div class="head-actions">
        <button type="button" class="btn" id="close">Close</button>
      </div>
    </header>
    <div class="toolbar" id="toolbar">
      <button type="button" class="btn primary" id="copy-all">Copy all for WhatsApp</button>
    </div>
    <div class="body" id="body">
      <p class="loading">Searching Deals…</p>
    </div>
  </div>
  <script>
    const api = window.crmLookupApi;
    const formatDealWhatsAppMessage = ${fmtDealSrc};
    const formatDealsWhatsAppDigest = ${fmtDigestSrc};
    let latestDeals = [];
    let latestQuery = '';

    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function money(n) {
      if (n == null || Number.isNaN(Number(n))) return '';
      try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(n)); }
      catch (e) { return String(n); }
    }
    async function copyPrepared(btn, preparePayload, fallbackText, label) {
      if (!btn) return;
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Preparing…';
      let text = '';
      try {
        if (typeof api.prepareCopy === 'function') {
          const result = await api.prepareCopy(preparePayload);
          text = String(result?.text || '').trim();
        }
      } catch (e) {
        text = '';
      }
      if (!text) text = String(fallbackText || '').trim();
      if (!text) {
        btn.textContent = 'Copy failed';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = label || prev; }, 1500);
        return;
      }
      try {
        await api.copy(text);
        btn.textContent = 'Copied';
      } catch (err) {
        btn.textContent = 'Copy failed';
      }
      btn.disabled = false;
      setTimeout(() => { btn.textContent = label || prev; }, 1200);
    }
    function paint(data) {
      const body = document.getElementById('body');
      const meta = document.getElementById('meta');
      const toolbar = document.getElementById('toolbar');
      const q = data?.query ? '"' + data.query + '"' : 'selection';
      latestDeals = [];
      latestQuery = String(data?.query || '');
      toolbar.classList.remove('show');

      if (data?.loading) {
        meta.textContent = 'Looking up ' + q + '…';
        body.innerHTML = '<p class="loading">Searching Deals…</p>';
        return;
      }
      if (data?.error) {
        meta.textContent = 'Lookup failed';
        body.innerHTML = '<p class="error">' + esc(data.error) + '</p>';
        return;
      }
      const deals = data?.deals || [];
      latestDeals = deals;
      meta.textContent = deals.length
        ? deals.length + ' deal' + (deals.length === 1 ? '' : 's') + ' for ' + q
        : 'No deals for ' + q;
      if (!deals.length) {
        body.innerHTML = '<p class="empty">No matching Deals. Try a deal name or account name.</p>';
        return;
      }
      toolbar.classList.add('show');
      body.innerHTML = deals.map((deal, index) => {
        // Stage is shown as the badge — skip it here. Prefer paired meta rows.
        const fields = [];
        if (deal.createdTime) fields.push('<div>Created: <b>' + esc(deal.createdTime) + '</b></div>');
        if (deal.closingDate) fields.push('<div>Close: <b>' + esc(deal.closingDate) + '</b></div>');
        if (deal.amount != null) fields.push('<div>Amount: <b>' + esc(money(deal.amount)) + '</b></div>');
        if (deal.probability != null) fields.push('<div>Probability: <b>' + esc(deal.probability) + '%</b></div>');
        if (deal.state) fields.push('<div>State: <b>' + esc(deal.state) + '</b></div>');
        if (deal.ownerName) fields.push('<div>Owner: <b>' + esc(deal.ownerName) + '</b></div>');
        if (deal.premise) fields.push('<div class="span-2">Premise: <b>' + esc(deal.premise) + '</b></div>');
        if (deal.accountName) fields.push('<div class="span-2">Account: <b>' + esc(deal.accountName) + '</b></div>');
        const stage = deal.stage || 'No stage';
        return '<article class="deal">' +
          '<div class="deal-top">' +
          '<div class="deal-name">' + esc(deal.name) + '</div>' +
          '<span class="stage" title="' + esc(stage) + '">' + esc(stage) + '</span>' +
          '</div>' +
          (fields.length ? '<div class="fields">' + fields.join('') + '</div>' : '') +
          '<div class="actions">' +
          '<button type="button" class="btn primary open-deal" data-index="' + index + '">Open deal</button>' +
          '<button type="button" class="btn copy-message" data-index="' + index + '">Copy message</button>' +
          '<button type="button" class="btn copy-stage" data-index="' + index + '">Copy stage</button>' +
          '</div></article>';
      }).join('');

      body.querySelectorAll('.open-deal').forEach((btn) => {
        btn.addEventListener('click', () => {
          const deal = deals[Number(btn.dataset.index)];
          if (deal?.webUrl) api.openDeal(deal.webUrl);
        });
      });
      body.querySelectorAll('.copy-message').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const deal = deals[Number(btn.dataset.index)];
          if (!deal) return;
          await copyPrepared(
            btn,
            { mode: 'deal', deal },
            formatDealWhatsAppMessage(deal),
            'Copy message',
          );
        });
      });
      body.querySelectorAll('.copy-stage').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const deal = deals[Number(btn.dataset.index)];
          const stageText = deal?.stage || '';
          if (!stageText) return;
          btn.disabled = true;
          try {
            await api.copy(stageText);
            btn.textContent = 'Copied';
          } catch (err) {
            btn.textContent = 'Copy failed';
          }
          btn.disabled = false;
          setTimeout(() => { btn.textContent = 'Copy stage'; }, 1200);
        });
      });
    }
    api.onInit(paint);
    document.getElementById('close').onclick = () => api.close();
    document.getElementById('copy-all').onclick = async (e) => {
      const btn = e.currentTarget;
      await copyPrepared(
        btn,
        { mode: 'digest', deals: latestDeals, query: latestQuery },
        formatDealsWhatsAppDigest(latestDeals, latestQuery),
        'Copy all for WhatsApp',
      );
    };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  </script>
</body>
</html>`;
}
