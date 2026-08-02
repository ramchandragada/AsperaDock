/**
 * Cross-account messaging inbox helpers (WhatsApp / Arattai).
 * Scrapes chat lists in guest pages and opens / replies without user injectJs.
 */

export const INBOX_APP_IDS = Object.freeze(['whatsapp', 'arattai']);

export function isInboxAppId(appId) {
  return INBOX_APP_IDS.includes(String(appId || ''));
}

export function normalizeChatKey(name = '', fallback = '') {
  const raw = String(name || fallback || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return raw || String(fallback || '').trim().slice(0, 80);
}

export function makePinId(serviceId, chatKey) {
  return `${String(serviceId || '')}::${String(chatKey || '')}`;
}

export function sanitizePinnedPeople(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const serviceId = String(raw?.serviceId || '').trim();
    const name = String(raw?.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const chatKey = normalizeChatKey(raw?.chatKey || name);
    const appId = String(raw?.appId || '').trim();
    if (!serviceId || !name || !chatKey) continue;
    if (isJunkChatName(name)) continue;
    const id = String(raw?.id || makePinId(serviceId, chatKey));
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, serviceId, chatKey, name, appId });
    if (out.length >= 10) break;
  }
  return out;
}

/** Reject unread badges / chrome mistaken for a contact name. */
export function isJunkChatName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (!n || n.length < 2) return true;
  if (/^\d+\+?$/.test(n)) return true;
  if (/^\d+\s*unread\b/i.test(n)) return true;
  if (/^unread(\s+messages?)?$/i.test(n)) return true;
  if (/^pinned$/i.test(n)) return true;
  if (/^(photo|video|voice|sticker|gif|document|you)$/i.test(n)) return true;
  return false;
}

/** Shared DOM helpers injected into guest pages for scrape / pin targeting. */
function guestChatListHelpersJs() {
  return `
    const visible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 8 && r.height > 8;
      } catch (e) { return false; }
    };
    const textOf = (el) => String(el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim();
    const isJunkName = (name) => {
      const n = String(name || '').replace(/\\s+/g, ' ').trim();
      if (!n || n.length < 2) return true;
      if (/^\\d+\\+?$/.test(n)) return true;
      if (/^\\d+\\s*unread\\b/i.test(n)) return true;
      if (/^unread(\\s+messages?)?$/i.test(n)) return true;
      if (/^pinned$/i.test(n)) return true;
      if (/^(photo|video|voice|sticker|gif|document|you)$/i.test(n)) return true;
      return false;
    };
    const listSel = [
      '[data-testid="cell-frame-container"]',
      '[data-testid="list-item"]',
      '[data-testid="chat"]',
      '[role="listitem"]',
      '[class*="ChatListItem"]',
      '[class*="chat-list-item"]',
      '[class*="chatlist" i] [tabindex]',
      '[class*="ChatList"] [tabindex]',
    ].join(',');
    const rowName = (cell) => {
      if (!cell) return '';
      const title =
        cell.querySelector('[data-testid="cell-frame-title"] span[title]')
        || cell.querySelector('[data-testid="cell-frame-title"]')
        || cell.querySelector('[data-testid="conversation-info-header-chat-title"]');
      if (title) {
        const t = String(title.getAttribute('title') || title.textContent || '')
          .replace(/\\s+/g, ' ').trim();
        if (!isJunkName(t)) return t.slice(0, 80);
      }
      // WhatsApp row aria-label often starts with the contact name.
      const aria = String(cell.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
      if (aria) {
        const cleaned = aria
          .replace(/\\d+\\s*unread messages?/ig, '')
          .replace(/\\bunread messages?\\b/ig, '')
          .trim();
        const head = cleaned.split(/[,:]/)[0].trim();
        if (!isJunkName(head)) return head.slice(0, 80);
      }
      // Avoid first [title] / span[dir=auto] — those often hit badges or previews.
      const spans = Array.from(cell.querySelectorAll('span[dir="auto"], span[title], strong, h3, h4'));
      for (const el of spans) {
        if (el.closest('[data-testid="icon-unread-count"], [aria-label*="unread" i]')) continue;
        const t = String(el.getAttribute('title') || el.textContent || '')
          .replace(/\\s+/g, ' ').trim();
        if (!isJunkName(t) && t.length <= 80) return t;
      }
      return '';
    };
    const rowUnread = (cell) => {
      const unreadEl =
        cell.querySelector('[data-testid="icon-unread-count"]')
        || cell.querySelector('[aria-label*="unread message" i]')
        || cell.querySelector('span[aria-label*="unread" i]');
      let unread = 0;
      const aria = String(unreadEl?.getAttribute?.('aria-label') || '');
      const m = aria.match(/(\\d+)\\s*unread/i) || textOf(unreadEl).match(/^(\\d+)\\+?$/);
      if (m) unread = Math.min(999, parseInt(m[1], 10) || 0);
      else if (unreadEl && visible(unreadEl) && /\\d/.test(textOf(unreadEl))) {
        unread = Math.min(999, parseInt(textOf(unreadEl), 10) || 1);
      } else if (unreadEl && visible(unreadEl)) {
        unread = 1;
      }
      if (!unread) {
        const rowAria = String(cell.getAttribute('aria-label') || '');
        const rm = rowAria.match(/(\\d+)\\s*unread/i);
        if (rm) unread = Math.min(999, parseInt(rm[1], 10) || 1);
      }
      return unread;
    };
  `;
}

