/**
 * Notification-center feed helpers.
 * Messaging-style cards: sender + multi-line preview; reply only with a chat target.
 */

const AGGREGATE_UNREAD_RE = /^\d+\s*unread\b/i;

export function isAggregateUnreadBody(body = '') {
  return AGGREGATE_UNREAD_RE.test(String(body || '').trim());
}

/**
 * Collapse message text into up to `maxLines` preview lines for the notif card.
 */
export function formatMessagePreview(
  text,
  { maxLines = 3, maxChars = 280, lineChars = 96 } = {},
) {
  const raw = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!raw) return '';

  const fromBreaks = raw
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let lines = fromBreaks.slice(0, maxLines);
  if (lines.length === 1 && lines[0].length > lineChars) {
    const single = lines[0];
    lines = [];
    for (let i = 0; i < single.length && lines.length < maxLines; i += lineChars) {
      lines.push(single.slice(i, i + lineChars).trim());
    }
  }

  let out = lines.join('\n').slice(0, maxChars).trim();
  if (raw.length > maxChars && out.length >= maxChars - 1) {
    out = `${out.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  }
  return out;
}

/**
 * Merge logged notifications with live unread chat scrapes.
 * Prefer real message previews; expand generic "N unread" into per-chat cards.
 */
export function mergeNotificationFeed({
  logItems = [],
  scrapedChats = [],
  hideContent = false,
} = {}) {
  const out = [];
  const seen = new Set();
  const keyOf = (serviceId, chatKey, title) =>
    `${serviceId}::${String(chatKey || title || '')
      .toLowerCase()
      .trim()}`;

  const push = (item) => {
    if (!item) return;
    const k = keyOf(item.serviceId, item.chatKey, item.title);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(item);
  };

  for (const note of logItems) {
    if (isAggregateUnreadBody(note.body) && !note.chatName) continue;
    const title = String(note.title || '').trim();
    const chatName = String(note.chatName || '').trim();
    const bodyRaw = hideContent
      ? 'New notification'
      : formatMessagePreview(note.body || '');
    const body =
      bodyRaw ||
      (note.unread > 1 ? `${note.unread} unread` : hideContent ? 'New notification' : '');
    push({
      id: note.id,
      serviceId: note.serviceId,
      appId: note.appId || '',
      title: hideContent && chatName ? chatName : title,
      body,
      at: note.at || Date.now(),
      chatName,
      chatKey: note.chatKey || '',
      unread: Number(note.unread) || 0,
      accountLabel: note.accountLabel || '',
      logo: note.logo || null,
      color: note.color || '#e2e8f0',
      canReply: !!(note.canReply && chatName && !hideContent),
    });
  }

  for (const chat of scrapedChats) {
    const name = String(chat.name || '').trim();
    if (!name) continue;
    const preview = hideContent
      ? 'New message'
      : formatMessagePreview(chat.preview || '');
    const unread = Number(chat.unread) || 0;
    push({
      id: chat.id || `${chat.serviceId}-${chat.chatKey || name}`,
      serviceId: chat.serviceId,
      appId: chat.appId || '',
      title: name,
      body:
        preview ||
        (unread > 0 ? `${unread} unread` : hideContent ? 'New message' : ''),
      at: chat.at || Date.now(),
      chatName: name,
      chatKey: chat.chatKey || name.toLowerCase(),
      unread,
      accountLabel: chat.accountLabel || '',
      logo: chat.logo || null,
      color: chat.color || '#e2e8f0',
      canReply: !!(!hideContent && chat.canReply !== false && name),
    });
  }

  return out
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 40);
}
