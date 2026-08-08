/**
 * Customizable keyboard shortcuts — pure helpers (no Electron).
 *
 * Stored shape per id:
 *   { enabled: boolean, accel: string }
 * Legacy boolean values migrate to { enabled, accel: default }.
 *
 * Special kinds:
 *   tabDigits   — modifiers + digit 1–9 (accel example: Control+1)
 *   tabCycle    — modifiers + Tab (Shift reverses); also PageUp/PageDown
 *   backForward — modifiers + Left/Right arrows
 *   simple      — exact accel match
 */

export const SHORTCUT_CATALOG = Object.freeze([
  {
    id: 'switchTab',
    group: 'App navigation',
    label: 'Go to specific tab',
    kind: 'tabDigits',
    defaultAccel: 'Control+1',
    hint: 'Uses the same modifiers with keys 1–9',
  },
  {
    id: 'nextTab',
    group: 'App navigation',
    label: 'Switch tabs',
    kind: 'tabCycle',
    defaultAccel: 'Control+Tab',
    hint: 'Add Shift to go backward (also PageUp / PageDown)',
  },
  {
    id: 'backForward',
    group: 'App navigation',
    label: 'Back / Forward in apps',
    kind: 'backForward',
    defaultAccel: 'Alt+ArrowLeft',
    hint: 'Same modifiers with Left / Right arrows',
  },
  {
    id: 'search',
    group: 'Sections and features',
    label: 'Quick search',
    kind: 'simple',
    defaultAccel: 'Control+/',
  },
  {
    id: 'find',
    group: 'Sections and features',
    label: 'Find in page',
    kind: 'simple',
    defaultAccel: 'Control+F',
  },
  {
    id: 'webSearch',
    group: 'Sections and features',
    label: 'Web search (Google)',
    kind: 'simple',
    // Not Ctrl+K — WhatsApp / Arattai use Ctrl+K for chat/contact search.
    defaultAccel: 'Control+E',
  },
  {
    id: 'print',
    group: 'Sections and features',
    label: 'Print page',
    kind: 'simple',
    defaultAccel: 'Control+P',
  },
  {
    id: 'settings',
    group: 'Sections and features',
    label: 'Settings',
    kind: 'simple',
    defaultAccel: 'Control+,',
  },
  {
    id: 'focusMode',
    group: 'Sections and features',
    label: 'Focus mode',
    kind: 'simple',
    defaultAccel: 'Control+Shift+D',
  },
  {
    id: 'mute',
    group: 'Sections and features',
    label: 'Mute',
    kind: 'simple',
    defaultAccel: 'Control+Shift+M',
  },
  {
    id: 'hibernate',
    group: 'Sections and features',
    label: 'Hibernate background',
    kind: 'simple',
    defaultAccel: 'Control+Shift+H',
  },
  {
    id: 'lock',
    group: 'Sections and features',
    label: 'Lock Aspera Hub',
    kind: 'simple',
    defaultAccel: 'Control+Shift+L',
  },
]);

const CATALOG_BY_ID = Object.fromEntries(SHORTCUT_CATALOG.map((s) => [s.id, s]));

/** Combos reserved for the OS / app menu that users should not steal. */
export const RESERVED_ACCELS = Object.freeze([
  'Control+Q',
  'Control+W',
  'Control+M',
  'Control+R',
  'F11',
]);

export function catalogEntry(id) {
  return CATALOG_BY_ID[String(id || '')] || null;
}

export function defaultShortcutsMap() {
  const out = {};
  for (const item of SHORTCUT_CATALOG) {
    out[item.id] = { enabled: true, accel: item.defaultAccel };
  }
  return out;
}

export function normalizeKeyName(key) {
  const k = String(key || '').toLowerCase();
  if (!k) return '';
  if (k === 'esc') return 'escape';
  if (k === ' ') return 'space';
  if (k === 'arrowleft' || k === 'left') return 'arrowleft';
  if (k === 'arrowright' || k === 'right') return 'arrowright';
  if (k === 'arrowup' || k === 'up') return 'arrowup';
  if (k === 'arrowdown' || k === 'down') return 'arrowdown';
  if (k === 'pageup') return 'pageup';
  if (k === 'pagedown') return 'pagedown';
  if (k === ',') return ',';
  if (k === '/') return '/';
  if (k === '.') return '.';
  if (k === ';') return ';';
  if (k === "'") return "'";
  if (k === '\\') return '\\';
  if (k === '[' || k === ']' || k === '-' || k === '=' || k === '`') return k;
  if (/^digit([0-9])$/.test(k)) return k.slice(5);
  if (/^numpad([0-9])$/.test(k)) return k.slice(6);
  if (k.startsWith('key') && k.length === 4) return k.slice(3);
  return k;
}