/** Scrape visible chat-list rows that look unread / need attention. */
export function scrapeMessagingInboxJs() {
  return `(() => {
    ${guestChatListHelpersJs()}
    const rows = [];
    const seen = new Set();
    const cells = Array.from(document.querySelectorAll(listSel));

    for (const cell of cells) {
      if (!visible(cell)) continue;
      const name = rowName(cell);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;

      const unread = rowUnread(cell);
      if (!unread) continue;

      const previewEl =
        cell.querySelector('[data-testid="last-msg-body"]')
        || cell.querySelector('[data-testid="cell-frame-secondary"]')
        || null;
      let preview = String(previewEl?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 100);
      if (isJunkName(preview) || /^\\d+$/.test(preview)) preview = '';
      seen.add(key);
      rows.push({ chatKey: key, name, preview, unread });
      if (rows.length >= 24) break;
    }
    return { chats: rows, at: Date.now() };
  })()`;
}

/** Resolve a chat list row under the cursor (for Pin with Aspera Hub). */
export function inspectChatListTargetJs(x, y) {
  const px = Math.round(Number(x) || 0);
  const py = Math.round(Number(y) || 0);
  return `(() => {
    ${guestChatListHelpersJs()}
    const x = ${px};
    const y = ${py};
    let el = document.elementFromPoint(x, y);
    if (!el) return { ok: false };
    const cell = el.closest?.(listSel);
    if (!cell || !visible(cell)) return { ok: false, reason: 'not_chat_row' };
    const name = rowName(cell);
    if (!name) return { ok: false, reason: 'no_name' };
    return {
      ok: true,
      name,
      chatKey: name.toLowerCase(),
      unread: rowUnread(cell),
    };
  })()`;
}

/** Best-effort: open a chat by display name (list click or in-app search). */
export function openMessagingChatJs(name, chatKey = '') {
  const targetName = String(name || '').trim();
  const targetKey = normalizeChatKey(chatKey || targetName);
  return `(async () => {
    const wantName = ${JSON.stringify(targetName)};
    const wantKey = ${JSON.stringify(targetKey)};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4;
      } catch (e) { return false; }
    };
    const norm = (s) => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const rowTitle = (cell) => {
      const titleEl =
        cell.querySelector('[data-testid="cell-frame-title"]')
        || cell.querySelector('[title]')
        || cell.querySelector('span[dir="auto"]')
        || cell.querySelector('[class*="title" i]')
        || cell.querySelector('strong, h3, h4');
      return String(titleEl?.getAttribute?.('title') || titleEl?.textContent || '').replace(/\\s+/g, ' ').trim();
    };
    const click = (el) => {
      if (!el || !visible(el)) return false;
      try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      try { el.click(); return true; } catch (e) { return false; }
    };
    const listSel = [
      '[data-testid="cell-frame-container"]',
      '[data-testid="list-item"]',
      '[data-testid="chat"]',
      '[role="listitem"]',
      '[class*="ChatListItem"]',
      '[class*="chat-list-item"]',
      '[class*="ChatList"] [tabindex]',
      '[class*="chat-list"] [tabindex]',
    ].join(',');

    const findRow = () => {
      const cells = Array.from(document.querySelectorAll(listSel));
      let best = null;
      let bestScore = -1;
      for (const cell of cells) {
        if (!visible(cell)) continue;
        const title = rowTitle(cell);
        const key = norm(title);
        if (!key) continue;
        let score = 0;
        if (key === wantKey || key === norm(wantName)) score = 100;
        else if (wantKey && key.includes(wantKey)) score = 70;
        else if (wantName && key.includes(norm(wantName))) score = 60;
        else if (wantName && norm(wantName).includes(key) && key.length >= 4) score = 40;
        if (score > bestScore) { bestScore = score; best = cell; }
      }
      return bestScore >= 40 ? best : null;
    };

    let row = findRow();
    if (row && click(row)) return { ok: true, via: 'list-click' };

    // WhatsApp / Arattai search box in the chat list column.
    const search =
      document.querySelector('[data-testid="chat-list-search"]')
      || document.querySelector('div[contenteditable="true"][data-tab="3"]')
      || document.querySelector('[contenteditable="true"][data-tab="3"]')
      || document.querySelector('input[placeholder*="Search" i]')
      || document.querySelector('[contenteditable="true"][aria-label*="Search" i]')
      || document.querySelector('[placeholder*="Search" i]')
      || document.querySelector('[data-placeholder*="Search" i]');
    if (search) {
      try { search.focus(); } catch (e) {}
      try { search.click(); } catch (e) {}
      await wait(120);
      try {
        if ('value' in search) {
          search.value = wantName;
          search.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, wantName);
        }
      } catch (e) {
        try {
          search.textContent = wantName;
          search.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e2) {}
      }
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        await wait(120);
        row = findRow();
        if (row && click(row)) return { ok: true, via: 'search-click' };
      }
    }
    return { ok: false, reason: 'chat_not_found' };
  })()`;
}

