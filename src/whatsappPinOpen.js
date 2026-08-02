/**
 * WhatsApp-specific pin open helpers.
 * Arattai works with generic list/search clicks; WA needs Store + CDP userGesture mutate.
 */

/**
 * Best-effort open via WhatsApp Web internal Store (no search UI).
 * Survives across pin opens because it never depends on leftover search text.
 */
export function tryOpenWhatsAppStoreChatJs(name, nativeId = '') {
  const wantName = String(name || '').trim();
  const wantId = String(nativeId || '').trim();
  return `(async () => {
    const wantName = ${JSON.stringify(wantName)};
    const wantId = ${JSON.stringify(wantId)};
    const norm = (s) => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const wantN = norm(wantName);
    if (!wantN && !wantId) return { ok: false, reason: 'no_target' };

    const bag = {
      Chat: window.Store?.Chat || null,
      Cmd: window.Store?.Cmd || null,
    };

    const takeCmd = (obj) => {
      if (!obj || bag.Cmd) return;
      if (typeof obj.openChatBottom === 'function'
        || typeof obj.openChatAt === 'function'
        || typeof obj.openChatFromUnread === 'function') {
        bag.Cmd = obj;
      }
    };
    const takeChat = (obj) => {
      if (!obj || bag.Chat) return;
      if (typeof obj.getModelsArray === 'function' || typeof obj.get === 'function') {
        bag.Chat = obj;
      }
    };
    const probe = (exp) => {
      if (!exp || typeof exp !== 'object') return;
      try {
        takeChat(exp.Chat);
        takeChat(exp.default?.Chat);
        takeChat(exp);
        takeCmd(exp.Cmd);
        takeCmd(exp.default?.Cmd);
        takeCmd(exp);
        takeCmd(exp.default);
      } catch (e) {}
    };

    const scanRequire = (req) => {
      if (!req) return;
      try {
        if (req.c) {
          for (const k of Object.keys(req.c)) {
            try { probe(req.c[k]?.exports); } catch (e) {}
            if (bag.Chat && bag.Cmd) return;
          }
        }
      } catch (e) {}
      try {
        const ids = Object.keys(req.m || {});
        for (const mid of ids) {
          try { probe(req(mid)); } catch (e) {}
          if (bag.Chat && bag.Cmd) return;
        }
      } catch (e) {}
    };

    if (!bag.Chat || !bag.Cmd) {
      const chunkKeys = Object.keys(self).filter((k) => /^webpackChunk/i.test(k));
      for (const key of chunkKeys) {
        const chunk = self[key];
        if (!chunk || typeof chunk.push !== 'function') continue;
        try {
          await new Promise((resolve) => {
            const id = 'aspera_pin_' + Math.random().toString(36).slice(2);
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            setTimeout(finish, 80);
            try {
              chunk.push([[id], {}, (req) => {
                try { scanRequire(req); } catch (e) {}
                finish();
              }]);
            } catch (e) {
              finish();
            }
          });
        } catch (e) {}
        if (bag.Chat && bag.Cmd) break;
      }
    }

    if (bag.Chat || bag.Cmd) {
      window.Store = Object.assign(window.Store || {}, bag);
    }
    if (!bag.Chat || !bag.Cmd) {
      return {
        ok: false,
        reason: 'store_unavailable',
        hasChat: !!bag.Chat,
        hasCmd: !!bag.Cmd,
      };
    }

    const scoreTitle = (title) => {
      const key = norm(title);
      if (!key) return -1;
      if (key === wantN) return 100;
      if (wantN && key.includes(wantN)) return 88;
      if (wantN && wantN.includes(key) && key.length >= 6) return 60;
      const tokens = wantN.split(' ').filter((t) => t.length >= 3);
      if (tokens.length >= 2) {
        let hit = 0;
        for (const t of tokens) if (key.includes(t)) hit += 1;
        if (hit === tokens.length) return 80;
        if (hit >= 2) return 64;
      } else if (tokens.length === 1) {
        const tok = tokens[0];
        if (key === tok) return 100;
        if (key.includes(tok) && key.length <= tok.length + 12) return 70;
      }
      return -1;
    };
    const chatTitles = (chat) => {
      const out = [];
      const push = (v) => {
        const s = String(v || '').trim();
        if (s && !out.includes(s)) out.push(s);
      };
      push(chat?.formattedTitle);
      push(chat?.name);
      push(chat?.contact?.name);
      push(chat?.contact?.pushname);
      push(chat?.contact?.formattedName);
      push(chat?.contact?.verifiedName);
      push(chat?.contact?.notifyName);
      push(chat?.contact?.businessProfile?.description);
      try {
        const fn = chat?.contact?.getFormattedName || chat?.getTitle;
        if (typeof fn === 'function') push(fn.call(chat.contact || chat));
      } catch (e) {}
      return out;
    };

    let models = [];
    try {
      if (typeof bag.Chat.getModelsArray === 'function') models = bag.Chat.getModelsArray();
      else if (Array.isArray(bag.Chat.models)) models = bag.Chat.models;
      else if (typeof bag.Chat.get === 'function' && wantId) {
        const one = bag.Chat.get(wantId);
        if (one) models = [one];
      }
    } catch (e) {
      return { ok: false, reason: 'store_read_failed' };
    }
    if (wantId && typeof bag.Chat?.get === 'function') {
      try {
        const one = bag.Chat.get(wantId);
        if (one && !models.includes(one)) models = [one, ...models];
      } catch (e) {}
    }
    // Contact directory: AYUSH-style business names may be in Contact but cold in Chat list.
    try {
      const Contact = window.Store?.Contact || bag.Contact;
      const contacts = typeof Contact?.getModelsArray === 'function'
        ? Contact.getModelsArray()
        : (Array.isArray(Contact?.models) ? Contact.models : []);
      for (const c of contacts || []) {
        const titles = [
          c?.name, c?.pushname, c?.formattedName, c?.verifiedName, c?.notifyName,
        ].map((x) => String(x || '').trim()).filter(Boolean);
        let score = -1;
        for (const t of titles) score = Math.max(score, scoreTitle(t));
        const cid = String(c?.id?._serialized || c?.id || '');
        if (wantId && cid && (cid === wantId || cid.includes(wantId))) score = 120;
        if (score < 80 || !cid) continue;
        let chat = null;
        try { chat = typeof bag.Chat.get === 'function' ? bag.Chat.get(cid) : null; } catch (e) {}
        if (!chat && typeof bag.Chat.find === 'function') {
          try { chat = await bag.Chat.find(c.id || cid); } catch (e) {}
        }
        if (chat && !models.includes(chat)) models.push(chat);
      }
    } catch (e) {}

    if (!Array.isArray(models) || !models.length) {
      return { ok: false, reason: 'store_empty' };
    }

    let best = null;
    let bestScore = -1;
    for (const chat of models) {
      try {
        const id = String(chat?.id?._serialized || chat?.id || chat?.chatId || '');
        if (wantId && id && (id === wantId || id.includes(wantId))) {
          best = chat;
          bestScore = 120;
          break;
        }
        const isGroup = !!(chat?.isGroup || chat?.groupMetadata || /@g\\.us$/.test(id));
        let score = -1;
        for (const title of chatTitles(chat)) {
          score = Math.max(score, scoreTitle(title));
        }
        // Prefer DMs strongly — group last-message @mentions must not win.
        let adj = score;
        if (isGroup) {
          if (score < 100) adj = score - 40;
          else adj = score - 5;
        }
        if (adj > bestScore) {
          bestScore = adj;
          best = chat;
        }
      } catch (e) {}
    }
    if (!best || bestScore < 60) return { ok: false, reason: 'store_no_match', bestScore };

    const openChat = async (chat) => {
      const attempts = [];
      if (typeof bag.Cmd.openChatBottom === 'function') {
        attempts.push(() => bag.Cmd.openChatBottom(chat));
        attempts.push(() => bag.Cmd.openChatBottom({ chat }));
      }
      if (typeof bag.Cmd.openChatAt === 'function') {
        attempts.push(() => bag.Cmd.openChatAt(chat));
        attempts.push(() => bag.Cmd.openChatAt({ chat }));
      }
      if (typeof bag.Cmd.openChatFromUnread === 'function') {
        attempts.push(() => bag.Cmd.openChatFromUnread(chat));
      }
      if (typeof bag.Cmd.openChat === 'function') {
        attempts.push(() => bag.Cmd.openChat(chat));
      }
      if (!attempts.length) return { ok: false, reason: 'store_no_open_cmd' };
      let lastErr = '';
      for (const fn of attempts) {
        try {
          const ret = fn();
          if (ret && typeof ret.then === 'function') await ret;
          return { ok: true };
        } catch (e) {
          lastErr = String(e?.message || e);
        }
      }
      return { ok: false, reason: 'store_open_failed', error: lastErr };
    };

    try {
      const opened = await openChat(best);
      if (!opened?.ok) return opened;
      return {
        ok: true,
        via: 'wa-store',
        title: String(best.formattedTitle || best.name || wantName),
        id: String(best?.id?._serialized || best?.id || ''),
        score: bestScore,
      };
    } catch (e) {
      return { ok: false, reason: 'store_open_failed', error: String(e?.message || e) };
    }
  })()`;
}