export function parseAccel(accel) {
  const parts = String(accel || '')
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  const out = {
    control: false,
    alt: false,
    shift: false,
    meta: false,
    key: '',
  };
  for (const part of parts) {
    const p = part.toLowerCase();
    if (p === 'control' || p === 'ctrl' || p === 'cmdorctrl' || p === 'commandorcontrol') {
      out.control = true;
      continue;
    }
    if (p === 'alt' || p === 'option') {
      out.alt = true;
      continue;
    }
    if (p === 'shift') {
      out.shift = true;
      continue;
    }
    if (p === 'meta' || p === 'command' || p === 'cmd' || p === 'super') {
      out.meta = true;
      continue;
    }
    out.key = normalizeKeyName(part);
  }
  return out;
}

export function formatAccel(accel, { kind } = {}) {
  const p = typeof accel === 'string' ? parseAccel(accel) : accel || {};
  const mods = [];
  if (p.control) mods.push('Ctrl');
  if (p.alt) mods.push('Alt');
  if (p.shift) mods.push('Shift');
  if (p.meta) mods.push('Meta');
  const key = normalizeKeyName(p.key);
  if (kind === 'tabDigits') {
    return `${mods.join(' + ') || 'Ctrl'} + 1–9`;
  }
  if (kind === 'tabCycle') {
    const base = mods.filter((m) => m !== 'Shift').join(' + ') || 'Ctrl';
    return `${base} + Tab / ${base} + Shift + Tab`;
  }
  if (kind === 'backForward') {
    const base = mods.join(' + ') || 'Alt';
    return `${base} + Left / Right`;
  }
  const prettyKey = prettyKeyLabel(key);
  if (!prettyKey) return mods.join(' + ') || 'Not set';
  return [...mods, prettyKey].join(' + ');
}

function prettyKeyLabel(key) {
  const k = normalizeKeyName(key);
  if (!k) return '';
  const map = {
    arrowleft: 'Left',
    arrowright: 'Right',
    arrowup: 'Up',
    arrowdown: 'Down',
    escape: 'Esc',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    tab: 'Tab',
    space: 'Space',
    enter: 'Enter',
    backspace: 'Backspace',
    delete: 'Delete',
    ',': ',',
    '/': '/',
  };
  if (map[k]) return map[k];
  if (/^[a-z0-9]$/.test(k)) return k.toUpperCase();
  if (/^f\d{1,2}$/.test(k)) return k.toUpperCase();
  return k.length === 1 ? k.toUpperCase() : k;
}

export function serializeAccel({ control, alt, shift, meta, key }) {
  const parts = [];
  if (control) parts.push('Control');
  if (alt) parts.push('Alt');
  if (shift) parts.push('Shift');
  if (meta) parts.push('Meta');
  const k = normalizeKeyName(key);
  if (!k) return parts.join('+');
  const keyToken =
    k === 'arrowleft'
      ? 'ArrowLeft'
      : k === 'arrowright'
        ? 'ArrowRight'
        : k === 'arrowup'
          ? 'ArrowUp'
          : k === 'arrowdown'
            ? 'ArrowDown'
            : k === 'pageup'
              ? 'PageUp'
              : k === 'pagedown'
                ? 'PageDown'
                : k === 'tab'
                  ? 'Tab'
                  : k === 'escape'
                    ? 'Escape'
                    : k === 'space'
                      ? 'Space'
                      : /^[a-z0-9]$/.test(k)
                        ? k.toUpperCase()
                        : k;
  parts.push(keyToken);
  return parts.join('+');
}

export function accelFromKeyEvent(eventLike) {
  const key = normalizeKeyName(eventLike?.key);
  if (!key) return null;
  if (['control', 'shift', 'alt', 'meta', 'os'].includes(key)) return null;
  const control = !!(eventLike.ctrlKey || eventLike.control);
  const alt = !!(eventLike.altKey || eventLike.alt);
  const shift = !!(eventLike.shiftKey || eventLike.shift);
  const meta = !!(eventLike.metaKey || eventLike.meta);
  // Require at least one modifier for letters/digits to avoid stealing typing.
  if (!control && !alt && !meta && !/^f\d{1,2}$/.test(key)) {
    return null;
  }
  return serializeAccel({ control, alt, shift, meta, key });
}

export function normalizeShortcutEntry(id, value) {
  const cat = catalogEntry(id);
  const defaultAccel = cat?.defaultAccel || 'Control+Shift+L';
  const kind = cat?.kind || 'simple';
  if (value && typeof value === 'object') {
    return {
      enabled: value.enabled !== false,
      accel: String(value.accel || defaultAccel),
      kind,
    };
  }
  if (value === false) {
    return { enabled: false, accel: defaultAccel, kind };
  }
  return { enabled: true, accel: defaultAccel, kind };
}

export function migrateShortcutsMap(raw = {}) {
  const out = defaultShortcutsMap();
  const incoming = raw && typeof raw === 'object' ? raw : {};
  for (const item of SHORTCUT_CATALOG) {
    if (Object.prototype.hasOwnProperty.call(incoming, item.id)) {
      out[item.id] = normalizeShortcutEntry(item.id, incoming[item.id]);
    }
  }
  // v0.5.4 briefly bound Web search to Ctrl+K, which broke Arattai/WhatsApp
  // "Search chats and contacts (ctrl + k)". Force those installs onto Ctrl+E.
  const webAccel = String(out.webSearch?.accel || '')
    .toLowerCase()
    .replace(/commandorcontrol/g, 'control');
  if (webAccel === 'control+k') {
    out.webSearch = {
      ...out.webSearch,
      enabled: out.webSearch?.enabled !== false,
      accel: 'Control+E',
    };
  }
  return out;
}