/** Insert text into the open compose box and optionally press Enter to send. */
export function composeReplyJs(text, { send = false } = {}) {
  const payload = String(text || '');
  return `(async () => {
    const text = ${JSON.stringify(payload)};
    const shouldSend = ${JSON.stringify(!!send)};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const selectors = [
      '[data-testid="conversation-compose-box-input"]',
      'footer [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][data-tab]',
      'textarea',
      '[placeholder*="Type your message" i]',
      '[data-placeholder*="Type your message" i]',
      '[placeholder*="message here" i]',
      '[contenteditable="true"]',
    ];
    let node = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const ph = String(el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '').toLowerCase();
      if (/search/.test(ph)) continue;
      node = el;
      break;
    }
    if (!node) return { ok: false, reason: 'no_compose' };
    try { node.focus(); } catch (e) {}
    try { node.click(); } catch (e) {}
    await wait(60);
    try {
      if ('value' in node && node.tagName === 'TEXTAREA') {
        node.value = text;
        node.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
      }
    } catch (e) {
      try { node.textContent = text; } catch (e2) {}
    }
    if (!shouldSend) return { ok: true, via: 'placed' };
    await wait(80);
    try {
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      node.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    } catch (e) {}
    const sendBtn =
      document.querySelector('[data-testid="compose-btn-send"]')
      || document.querySelector('button[aria-label*="Send" i]')
      || document.querySelector('span[data-icon="send"]')?.closest('button,[role="button"]');
    if (sendBtn) {
      try { sendBtn.click(); return { ok: true, via: 'send-click' }; } catch (e) {}
    }
    return { ok: true, via: 'enter' };
  })()`;
}

/** Lightweight name search across the visible chat list (for Hub quick search). */
export function searchMessagingChatsJs(query) {
  const q = String(query || '').trim().toLowerCase();
  return `(() => {
    const q = ${JSON.stringify(q)};
    if (!q) return { chats: [] };
    const visible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 8 && r.height > 8;
      } catch (e) { return false; }
    };
    const out = [];
    const seen = new Set();
    const cells = Array.from(document.querySelectorAll([
      '[data-testid="cell-frame-container"]',
      '[data-testid="list-item"]',
      '[role="listitem"]',
      '[class*="ChatListItem"]',
      '[class*="chat-list-item"]',
      '[class*="ChatList"] [tabindex]',
    ].join(',')));
    for (const cell of cells) {
      if (!visible(cell)) continue;
      const titleEl =
        cell.querySelector('[data-testid="cell-frame-title"]')
        || cell.querySelector('[title]')
        || cell.querySelector('span[dir="auto"]')
        || cell.querySelector('[class*="title" i]');
      const name = String(titleEl?.getAttribute?.('title') || titleEl?.textContent || '')
        .replace(/\\s+/g, ' ').trim().slice(0, 80);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      if (!key.includes(q)) continue;
      seen.add(key);
      out.push({ chatKey: key, name });
      if (out.length >= 12) break;
    }
    return { chats: out };
  })()`;
}
