/**
 * Scrape a few earlier messages near a text selection in the open chat/thread
 * so Aspera AI summarize + suggest-reply can use human-like conversation context.
 */

export const PRIOR_MESSAGE_COUNT = 5;
export const PRIOR_MESSAGE_TEXT_MAX = 400;
export const PRIOR_CONTEXT_CHARS_MAX = 2_800;

/**
 * @typedef {{ role: 'you' | 'them' | 'unknown', text: string }} PriorMessage
 */

/**
 * Normalize scraped prior messages for prompts / storage.
 * @param {unknown} list
 * @param {{ max?: number, textMax?: number }} [opts]
 * @returns {PriorMessage[]}
 */
export function sanitizePriorMessages(list, opts = {}) {
  const max = Math.max(0, Number(opts.max) || PRIOR_MESSAGE_COUNT);
  const textMax = Math.max(40, Number(opts.textMax) || PRIOR_MESSAGE_TEXT_MAX);
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const text = String(raw?.text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, textMax);
    if (!text) continue;
    let role = String(raw?.role || 'unknown').toLowerCase();
    if (role === 'out' || role === 'me' || role === 'self' || role === 'sent') {
      role = 'you';
    } else if (
      role === 'in' ||
      role === 'other' ||
      role === 'them' ||
      role === 'received'
    ) {
      role = 'them';
    } else if (role !== 'you' && role !== 'them') {
      role = 'unknown';
    }
    out.push({ role, text });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Format prior messages for an AI prompt (oldest → newest).
 * @param {PriorMessage[] | unknown} messages
 * @returns {string}
 */
export function formatPriorMessagesForPrompt(messages) {
  const list = sanitizePriorMessages(messages);
  if (!list.length) return '';
  const lines = list.map((m, i) => {
    const who =
      m.role === 'you' ? 'You' : m.role === 'them' ? 'Them' : 'Someone';
    return `${i + 1}. [${who}] ${m.text}`;
  });
  let block = [
    'Earlier conversation (oldest → newest, before the selection):',
    ...lines,
  ].join('\n');
  if (block.length > PRIOR_CONTEXT_CHARS_MAX) {
    block = `${block.slice(0, PRIOR_CONTEXT_CHARS_MAX)}\n…`;
  }
  return block;
}

/**
 * Guest-page script: find the selected bubble and return up to `maxPrior`
 * messages immediately before it (plus optional chat title).
 *
 * @param {{
 *   selectionText?: string,
 *   maxPrior?: number,
 *   clickX?: number,
 *   clickY?: number,
 * }} [opts]
 */
export function scrapeNearbyMessagesJs(opts = {}) {
  const selectionText = String(opts.selectionText || '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .slice(0, 500);
  const maxPrior = Math.min(
    12,
    Math.max(1, Number(opts.maxPrior) || PRIOR_MESSAGE_COUNT),
  );
  const clickX = Number(opts.clickX) || 0;
  const clickY = Number(opts.clickY) || 0;

  return `(() => {
    const want = ${JSON.stringify(selectionText)};
    const maxPrior = ${maxPrior};
    const clickX = ${clickX};
    const clickY = ${clickY};
    const textMax = ${PRIOR_MESSAGE_TEXT_MAX};

    const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
    const visible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden'
          && r.width > 12 && r.height > 10;
      } catch (e) { return false; }
    };

    const chatTitle = () => {
      const header =
        document.querySelector('[data-testid="conversation-info-header"]')
        || document.querySelector('.art-chwindow-hdr')
        || document.querySelector('#main header')
        || document.querySelector('[role="main"] header')
        || document.querySelector('header');
      const t = norm(
        header?.querySelector?.('[data-testid="conversation-info-header-chat-title"]')?.textContent
        || header?.querySelector?.('.chat-title-text')?.getAttribute?.('title')
        || header?.querySelector?.('.chat-title-text')?.textContent
        || header?.querySelector?.('.art-chat-title')?.textContent
        || header?.querySelector?.('span[title]')?.getAttribute?.('title')
        || header?.querySelector?.('h1,h2,h3,[role="heading"]')?.textContent
        || '',
      );
      return t.slice(0, 80);
    };

    const isMessageLike = (el) => {
      if (!el || el === document.body || el === document.documentElement) return false;
      if (!visible(el)) return false;
      const testid = String(el.getAttribute?.('data-testid') || '');
      const cls = String(el.className || '');
      const role = String(el.getAttribute?.('role') || '');
      const id = String(el.id || '');
      const hay = (testid + ' ' + cls + ' ' + id).toLowerCase();
      if (testid === 'msg-container') return true;
      if (el.hasAttribute?.('data-message-id')) return true;
      if (/message-in|message-out|msg-container/.test(hay)) return true;
      if (/\\b(message|bubble|msg-item|chat-msg|msg_row|msg-row)\\b/.test(hay)) return true;
      if (role === 'listitem' && /message|bubble|msg/.test(hay)) return true;
      if (role === 'row' && /message|bubble|msg/.test(hay)) return true;
      return false;
    };

    const messageRootFrom = (node) => {
      let el = node;
      if (el?.nodeType === 3) el = el.parentElement;
      for (let i = 0; i < 18 && el && el !== document.body; i += 1) {
        if (isMessageLike(el)) return el;
        el = el.parentElement;
      }
      return null;
    };

    const messageText = (el) => {
      if (!el) return '';
      const preferred = el.querySelector?.(
        '.copyable-text, .selectable-text, [data-testid="conversation-text"], .a3s, .ii, [data-message-text], .msg-text, .message-text',
      );
      let raw = preferred ? preferred.innerText : el.innerText;
      // Drop common chrome crumbs.
      raw = String(raw || '')
        .replace(/\\b(Forwarded|Edited|Read|Delivered|Today|Yesterday)\\b/gi, ' ')
        .replace(/\\d{1,2}:\\d{2}(\\s?[AP]M)?/gi, ' ');
      return norm(raw).slice(0, textMax);
    };

    const directionOf = (el) => {
      const dataId =
        el.getAttribute?.('data-id')
        || el.querySelector?.('[data-id]')?.getAttribute?.('data-id')
        || '';
      if (/^true[_-]/.test(dataId)) return 'you';
      if (/^false[_-]/.test(dataId)) return 'them';
      const hay = [
        el.getAttribute?.('data-testid'),
        el.className,
        el.getAttribute?.('aria-label'),
        el.querySelector?.('[class*="message-out"], [class*="message-in"]')?.className,
      ].join(' ').toLowerCase();
      if (/message-out|msg-out|outgoing|from-me|is-me|\\bsent\\b|\\byou\\b/.test(hay)) {
        return 'you';
      }
      if (/message-in|msg-in|incoming|from-them|received|\\bthem\\b/.test(hay)) {
        return 'them';
      }
      try {
        const r = el.getBoundingClientRect();
        const mid = (window.innerWidth || 800) / 2;
        if (r.left > mid * 0.9) return 'you';
        if (r.right < mid * 1.1) return 'them';
      } catch (e) {}
      return 'unknown';
    };

    const collectMessageList = (focusMsg) => {
      if (!focusMsg) return [];
      // WhatsApp: all msg-containers in the conversation panel.
      const panel =
        focusMsg.closest?.('[data-testid="conversation-panel-body"]')
        || focusMsg.closest?.('[data-testid="conversation-panel-wrapper"]')
        || focusMsg.closest?.('#main')
        || focusMsg.closest?.('.art-chwindow')
        || focusMsg.closest?.('[role="log"]')
        || focusMsg.closest?.('[role="main"]')
        || focusMsg.closest?.('.AO')
        || document.querySelector('[data-testid="conversation-panel-body"]')
        || document.body;

      const wa = Array.from(
        panel.querySelectorAll('[data-testid="msg-container"]'),
      ).filter(visible);
      if (wa.length >= 2) {
        if (wa.includes(focusMsg) || wa.some((n) => n.contains(focusMsg))) {
          return wa.map((n) => (n.contains?.(focusMsg) && n !== focusMsg ? focusMsg : n))
            .filter((n, i, arr) => arr.indexOf(n) === i);
        }
        // focusMsg may be inside a container
        const owning = wa.find((n) => n === focusMsg || n.contains(focusMsg));
        if (owning) return wa;
      }

      // Walk parents until we find several message-like siblings / descendants.
      let parent = focusMsg.parentElement;
      for (let i = 0; i < 10 && parent; i += 1) {
        const kids = Array.from(parent.children).filter(isMessageLike);
        if (kids.length >= 2) {
          const hit = kids.find((k) => k === focusMsg || k.contains(focusMsg));
          if (hit) return kids;
        }
        const nested = Array.from(parent.querySelectorAll(
          '[data-testid="msg-container"], [data-message-id], [class*="message-in"], [class*="message-out"]',
        )).filter(isMessageLike);
        if (nested.length >= 2) {
          const hit = nested.find((k) => k === focusMsg || k.contains(focusMsg));
          if (hit) return nested;
        }
        parent = parent.parentElement;
      }
      return [focusMsg];
    };

    const findFocusMessage = () => {
      // 1) Live selection anchor/focus
      try {
        const sel = window.getSelection?.();
        if (sel && !sel.isCollapsed) {
          const n = sel.focusNode || sel.anchorNode;
          const root = messageRootFrom(n);
          if (root) return root;
        }
      } catch (e) {}

      // 2) Click point from context menu
      if (clickX > 0 || clickY > 0) {
        try {
          const stack = typeof document.elementsFromPoint === 'function'
            ? document.elementsFromPoint(clickX, clickY)
            : [document.elementFromPoint(clickX, clickY)].filter(Boolean);
          for (const el of stack) {
            const root = messageRootFrom(el);
            if (root) return root;
          }
        } catch (e) {}
      }

      // 3) Text match against visible message nodes
      const needle = norm(want).slice(0, 120).toLowerCase();
      if (needle.length >= 8) {
        const nodes = Array.from(document.querySelectorAll(
          '[data-testid="msg-container"], [data-message-id], [class*="message-in"], [class*="message-out"], [class*="bubble"]',
        )).filter(visible);
        let best = null;
        let bestScore = 0;
        for (const n of nodes) {
          const t = messageText(n).toLowerCase();
          if (!t) continue;
          if (t.includes(needle)) {
            const score = 1000 - Math.abs(t.length - needle.length);
            if (score > bestScore) { best = n; bestScore = score; }
          }
        }
        if (best) return best;
      }
      return null;
    };

    const focus = findFocusMessage();
    if (!focus) {
      return { messages: [], chatTitle: chatTitle(), focusFound: false };
    }

    const list = collectMessageList(focus);
    let focusIndex = list.findIndex((n) => n === focus || n.contains?.(focus));
    if (focusIndex < 0) {
      // Fallback: match by text
      const needle = norm(want || messageText(focus)).slice(0, 80).toLowerCase();
      focusIndex = list.findIndex((n) => messageText(n).toLowerCase().includes(needle));
    }
    if (focusIndex < 0) focusIndex = list.length - 1;

    const start = Math.max(0, focusIndex - maxPrior);
    const priorNodes = list.slice(start, focusIndex);
    const messages = [];
    const seen = new Set();
    for (const node of priorNodes) {
      const text = messageText(node);
      if (!text || text.length < 2) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      messages.push({ role: directionOf(node), text });
    }

    return {
      messages,
      chatTitle: chatTitle(),
      focusFound: true,
      priorCount: messages.length,
    };
  })()`;
}
