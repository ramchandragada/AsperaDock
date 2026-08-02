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
          bestScore = 100;
          break;
        }
        const title = String(
          chat?.formattedTitle
          || chat?.name
          || chat?.contact?.name
          || chat?.contact?.pushname
          || chat?.contact?.formattedName
          || '',
        ).trim();
        const score = scoreTitle(title);
        const isGroup = !!(chat?.isGroup || chat?.groupMetadata || /@g\\.us$/.test(id));
        const adj = isGroup && score < 100 ? score - 25 : score;
        if (adj > bestScore) {
          bestScore = adj;
          best = chat;
        }
      } catch (e) {}
    }
    if (!best || bestScore < 60) return { ok: false, reason: 'store_no_match', bestScore };

    try {
      if (typeof bag.Cmd.openChatBottom === 'function') await bag.Cmd.openChatBottom(best);
      else if (typeof bag.Cmd.openChatAt === 'function') await bag.Cmd.openChatAt(best);
      else if (typeof bag.Cmd.openChatFromUnread === 'function') await bag.Cmd.openChatFromUnread(best);
      else return { ok: false, reason: 'store_no_open_cmd' };
      return {
        ok: true,
        via: 'wa-store',
        title: String(best.formattedTitle || best.name || wantName),
        score: bestScore,
      };
    } catch (e) {
      return { ok: false, reason: 'store_open_failed', error: String(e?.message || e) };
    }
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
