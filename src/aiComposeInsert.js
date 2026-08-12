/**
 * Guest-page helpers for Aspera AI "Use in chat" — find the live send box
 * even after WhatsApp/Arattai remounts the contenteditable (mark attribute lost).
 */

/**
 * @param {{ text: string, original?: string, composeSelector: string }} opts
 * @returns {string} IIFE source evaluated in the guest page
 */
export function buildApplyComposeTextJs({ text, original = '', composeSelector }) {
  return `(() => {
    const text = ${JSON.stringify(String(text || ''))};
    const original = ${JSON.stringify(String(original || ''))};
    const composeSel = ${JSON.stringify(String(composeSelector || ''))};

    const isSearchy = (node) => {
      if (!node) return true;
      const ph = String(
        node.getAttribute?.('placeholder')
          || node.getAttribute?.('data-placeholder')
          || node.getAttribute?.('aria-placeholder')
          || node.getAttribute?.('aria-label')
          || node.getAttribute?.('title')
          || '',
      ).toLowerCase();
      if (/search/.test(ph)) return true;
      if (node.closest?.('[data-testid="chat-list"], [data-testid="chat-list-search"], [class*="chat-list" i]')) {
        return true;
      }
      if (String(node.getAttribute?.('data-tab') || '') === '3') return true;
      return false;
    };

    const readValue = (el) => {
      if (!el) return '';
      const tag = String(el.tagName || '');
      if (tag === 'TEXTAREA' || tag === 'INPUT') return String(el.value || '');
      return String(el.innerText || el.textContent || '');
    };

    const candidates = [];
    const push = (el) => {
      if (!el || isSearchy(el)) return;
      if (candidates.includes(el)) return;
      candidates.push(el);
    };
    push(document.querySelector('[data-aspera-ai-compose="1"]'));
    push(document.querySelector('[data-testid="conversation-compose-box-input"]'));
    push(document.querySelector('footer [contenteditable="true"]'));
    if (composeSel) {
      for (const node of document.querySelectorAll(composeSel)) push(node);
    }

    let el = null;
    const orig = String(original || '').trim();
    if (orig) {
      el = candidates.find((n) => {
        const cur = readValue(n).trim();
        return cur && (cur === orig || cur.includes(orig));
      }) || null;
    }
    if (!el) el = candidates[0] || null;
    if (!el) return { ok: false, reason: 'no-target' };

    try {
      document.querySelectorAll('[data-aspera-ai-compose]').forEach((n) => {
        if (n !== el) n.removeAttribute('data-aspera-ai-compose');
      });
      el.setAttribute('data-aspera-ai-compose', '1');
    } catch (e) {}

    try { el.focus({ preventScroll: true }); } catch (e) {
      try { el.focus(); } catch (e2) {}
    }
    try { el.click(); } catch (e) {}

    const tag = String(el.tagName || '');
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      const value = String(el.value || '');
      if (original && value.includes(original)) {
        const i = value.indexOf(original);
        el.value = value.slice(0, i) + text + value.slice(i + original.length);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, via: 'input-value' };
    }

    if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') {
      const current = readValue(el);
      let next = text;
      if (original && current.includes(original) && current.trim() !== original.trim()) {
        next = current.replace(original, text);
      }
      try {
        const sel = window.getSelection?.();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel?.removeAllRanges?.();
        sel?.addRange?.(range);
      } catch (e) {}
      let inserted = false;
      try {
        inserted = !!document.execCommand('insertText', false, next);
      } catch (e) {
        inserted = false;
      }
      if (!inserted || !String(readValue(el) || '').includes(String(text).slice(0, Math.min(24, text.length)))) {
        try {
          el.textContent = next;
          el.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: next,
          }));
          inserted = true;
        } catch (e) {}
      } else {
        try {
          el.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: next,
          }));
        } catch (e) {}
      }
      return { ok: true, via: inserted ? 'contenteditable' : 'contenteditable-best-effort' };
    }

    return { ok: false, reason: 'not-editable' };
  })()`;
}

/**
 * Pure ranking helper used by tests — mirrors guest candidate preference.
 * @param {{ marked?: boolean, text?: string, searchy?: boolean }[]} nodes
 * @param {string} original
 */
export function pickComposeCandidate(nodes, original = '') {
  const list = (nodes || []).filter((n) => n && !n.searchy);
  const orig = String(original || '').trim();
  if (orig) {
    const match = list.find((n) => {
      const cur = String(n.text || '').trim();
      return cur && (cur === orig || cur.includes(orig));
    });
    if (match) return match;
  }
  const marked = list.find((n) => n.marked);
  if (marked) return marked;
  return list[0] || null;
}
