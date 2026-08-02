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
  if (/^(photo|video|voice|sticker|gif|document|you|chats|channels|direct|groups|archived|search|mute|unmute)$/i.test(n)) {
    return true;
  }
  if (/^(type your message|message here|search chats)/i.test(n)) return true;
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
      if (/^(photo|video|voice|sticker|gif|document|you|chats|archived|search|mute|unmute)$/i.test(n)) return true;
      if (/^(type your message|message here|search chats)/i.test(n)) return true;
      if (/your personal storage/i.test(n) && n.length > 40) return false; // Pocket subtitle ok with name
      return false;
    };
    // WhatsApp + Arattai list rows.
    // Arattai (Vue): .art-chat-item with bare attribute chid=… (not data-chid).
    const listSel = [
      '.art-chat-item',
      '[id^="art-chat-item-"]',
      '#lhs_chatlist .art-chat-item',
      '[data-id="lhs_activechats"] .art-chat-item',
      '[chid].art-chat-item',
      '[chid][data-context]',
      '[data-testid="cell-frame-container"]',
      '[data-testid="list-item"]',
      '[data-testid="chat"]',
      '[role="listitem"]',
      '[class*="ChatListItem"]',
      '[class*="chat-list-item"]',
      '[class*="chatlist" i] [tabindex]',
      '[class*="ChatList"] [tabindex]',
      '[class*="chats-list" i] > *',
      '[class*="ChatsList" i] > *',
      '[class*="chat-row" i]',
      '[class*="ChatRow" i]',
      '[class*="roster" i] [tabindex]',
      '[class*="Roster" i] [tabindex]',
      '[data-chid]',
      '[data-chatid]',
      '[data-chat-id]',
      'li[id*="chat" i]',
    ].join(',');
    const titleCandidateSel = [
      '.chat-title-text',
      '.chat-title-wrapper .chat-title-text',
      '.art-chat-title',
      '[data-testid="cell-frame-title"] span[title]',
      '[data-testid="cell-frame-title"]',
      '[data-testid="conversation-info-header-chat-title"]',
      '[class*="chat-title" i]',
      '[class*="ChatTitle" i]',
      '[class*="title-text" i]',
      '[class*="TitleText" i]',
      '[class*="dname" i]',
      '[class*="channel-name" i]',
      '[class*="ChannelName" i]',
      '[class*="contact-name" i]',
      '[class*="ContactName" i]',
      '[class*="username" i]',
      'h1','h2','h3','h4','strong',
      'span[title]',
      'div[title]',
      'p[title]',
    ].join(',');
    const tryText = (raw) => {
      const t = String(raw || '').replace(/\\s+/g, ' ').trim();
      if (isJunkName(t) || t.length > 80) return '';
      // Prefer first line when preview is appended with newlines.
      const first = t.split(/[\\n|]/)[0].trim();
      return isJunkName(first) ? '' : first.slice(0, 80);
    };
    const rowName = (cell) => {
      if (!cell) return '';
      // Prefer Arattai chat-title-text (title attr holds full untruncated name).
      const artTitle =
        cell.querySelector?.('.chat-title-text')
        || cell.querySelector?.('.chat-title-wrapper [title]');
      if (artTitle) {
        const t = tryText(artTitle.getAttribute('title') || artTitle.textContent);
        if (t) return t;
      }
      for (const el of cell.querySelectorAll(titleCandidateSel)) {
        if (el.closest('[data-testid="icon-unread-count"], [aria-label*="unread" i], [class*="badge" i], [class*="time" i], .lhs-list-counter, .lhs-list-msginfo')) {
          continue;
        }
        const t = tryText(el.getAttribute('title') || el.textContent);
        if (t) return t;
      }
      // WhatsApp / Arattai aria-label often starts with the contact name.
      const aria = String(cell.getAttribute('aria-label') || cell.getAttribute('title') || '')
        .replace(/\\s+/g, ' ').trim();
      if (aria) {
        const cleaned = aria
          .replace(/\\d+\\s*unread messages?/ig, '')
          .replace(/\\bunread messages?\\b/ig, '')
          .replace(/\\bmuted\\b/ig, '')
          .trim();
        const head = tryText(cleaned.split(/[,:]/)[0]);
        if (head) return head;
      }
      // Fallback: first non-junk text line in the row (Arattai often lacks WA testids).
      const lines = String(cell.innerText || '')
        .split(/\\n+/)
        .map((l) => l.replace(/\\s+/g, ' ').trim())
        .filter(Boolean);
      for (const line of lines) {
        const t = tryText(line);
        if (t && !/^\\d{1,2}:\\d{2}/.test(t) && !/^(am|pm)$/i.test(t) && !/ago$/i.test(t)) return t;
      }
      return '';
    };
    const rowUnread = (cell) => {
      const unreadEl =
        cell.querySelector('[data-testid="icon-unread-count"]')
        || cell.querySelector('[aria-label*="unread message" i]')
        || cell.querySelector('span[aria-label*="unread" i]')
        || cell.querySelector('.lhs-list-counter')
        || cell.querySelector('[class*="unread" i]')
        || cell.querySelector('[class*="badge" i]');
      let unread = 0;
      const aria = String(unreadEl?.getAttribute?.('aria-label') || '');
      const m = aria.match(/(\\d+)\\s*unread/i) || textOf(unreadEl).match(/^(\\d+)\\+?$/);
      if (m) unread = Math.min(999, parseInt(m[1], 10) || 0);
      else if (unreadEl && visible(unreadEl) && /\\d/.test(textOf(unreadEl))) {
        unread = Math.min(999, parseInt(textOf(unreadEl), 10) || 1);
      } else if (unreadEl && visible(unreadEl) && /badge|unread|counter/i.test(unreadEl.className || '')) {
        unread = 1;
      }
      if (!unread) {
        const rowAria = String(cell.getAttribute('aria-label') || '');
        const rm = rowAria.match(/(\\d+)\\s*unread/i);
        if (rm) unread = Math.min(999, parseInt(rm[1], 10) || 1);
      }
      return unread;
    };
    const rowContainsPoint = (el, x, y) => {
      if (!el?.getBoundingClientRect) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        && r.width >= 100 && r.height >= 28 && r.height <= 160;
    };
    const findChatRowFromPoint = (x, y) => {
      // Prefer stacked hits — Arattai's own context menu can sit above the row.
      const stack = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(x, y)
        : [document.elementFromPoint(x, y)].filter(Boolean);
      for (const el of stack) {
        if (!el?.closest) continue;
        const direct = el.closest(listSel);
        if (direct && visible(direct) && rowName(direct)) return direct;
      }
      // Geometry scan: find .art-chat-item / list row whose box contains the point.
      const candidates = Array.from(document.querySelectorAll(
        '.art-chat-item, [id^="art-chat-item-"], [data-testid="cell-frame-container"], [role="listitem"]',
      ));
      for (const cell of candidates) {
        if (!visible(cell) || !rowContainsPoint(cell, x, y)) continue;
        if (rowName(cell)) return cell;
      }
      // Walk up from topmost hit for rows without WA testids.
      let cur = stack[0] || null;
      for (let i = 0; i < 14 && cur && cur !== document.body; i += 1) {
        if (visible(cur) && rowContainsPoint(cur, x, y)) {
          // Prefer the actual Arattai row ancestor if present.
          const art = cur.closest?.('.art-chat-item, [id^="art-chat-item-"]');
          if (art && rowName(art)) return art;
          const name = rowName(cur);
          if (name) return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    };
    const openChatHeaderName = () => {
      const header =
        document.querySelector('.art-chwindow-hdr')
        || document.querySelector('[data-testid="conversation-info-header"]')
        || document.querySelector('#main header')
        || document.querySelector('[class*="chat-header" i]')
        || document.querySelector('[class*="ChatHeader" i]')
        || document.querySelector('header');
      const title = String(
        header?.querySelector?.('.chat-title-text')?.getAttribute?.('title')
        || header?.querySelector?.('.chat-title-text')?.textContent
        || header?.querySelector?.('.art-chat-title')?.textContent
        || header?.querySelector?.('[data-testid="conversation-info-header-chat-title"]')?.textContent
        || header?.querySelector?.('span[title]')?.getAttribute?.('title')
        || header?.querySelector?.('[dir="auto"]')?.textContent
        || header?.querySelector?.('h1,h2,h3,[role="heading"]')?.textContent
        || '',
      ).replace(/\\s+/g, ' ').trim();
      return tryText(title) || (isJunkName(title) ? '' : title.slice(0, 80));
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
    const cell = findChatRowFromPoint(x, y);
    if (cell) {
      const name = rowName(cell);
      if (name) {
        return {
          ok: true,
          name,
          chatKey: name.toLowerCase(),
          unread: rowUnread(cell),
          via: 'list-row',
          chid: String(cell.getAttribute?.('chid') || cell.getAttribute?.('data-chid') || ''),
        };
      }
    }
    // Open-chat header fallback (right-click inside the conversation / after Arattai menu covers the row).
    const headerName = openChatHeaderName();
    if (headerName) {
      return {
        ok: true,
        name: headerName.slice(0, 80),
        chatKey: headerName.toLowerCase(),
        unread: 0,
        via: 'open-header',
      };
    }
    return { ok: false, reason: 'not_chat_row' };
  })()`;
}

/** Best-effort: open a chat by display name (list click or in-app search). */
export function openMessagingChatJs(name, chatKey = '') {
  const targetName = String(name || '').trim();
  const targetKey = normalizeChatKey(chatKey || targetName);
  return `(async () => {
    ${guestChatListHelpersJs()}
    const wantName = ${JSON.stringify(targetName)};
    const wantKey = ${JSON.stringify(targetKey)};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const norm = (s) => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const wantN = norm(wantName);
    const midX = () => (window.innerWidth || 1000) * 0.55;
    const inLeftPane = (el) => {
      try {
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.left < midX();
      } catch (e) { return false; }
    };
    const click = (el) => {
      if (!el || !visible(el)) return false;
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
      try {
        const r = el.getBoundingClientRect();
        const x = r.left + Math.min(40, Math.max(12, r.width / 2));
        const y = r.top + r.height / 2;
        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons: 1,
          }));
        }
        try { el.click(); } catch (e) {}
        return true;
      } catch (e) {
        try { el.click(); return true; } catch (e2) { return false; }
      }
    };
    const wantTokens = wantN.split(' ').filter((t) => t.length >= 3);
    const isShortSingleToken = wantTokens.length === 1 && wantN.split(' ').length === 1;
    const looksLikeGroup = (el, title) => {
      const t = norm(title);
      if (/\\b(group|community|broadcast)\\b/.test(t)) return true;
      if (/&/.test(String(title || '')) && String(title || '').split(/\\s+/).filter(Boolean).length >= 2) {
        return true;
      }
      if (el?.querySelector?.(
        '[data-testid="default-group"], [data-icon="default-group"], [data-icon="group"], [data-icon="community"], span[data-icon="default-group"]',
      )) return true;
      const aria = String(el?.getAttribute?.('aria-label') || '').toLowerCase();
      if (/\\b(group|community|broadcast)\\b/.test(aria)) return true;
      return false;
    };
    // Score chat *titles* only — never last-message previews that mention the pin.
    const scoreName = (title) => {
      const key = norm(title);
      if (!key || isJunkName(key)) return -1;
      if (key === wantKey || key === wantN) return 100;
      if (wantKey && key.includes(wantKey)) return 88;
      if (wantN && key.includes(wantN)) return 84;
      // Title is a shortening of the pin ("Kumar Gardas" vs full pin).
      if (wantN && wantN.includes(key) && key.length >= 6) return 58;
      if (wantKey && wantKey.includes(key) && key.length >= 6) return 56;
      if (wantTokens.length >= 2) {
        let hit = 0;
        for (const t of wantTokens) if (key.includes(t)) hit += 1;
        if (hit === wantTokens.length) return 78;
        if (hit >= 2 && hit >= Math.ceil(wantTokens.length * 0.6)) return 62;
        return -1;
      }
      // Short single-token pins ("shrikant"): require title ≈ name.
      // Weak includes() previously matched group rows / message hits.
      if (isShortSingleToken) {
        const tok = wantTokens[0];
        if (key === tok) return 100;
        if (key.startsWith(tok + ' ') || key.endsWith(' ' + tok)) return 72;
        if (key.includes(tok) && key.length <= tok.length + 10) return 68;
        return -1;
      }
      const token = wantTokens[0] || '';
      if (token && key.includes(token) && key.length <= Math.max(24, token.length + 16)) return 48;
      return -1;
    };
    const clickableRowFrom = (el) => {
      if (!el) return null;
      return (
        el.closest?.(listSel)
        || el.closest?.('[data-testid="cell-frame-container"]')
        || el.closest?.('[role="listitem"]')
        || el.closest?.('[role="row"]')
        || el.closest?.('[role="button"]')
        || el.closest?.('div[tabindex]')
        || el
      );
    };
    const findRow = () => {
      let best = null;
      let bestScore = -1;
      let bestGroup = false;
      const consider = (title, el) => {
        let score = scoreName(title);
        if (score < 48 || !el || !visible(el) || !inLeftPane(el)) return;
        const group = looksLikeGroup(el, title);
        // Prefer DM/contact rows over groups that only mention the person.
        if (group && score < 100) score -= 30;
        if (score < 48) return;
        if (
          score > bestScore
          || (score === bestScore && bestGroup && !group)
        ) {
          bestScore = score;
          best = el;
          bestGroup = group;
        }
      };
      for (const cell of document.querySelectorAll(listSel)) {
        consider(rowName(cell), cell);
      }
      // Search results / "Recent searches" often expose a title span before the row hooks settle.
      for (const span of document.querySelectorAll(
        '[data-testid="cell-frame-title"] span[title], [data-testid="cell-frame-title"], span[title], div[title]',
      )) {
        if (span.closest?.('[data-testid="conversation-info-header"], #main header, .art-chwindow-hdr')) {
          continue;
        }
        // Skip last-message / secondary lines — title attr on those can poison matching.
        if (span.closest?.(
          '[data-testid="last-msg-body"], [data-testid="cell-frame-secondary"], .lhs-list-msginfo',
        )) continue;
        const title = span.getAttribute?.('title') || span.textContent;
        consider(title, clickableRowFrom(span));
      }
      return bestScore >= 48 ? best : null;
    };
    const openHeaderName = () => openChatHeaderName();
    const composeOpen = () => {
      if (document.querySelector('[data-testid="conversation-compose-box-input"]')) return true;
      if (document.querySelector('footer [contenteditable="true"]')) return true;
      const nodes = document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');
      const vh = window.innerHeight || 800;
      for (const n of nodes) {
        const ph = String(n.getAttribute('placeholder') || n.getAttribute('data-placeholder') || '').toLowerCase();
        if (/search/.test(ph)) continue;
        if (/type your message|message here|type a message/.test(ph)) return true;
        try {
          const r = n.getBoundingClientRect();
          if (r.width >= 120 && r.top > vh * 0.55 && r.left >= midX() * 0.7) return true;
        } catch (e) {}
      }
      return false;
    };
    // Require the open header to match the pin — never treat "some compose is open" as success
    // (that left users on Parth while search still showed the typed pin name).
    const confirmedOpen = () => {
      const header = openHeaderName();
      if (!header) return false;
      return scoreName(header) >= 56;
    };
    const leftSearchEls = () => Array.from(document.querySelectorAll(
      [
        '[data-testid="chat-list-search"]',
        'div[contenteditable="true"][data-tab="3"]',
        '[contenteditable="true"][data-tab="3"]',
        '[contenteditable="true"][aria-label*="Search" i]',
        '[contenteditable="true"][title*="Search" i]',
        'input[placeholder*="Search" i]',
        '[placeholder*="Search" i]',
        '[data-placeholder*="Search" i]',
        'input[type="search"]',
      ].join(','),
    )).filter((el) => {
      if (!visible(el) || !inLeftPane(el)) return false;
      const ph = String(
        el.getAttribute('placeholder')
          || el.getAttribute('data-placeholder')
          || el.getAttribute('aria-label')
          || el.getAttribute('title')
          || '',
      ).toLowerCase();
      if (/search messages|search this chat/.test(ph)) return false;
      return /search/.test(ph) || el.getAttribute('data-tab') === '3'
        || el.getAttribute?.('data-testid') === 'chat-list-search';
    });
    const searchHasText = (el) => {
      if (!el) return false;
      try {
        if ('value' in el && String(el.value || '').trim()) return true;
      } catch (e) {}
      return String(el.textContent || el.innerText || '').trim().length > 0;
    };
    // Stale left-pane queries ("us apple portal price") break the next pin open.
    const clearLeftSearch = async () => {
      try {
        for (const btn of document.querySelectorAll(
          [
            'button[aria-label="Cancel"]',
            'button[aria-label*="Cancel" i]',
            '[aria-label="Clear search"]',
            '[aria-label*="Clear search" i]',
            '[aria-label*="Clear" i]',
            '[data-testid="search-input-clear"]',
            '[data-icon="x"]',
            '[data-icon="back"]',
            'span[data-icon="x"]',
            'span[data-icon="back"]',
          ].join(','),
        )) {
          if (!visible(btn) || !inLeftPane(btn)) continue;
          click(btn.closest?.('button,[role="button"]') || btn);
          await wait(80);
        }
        for (const el of leftSearchEls()) {
          try { el.focus(); } catch (e) {}
          click(el);
          try {
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
          } catch (e) {}
          try {
            if ('value' in el) {
              el.value = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              el.textContent = '';
              el.dispatchEvent(new InputEvent('input', {
                bubbles: true, data: '', inputType: 'deleteContentBackward',
              }));
            }
          } catch (e) {}
        }
        for (let i = 0; i < 2; i += 1) {
          document.activeElement?.blur?.();
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true,
          }));
          await wait(90);
        }
      } catch (e) {}
    };
    const dismissSearch = clearLeftSearch;
    const fillSearch = (el, text) => {
      if (!el) return false;
      try { el.focus(); } catch (e) {}
      click(el);
      // Wipe any leftover query before typing the pin name.
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      } catch (e) {}
      try {
        if ('value' in el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      } catch (e) {}
      try {
        el.textContent = '';
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, data: '', inputType: 'deleteContentBackward',
        }));
      } catch (e) {}
      // WhatsApp contenteditable often ignores bare textContent — paste + insertText.
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: dt, bubbles: true, cancelable: true,
        }));
      } catch (e) {}
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, data: text, inputType: 'insertText',
        }));
      } catch (e) {
        try {
          el.textContent = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e2) {}
      }
      return true;
    };
    const tryOpenRow = async (row, via) => {
      if (!row) return null;
      // Click the title control when present — more reliable than the outer frame.
      const titleEl =
        row.querySelector?.('[data-testid="cell-frame-title"]')
        || row.querySelector?.('.chat-title-text')
        || row.querySelector?.('span[title]')
        || row;
      click(titleEl);
      await wait(280);
      if (confirmedOpen()) return { ok: true, via };
      click(row);
      await wait(420);
      if (confirmedOpen()) return { ok: true, via };
      return null;
    };
    const tryKeyboardOpen = async (searchEl) => {
      if (!searchEl) return null;
      try { searchEl.focus(); } catch (e) {}
      for (const key of [
        { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        { key: 'Enter', code: 'Enter', keyCode: 13 },
      ]) {
        searchEl.dispatchEvent(new KeyboardEvent('keydown', { ...key, which: key.keyCode, bubbles: true }));
        searchEl.dispatchEvent(new KeyboardEvent('keyup', { ...key, which: key.keyCode, bubbles: true }));
        await wait(70);
      }
      await wait(450);
      if (confirmedOpen()) return { ok: true, via: 'search-enter' };
      return null;
    };

    // Already on this chat.
    if (confirmedOpen()) return { ok: true, via: 'already-open' };

    // Always start from a clean left list — stale WA search text is the common failure mode.
    await clearLeftSearch();
    await wait(180);

    let row = findRow();
    let opened = await tryOpenRow(row, 'list-click');
    if (opened) {
      await clearLeftSearch();
      return opened;
    }

    // Open left-pane search (not in-chat message search).
    const searchBtn =
      document.querySelector('[data-testid="chat-list-search"]')
      || document.querySelector('[aria-label="Search or start a new chat"]')
      || document.querySelector('button[aria-label*="Search" i]')
      || document.querySelector('[aria-label*="Search or start" i]')
      || document.querySelector('[data-icon="search"]')?.closest('button,[role="button"],div');
    if (searchBtn && inLeftPane(searchBtn)) {
      click(searchBtn);
      await wait(220);
    }
    const search = leftSearchEls()[0] || null;

    if (search) {
      fillSearch(search, wantName);
      // WA search results (esp. Contacts vs Messages) need a beat to settle.
      await wait(520);
      const searchStarted = Date.now();
      const deadline = searchStarted + 5600;
      let keyboardTried = false;
      while (Date.now() < deadline) {
        row = findRow();
        opened = await tryOpenRow(row, 'search-click');
        if (opened) {
          await clearLeftSearch();
          return opened;
        }
        // ArrowDown+Enter only after a titled match exists — otherwise WA opens a
        // Messages hit in a group that merely @mentions the pin name.
        if (
          !keyboardTried
          && row
          && Date.now() - searchStarted > 900
          && scoreName(rowName(row) || '') >= 68
        ) {
          keyboardTried = true;
          opened = await tryKeyboardOpen(search);
          if (opened) {
            await clearLeftSearch();
            return opened;
          }
        }
        await wait(180);
      }
    }

    // Last pass: click any visible matching row again (list may have refreshed).
    row = findRow();
    opened = await tryOpenRow(row, 'list-retry');
    if (opened) {
      await clearLeftSearch();
      return opened;
    }

    // Leave search UI clean — typed name without an open chat is the flaky failure mode.
    await clearLeftSearch();
    return {
      ok: false,
      reason: 'chat_not_found',
      header: openHeaderName(),
      compose: composeOpen(),
      searchDirty: leftSearchEls().some(searchHasText),
    };
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

/**
 * Hub quick search across an open WhatsApp/Arattai page:
 * chat names, last-message previews, and visible messages in the open thread.
 */
export function searchMessagingChatsJs(query) {
  const q = String(query || '').trim().toLowerCase();
  return `(() => {
    ${guestChatListHelpersJs()}
    const rawQ = ${JSON.stringify(q)};
    if (!rawQ) return { chats: [] };
    const norm = (s) => String(s || '')
      .toLowerCase()
      .replace(/[^\\p{L}\\p{N}\\s]+/gu, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
    const q = norm(rawQ);
    if (!q) return { chats: [] };
    const tokens = q.split(' ').filter((t) => t.length >= 3);
    const textMatches = (hayRaw) => {
      const hay = norm(hayRaw);
      if (!hay) return false;
      if (hay.includes(q)) return true;
      // Token overlap — tolerates a missing first letter (e.g. "ettled" in "settled").
      if (tokens.length >= 2) {
        let hit = 0;
        for (const t of tokens) {
          if (hay.includes(t) || (t.length >= 5 && hay.includes(t.slice(1)))) hit += 1;
        }
        if (hit >= Math.min(tokens.length, Math.max(2, Math.ceil(tokens.length * 0.6)))) {
          return true;
        }
      } else if (tokens.length === 1) {
        const t = tokens[0];
        if (hay.includes(t) || (t.length >= 5 && hay.includes(t.slice(1)))) return true;
      }
      return false;
    };
    const rowPreview = (cell) => {
      const previewEl =
        cell.querySelector('[data-testid="last-msg-body"]')
        || cell.querySelector('[data-testid="cell-frame-secondary"]')
        || cell.querySelector('.lhs-list-msginfo')
        || cell.querySelector('[class*="preview" i]')
        || null;
      let preview = textOf(previewEl);
      if (!preview) {
        const lines = String(cell.innerText || '')
          .split(/\\n+/)
          .map((l) => l.replace(/\\s+/g, ' ').trim())
          .filter(Boolean);
        // Skip the title line; take the next substantial line as preview.
        preview = lines.slice(1).find((l) => l.length >= 4 && !isJunkName(l) && !/^\\d{1,2}:\\d{2}/.test(l)) || '';
      }
      return String(preview || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
    };
    const snippetAround = (text, max = 90) => {
      const clean = String(text || '').replace(/\\s+/g, ' ').trim();
      if (!clean) return '';
      const hay = norm(clean);
      let idx = hay.indexOf(q);
      if (idx < 0 && tokens[0]) idx = hay.indexOf(tokens[0]);
      if (idx < 0) return clean.slice(0, max);
      const start = Math.max(0, idx - 18);
      const end = Math.min(clean.length, start + max);
      return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
    };

    const out = [];
    const seen = new Set();
    const pushHit = (name, match, snippet) => {
      const key = String(name || '').toLowerCase();
      if (!name || !key || seen.has(key) || isJunkName(name)) return;
      seen.add(key);
      out.push({
        chatKey: key,
        name,
        match: match || 'name',
        snippet: String(snippet || '').slice(0, 120),
      });
    };

    // 1) Chat list: name or last-message preview.
    const cells = Array.from(document.querySelectorAll(listSel));
    for (const cell of cells) {
      if (!visible(cell) || out.length >= 16) break;
      const name = rowName(cell);
      if (!name) continue;
      const preview = rowPreview(cell);
      if (textMatches(name)) {
        pushHit(name, 'name', preview);
      } else if (preview && textMatches(preview)) {
        pushHit(name, 'preview', snippetAround(preview));
      }
    }

    // 2) Open conversation: scan visible message bubbles for message text.
    if (out.length < 16) {
      const openName = openChatHeaderName();
      if (openName && !seen.has(openName.toLowerCase())) {
        const panel =
          document.querySelector('[data-testid="conversation-panel-body"]')
          || document.querySelector('[data-testid="conversation-panel-wrapper"]')
          || document.querySelector('#main')
          || document.querySelector('.art-chwindow')
          || document.querySelector('[role="log"]')
          || document.querySelector('[role="main"]');
        const msgNodes = panel
          ? Array.from(panel.querySelectorAll(
            '[data-testid="msg-container"], [data-message-id], .copyable-text, .selectable-text, [class*="message-in"], [class*="message-out"], [class*="bubble"]',
          )).filter(visible)
          : [];
        for (const node of msgNodes) {
          if (out.length >= 16) break;
          const preferred = node.matches?.('.copyable-text, .selectable-text')
            ? node
            : node.querySelector?.('.copyable-text, .selectable-text, [data-testid="conversation-text"]');
          const msg = String((preferred || node).innerText || '')
            .replace(/\\s+/g, ' ')
            .trim()
            .slice(0, 240);
          if (msg.length < 4 || !textMatches(msg)) continue;
          pushHit(openName, 'message', snippetAround(msg));
          break;
        }
      }
    }

    return { chats: out };
  })()`;
}