/**
 * Exact left-pane name hit for WhatsApp (Recent searches chip / Contacts row).
 * Only exact (or nativeId) non-group matches — avoids AYUSH @mention collisions.
 */
export function findExactWhatsAppContactTargetJs(name, nativeId = '') {
  const wantName = String(name || '').trim();
  const wantId = String(nativeId || '').trim();
  return `(() => {
    const wantName = ${JSON.stringify(wantName)};
    const wantId = ${JSON.stringify(wantId)};
    const norm = (s) => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const wantN = norm(wantName);
    const mid = (window.innerWidth || 1000) * 0.55;
    const visible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 8 && r.height > 8 && r.left < mid;
      } catch (e) { return false; }
    };
    const looksGroup = (el, title) => {
      const t = norm(title);
      if (/\\b(group|community|broadcast)\\b/.test(t)) return true;
      if (el?.querySelector?.('[data-testid="default-group"], [data-icon="default-group"], [data-icon="group"]')) return true;
      return false;
    };
    const inMessages = (el) => {
      let cur = el;
      for (let i = 0; i < 12 && cur; i += 1) {
        let sib = cur.previousElementSibling;
        while (sib) {
          const t = String(sib.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
          if (t === 'messages') return true;
          if (t === 'chats' || t === 'contacts' || t === 'groups' || t === 'recent searches') return false;
          sib = sib.previousElementSibling;
        }
        cur = cur.parentElement;
      }
      return false;
    };
    const pointOf = (el) => {
      try {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return null;
        return { x: Math.round(r.left + Math.min(40, Math.max(12, r.width * 0.3))), y: Math.round(r.top + r.height / 2) };
      } catch (e) { return null; }
    };
    const cands = [];
    // 1) Native id row.
    if (wantId) {
      for (const el of document.querySelectorAll('[data-id], [chid], [data-chid]')) {
        if (!visible(el)) continue;
        const id = String(
          el.getAttribute('data-id') || el.getAttribute('chid') || el.getAttribute('data-chid') || '',
        ).replace(/^(true|false)_/, '');
        if (id === wantId || id.includes(wantId)) {
          const pt = pointOf(el);
          if (pt) return { ok: true, ...pt, title: wantName, via: 'native-id', score: 120 };
        }
      }
    }
    // 2) Exact text nodes in left pane (Recent searches labels, contact titles).
    for (const el of document.querySelectorAll(
      '#pane-side span, #pane-side div, #pane-side button, #pane-side [role="listitem"], #pane-side [role="button"], [data-testid="cell-frame-title"], [data-testid="cell-frame-title"] span',
    )) {
      if (!visible(el)) continue;
      const raw = String(el.getAttribute?.('title') || el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!raw || raw.length > 80) continue;
      if (norm(raw) !== wantN) continue;
      if (inMessages(el)) continue;
      const clickEl =
        el.closest?.('[data-testid="cell-frame-container"]')
        || el.closest?.('[role="listitem"]')
        || el.closest?.('[role="button"]')
        || el.closest?.('div[tabindex]')
        || el;
      if (looksGroup(clickEl, raw)) continue;
      const pt = pointOf(clickEl);
      if (!pt) continue;
      // Prefer smaller / more specific nodes (chip label over huge containers).
      const area = (() => { try { const r = clickEl.getBoundingClientRect(); return r.width * r.height; } catch (e) { return 999999; } })();
      cands.push({ ...pt, title: raw, area, score: 100, via: 'exact-text' });
    }
    cands.sort((a, b) => a.area - b.area);
    if (cands[0]) return { ok: true, x: cands[0].x, y: cands[0].y, title: cands[0].title, via: cands[0].via, score: 100 };
    return { ok: false, reason: 'exact_not_found' };
  })()`;
}

