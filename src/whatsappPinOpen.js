/**
 * WhatsApp-specific pin open helpers.
 * Arattai works with generic list/search clicks; WA needs Store open + nuclear search wipe.
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

    const probeExports = (exp, bag) => {
      if (!exp || typeof exp !== 'object') return;
      try {
        if (!bag.Chat && exp.Chat && (exp.Chat.getModelsArray || exp.Chat.get)) bag.Chat = exp.Chat;
        if (!bag.Chat && exp.default?.Chat && (exp.default.Chat.getModelsArray || exp.default.Chat.get)) {
          bag.Chat = exp.default.Chat;
        }
        if (!bag.Cmd && exp.Cmd && (exp.Cmd.openChatBottom || exp.Cmd.openChatAt || exp.Cmd.openChatFromUnread)) {
          bag.Cmd = exp.Cmd;
        }
        if (!bag.Cmd && exp.default?.Cmd && (exp.default.Cmd.openChatBottom || exp.default.Cmd.openChatAt)) {
          bag.Cmd = exp.default.Cmd;
        }
      } catch (e) {}
    };

    const loadStore = () => {
      const bag = {
        Chat: window.Store?.Chat || null,
        Cmd: window.Store?.Cmd || null,
      };
      if (bag.Chat && bag.Cmd) return bag;
      const chunk =
        window.webpackChunkwhatsapp_web_client
        || window.webpackChunkbuild
        || window.webpackChunkwhatsapp;
      if (!chunk || typeof chunk.push !== 'function') return bag;
      try {
        const id = 'aspera_pin_' + Math.random().toString(36).slice(2);
        chunk.push([[id], {}, (req) => {
          try {
            const cache = req?.c || req?.cache;
            if (cache) {
              for (const k of Object.keys(cache)) {
                try { probeExports(cache[k]?.exports, bag); } catch (e) {}
                if (bag.Chat && bag.Cmd) break;
              }
            }
          } catch (e) {}
        }]);
      } catch (e) {}
      if (bag.Chat || bag.Cmd) {
        window.Store = Object.assign(window.Store || {}, bag);
      }
      return bag;
    };

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

    const store = loadStore();
    const Chat = store.Chat;
    const Cmd = store.Cmd;
    if (!Chat || !Cmd) return { ok: false, reason: 'store_unavailable' };

    let models = [];
    try {
      if (typeof Chat.getModelsArray === 'function') models = Chat.getModelsArray();
      else if (Chat.models) models = Chat.models;
      else if (typeof Chat.get === 'function' && wantId) {
        const one = Chat.get(wantId);
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
      if (typeof Cmd.openChatBottom === 'function') await Cmd.openChatBottom(best);
      else if (typeof Cmd.openChatAt === 'function') await Cmd.openChatAt(best);
      else if (typeof Cmd.openChatFromUnread === 'function') await Cmd.openChatFromUnread(best);
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

/** Read current left-pane search text (WA contenteditable / input). */
export function readMessagingSearchTextJs() {
  return `(() => {
    const nodes = Array.from(document.querySelectorAll(
      '[contenteditable="true"][data-tab="3"], [data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i], input[placeholder*="Search" i]',
    ));
    const mid = (window.innerWidth || 1000) * 0.55;
    for (const el of nodes) {
      try {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.left >= mid) continue;
        const ph = String(
          el.getAttribute('placeholder')
            || el.getAttribute('data-placeholder')
            || el.getAttribute('aria-label')
            || '',
        ).toLowerCase();
        if (/search messages|search this chat/.test(ph)) continue;
        let text = '';
        if ('value' in el) text = String(el.value || '');
        else text = String(el.innerText || el.textContent || '');
        return { ok: true, text: text.replace(/\\s+/g, ' ').trim() };
      } catch (e) {}
    }
    return { ok: true, text: '' };
  })()`;
}

/**
 * Wipe WA search while it has real focus (call after trusted click on the box).
 * Uses Selection API — synthetic clicks alone never clear WA's React contenteditable.
 */
export function nuclearWipeMessagingSearchJs() {
  return `(() => {
    const mid = (window.innerWidth || 1000) * 0.55;
    const nodes = Array.from(document.querySelectorAll(
      '[contenteditable="true"][data-tab="3"], [data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i], input[placeholder*="Search" i]',
    ));
    let el = null;
    for (const n of nodes) {
      try {
        const r = n.getBoundingClientRect();
        if (r.width >= 8 && r.left < mid) { el = n; break; }
      } catch (e) {}
    }
    if (!el) return { ok: false, reason: 'no_search' };
    try { el.focus(); } catch (e) {}
    try {
      if ('value' in el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('delete', false, null);
        el.textContent = '';
        while (el.firstChild) el.removeChild(el.firstChild);
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, inputType: 'deleteContentBackward', data: null,
        }));
      }
    } catch (e) {
      return { ok: false, reason: String(e?.message || e) };
    }
    const left = ('value' in el)
      ? String(el.value || '').trim()
      : String(el.innerText || el.textContent || '').trim();
    return { ok: left.length === 0, text: left };
  })()`;
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
    // Geometric clear / back relative to the search field.
    let clearHint = null;
    let backHint = null;
    let search = null;
    for (const el of document.querySelectorAll(
      '[contenteditable="true"][data-tab="3"], [data-testid="chat-list-search"], [contenteditable="true"][aria-label*="Search" i]',
    )) {
      if (!visible(el) || !inLeft(el)) continue;
      const r = el.getBoundingClientRect();
      search = {
        x: Math.round(r.left + Math.min(40, r.width * 0.2)),
        y: Math.round(r.top + r.height / 2),
        hasText: String(el.innerText || el.textContent || el.value || '').trim().length > 0,
      };
      clearHint = { x: Math.round(r.right - 16), y: Math.round(r.top + r.height / 2) };
      backHint = { x: Math.round(Math.max(8, r.left - 26)), y: Math.round(r.top + r.height / 2) };
      break;
    }
    return { ok: true, chats, allFilter, search, clearHint, backHint };
  })()`;
}