function modsEqual(a, b, { ignoreShift = false } = {}) {
  return (
    !!a.control === !!b.control &&
    !!a.alt === !!b.alt &&
    !!a.meta === !!b.meta &&
    (ignoreShift || !!a.shift === !!b.shift)
  );
}

/**
 * Match a Chromium/Electron before-input-event `input` against a binding.
 * @returns {false|true|{ action: string, digit?: number }}
 */
export function matchShortcut(entry, input) {
  if (!entry || entry.enabled === false) return false;
  if (!input || input.type === 'keyUp') return false;
  const parsed = parseAccel(entry.accel);
  const key = normalizeKeyName(input.key);
  const incoming = {
    control: !!input.control,
    alt: !!input.alt,
    shift: !!input.shift,
    meta: !!input.meta,
    key,
  };
  const kind = entry.kind || 'simple';

  if (kind === 'tabDigits') {
    if (!modsEqual(parsed, incoming, { ignoreShift: true })) return false;
    if (incoming.shift) return false;
    if (!/^[1-9]$/.test(key)) return false;
    return { action: 'switchTab', digit: Number(key) };
  }

  if (kind === 'tabCycle') {
    const base = { ...parsed, shift: false };
    if (!modsEqual(base, { ...incoming, shift: false }, { ignoreShift: true })) {
      return false;
    }
    if (key === 'pageup') return { action: 'prevTab' };
    if (key === 'pagedown' || (key === 'tab' && !incoming.shift)) {
      return { action: 'nextTab' };
    }
    if (key === 'tab' && incoming.shift) return { action: 'prevTab' };
    return false;
  }

  if (kind === 'backForward') {
    if (!modsEqual(parsed, incoming, { ignoreShift: true })) return false;
    if (incoming.shift) return false;
    if (key === 'arrowleft') return { action: 'back' };
    if (key === 'arrowright') return { action: 'forward' };
    return false;
  }

  if (!modsEqual(parsed, incoming)) return false;
  return key === parsed.key ? { action: 'run' } : false;
}

export function conflictKey(accel, kind) {
  const p = parseAccel(accel);
  if (kind === 'tabDigits') {
    return `digits|c${+!!p.control}|a${+!!p.alt}|m${+!!p.meta}`;
  }
  if (kind === 'tabCycle') {
    return `cycle|c${+!!p.control}|a${+!!p.alt}|m${+!!p.meta}`;
  }
  if (kind === 'backForward') {
    return `arrows|c${+!!p.control}|a${+!!p.alt}|m${+!!p.meta}`;
  }
  return `simple|${serializeAccel(p).toLowerCase()}`;
}

export function findShortcutConflicts(map) {
  const migrated = migrateShortcutsMap(map);
  const seen = new Map();
  const conflicts = [];
  for (const item of SHORTCUT_CATALOG) {
    const entry = migrated[item.id];
    if (!entry.enabled) continue;
    const key = conflictKey(entry.accel, entry.kind);
    if (seen.has(key)) {
      conflicts.push({
        a: seen.get(key),
        b: item.id,
        accel: entry.accel,
      });
    } else {
      seen.set(key, item.id);
    }
    // Reserved simple accels
    if (entry.kind === 'simple') {
      const norm = serializeAccel(parseAccel(entry.accel));
      if (RESERVED_ACCELS.some((r) => r.toLowerCase() === norm.toLowerCase())) {
        conflicts.push({
          a: item.id,
          b: 'reserved',
          accel: entry.accel,
          reserved: true,
        });
      }
    }
  }
  return conflicts;
}

export function groupedShortcutCatalog() {
  const groups = [];
  const byGroup = new Map();
  for (const item of SHORTCUT_CATALOG) {
    if (!byGroup.has(item.group)) {
      const g = { group: item.group, items: [] };
      byGroup.set(item.group, g);
      groups.push(g);
    }
    byGroup.get(item.group).items.push(item);
  }
  return groups;
}

/** Electron Menu accelerator string (best-effort for simple bindings). */
export function toElectronAccelerator(accel) {
  const p = parseAccel(accel);
  const parts = [];
  if (p.control) parts.push('CommandOrControl');
  if (p.alt) parts.push('Alt');
  if (p.shift) parts.push('Shift');
  if (p.meta) parts.push('Super');
  const k = normalizeKeyName(p.key);
  if (!k) return parts.join('+');
  const key =
    k === 'arrowleft'
      ? 'Left'
      : k === 'arrowright'
        ? 'Right'
        : k === ','
          ? ','
          : k === '/'
            ? '/'
            : k.length === 1
              ? k.toUpperCase()
              : k.charAt(0).toUpperCase() + k.slice(1);
  parts.push(key);
  return parts.join('+');
}