/** Active WhatsApp chat id + title (for pinning with nativeId). */
export function readActiveWhatsAppChatJs() {
  return `(() => {
    try {
      const chat =
        window.Store?.Chat?.getActive?.()
        || window.Store?.Chat?.active
        || null;
      const id = String(chat?.id?._serialized || chat?.id || '').trim();
      const title = String(
        chat?.formattedTitle || chat?.name || chat?.contact?.formattedName || '',
      ).trim();
      if (id || title) return { ok: true, nativeId: id, title };
    } catch (e) {}
    try {
      const header = document.querySelector(
        '[data-testid="conversation-info-header-chat-title"], #main header span[title]',
      );
      const title = String(header?.getAttribute?.('title') || header?.textContent || '').trim();
      const main = document.querySelector('#main');
      const dataId = String(main?.getAttribute?.('data-id') || '').replace(/^(true|false)_/, '');
      if (title || dataId) return { ok: true, nativeId: dataId, title };
    } catch (e) {}
    return { ok: false };
  })()`;
}

/** Find the real WA left-pane search contenteditable (prefer data-tab=3). */
export function waSearchNodeJs() {
  return `(() => {
    const mid = (window.innerWidth || 1000) * 0.55;
    const cands = [];
    for (const el of document.querySelectorAll(
      '[contenteditable="true"][data-tab="3"], [contenteditable="true"][data-tab="3"] *, [data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i], [contenteditable="true"][title*="Search" i]',
    )) {
      try {
        const node = el.getAttribute?.('contenteditable') === 'true' ? el : el.closest?.('[contenteditable="true"]');
        if (!node) continue;
        const r = node.getBoundingClientRect();
        if (r.width < 40 || r.height < 12 || r.left >= mid) continue;
        const ph = String(
          node.getAttribute('placeholder')
            || node.getAttribute('data-placeholder')
            || node.getAttribute('aria-label')
            || node.getAttribute('title')
            || '',
        ).toLowerCase();
        if (/search messages|search this chat/.test(ph)) continue;
        const text = String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
        const score =
          (node.getAttribute('data-tab') === '3' ? 50 : 0)
          + ( /search/.test(ph) ? 20 : 0)
          + (text ? 10 : 0)
          + Math.min(20, r.width / 20);
        cands.push({ node, text, score, r });
      } catch (e) {}
    }
    cands.sort((a, b) => b.score - a.score);
    // Prefer a node that already has text when clearing leftovers.
    const withText = cands.find((c) => c.text);
    const best = withText || cands[0] || null;
    if (!best) return null;
    return {
      text: best.text,
      x: Math.round(best.r.left + Math.min(48, best.r.width * 0.2)),
      y: Math.round(best.r.top + best.r.height / 2),
      clearX: Math.round(best.r.right - 16),
      clearY: Math.round(best.r.top + best.r.height / 2),
      backX: Math.round(Math.max(8, best.r.left - 26)),
      backY: Math.round(best.r.top + best.r.height / 2),
      dataTab: best.node.getAttribute('data-tab') || '',
    };
  })()`;
}

/**
 * Clear and optionally set WA search text.
 * Intended for CDP Runtime.evaluate({ userGesture: true }) — plain
 * executeJavaScript is ignored by WhatsApp's React contenteditable.
 */
export function waMutateSearchJs(text = '') {
  const value = String(text || '');
  return `(() => {
    const want = ${JSON.stringify(value)};
    const mid = (window.innerWidth || 1000) * 0.55;
    let el = document.querySelector('[contenteditable="true"][data-tab="3"]');
    if (!el) {
      for (const n of document.querySelectorAll(
        '[data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i]',
      )) {
        try {
          const r = n.getBoundingClientRect();
          if (r.width >= 40 && r.left < mid) { el = n; break; }
        } catch (e) {}
      }
    }
    if (!el) return { ok: false, reason: 'no_search', text: '' };

    // Click any visible clear/cancel near the left pane first.
    for (const btn of document.querySelectorAll(
      '[data-testid="search-input-clear"], [aria-label="Clear search"], [aria-label*="Clear search" i], button[aria-label="Cancel"], button[aria-label*="Cancel" i], [data-icon="x"], [data-icon="x-alt"], span[data-icon="x"], span[data-icon="x-alt"]',
    )) {
      try {
        const r = btn.getBoundingClientRect();
        if (r.width < 6 || r.left >= mid) continue;
        (btn.closest('button,[role="button"]') || btn).click();
      } catch (e) {}
    }

    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }

    const read = () => String(el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();

    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete', false, null);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (e) {}

    try {
      el.textContent = '';
      while (el.firstChild) el.removeChild(el.firstChild);
      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'deleteContentBackward', data: null,
      }));
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'deleteContentBackward', data: null,
      }));
    } catch (e) {}

    if (want) {
      try {
        document.execCommand('insertText', false, want);
      } catch (e) {}
      try {
        el.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: want,
        }));
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, inputType: 'insertText', data: want,
        }));
      } catch (e) {}
      // Last resort: paste event with DataTransfer (some WA builds listen only to this).
      if (read() !== want) {
        try {
          const dt = new DataTransfer();
          dt.setData('text/plain', want);
          el.dispatchEvent(new ClipboardEvent('paste', {
            clipboardData: dt, bubbles: true, cancelable: true,
          }));
        } catch (e) {}
      }
    }

    const text = read();
    const wantN = want.toLowerCase().replace(/\\s+/g, ' ').trim();
    const gotN = text.toLowerCase().replace(/\\s+/g, ' ').trim();
    const matched = !want
      ? gotN.length === 0
      : (gotN === wantN || gotN.includes(wantN) || (wantN.includes(gotN) && gotN.length >= 4));
    return { ok: matched, text, want, focused: document.activeElement === el };
  })()`;
}

/** Read current left-pane search text (WA contenteditable / input). */
export function readMessagingSearchTextJs() {
  return `(() => {
    const mid = (window.innerWidth || 1000) * 0.55;
    let bestText = '';
    let bestScore = -1;
    for (const el of document.querySelectorAll(
      '[contenteditable="true"][data-tab="3"], [data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i]',
    )) {
      try {
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.left >= mid) continue;
        const text = String(el.innerText || el.textContent || el.value || '').replace(/\\s+/g, ' ').trim();
        // Prefer nodes that still hold leftover pin text — empty placeholders score lower.
        const score = (el.getAttribute('data-tab') === '3' ? 50 : 0) + (text ? 40 : 0) + r.width / 20;
        if (score > bestScore) { bestScore = score; bestText = text; }
      } catch (e) {}
    }
    return { ok: true, text: bestText };
  })()`;
}

/**
 * Clear and set via the same reader used for verification.
 * Kept for non-CDP fallbacks.
 */
export function nuclearWipeMessagingSearchJs() {
  return waMutateSearchJs('');
}

/** Reset WA left pane: Chats nav + All filter coords (exits sticky search UI). */
export function findWhatsAppPaneResetJs() {
  return `(() => {
    const mid = (window.innerWidth || 1000) * 0.55;
    const visible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 6 && r.height > 6;
      } catch (e) { return false; }
    };
    const point = (el) => {
      if (!visible(el)) return null;
      try {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      } catch (e) { return null; }
    };
    const inLeft = (el) => {
      try { return el.getBoundingClientRect().left < mid; } catch (e) { return false; }
    };
    let chats = null;
    for (const sel of [
      '[aria-label="Chats"]',
      '[data-testid="chat"]',
      '[data-icon="chat"]',
      'button[aria-label*="Chats" i]',
      'div[aria-label*="Chats" i]',
    ]) {
      const el = document.querySelector(sel);
      if (el && visible(el)) {
        chats = point(el.closest?.('button,[role="button"]') || el);
        if (chats) break;
      }
    }
    let allFilter = null;
    for (const el of document.querySelectorAll(
      'button, div[role="button"], span[role="button"]',
    )) {
      if (!visible(el) || !inLeft(el)) continue;
      const t = String(el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (/^all$/i.test(t)) {
        allFilter = point(el);
        break;
      }
    }
    let clearHint = null;
    let backHint = null;
    let search = null;
    for (const el of document.querySelectorAll(
      '[contenteditable="true"][data-tab="3"], [data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i]',
    )) {
      if (!visible(el) || !inLeft(el)) continue;
      const r = el.getBoundingClientRect();
      const text = String(el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
      search = {
        x: Math.round(r.left + Math.min(40, r.width * 0.2)),
        y: Math.round(r.top + r.height / 2),
        hasText: text.length > 0,
        text,
      };
      clearHint = { x: Math.round(r.right - 16), y: Math.round(r.top + r.height / 2) };
      backHint = { x: Math.round(Math.max(8, r.left - 26)), y: Math.round(r.top + r.height / 2) };
      break;
    }
    return { ok: true, chats, allFilter, search, clearHint, backHint };
  })()`;
}
