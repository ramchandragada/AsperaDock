# Aspera Dock

Lightweight company workspace desktop app for Linux Mint. Run multiple signed-in accounts of WhatsApp, Arattai, Google Workspace mail, Zoho Mail, Zoho CRM, Zoho Books, and Zoho One in one shell — built for refurbished PCs with **16 GB RAM**.

## Why this design

- **Electron + Chromium** for reliable WhatsApp / Google / Zoho web apps on Linux
- **One active BrowserView** shown at a time
- **Max 3 warm services** in RAM; older ones hibernate
- **Auto-hibernate** after 5 minutes unused
- **Isolated sessions** per account (separate logins, no cookie bleed)
- **Single instance** lock so staff do not open two docks by mistake

## Features

| Feature | Behaviour |
|---------|-----------|
| Rambox-style app bar | **Top** or **Left** (Settings → Apps position) |
| Workspace rail | All / Chat / Mail / Zoho filters on the left |
| Multi-login | Each account gets its own session partition |
| Unread badges | On icons + global bell + tray/taskbar |
| Focus / Mute / Free RAM | Toolbar chips + shortcuts |
| Hibernation | Background apps unload after N minutes |
| Settings panel | Theme, density, downloads, startup, tray, lock, performance |
| Quick search | `Ctrl+/` jump to any app |
| Session lock | Optional password lock (`Ctrl+Shift+L`) |
| Clear session | Wipe one app's login data from Settings |
| Link handling | Block pop-ups / open in system browser |
| System tray | Optional tray + close-to-tray |

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` … `Ctrl+9` | Switch to visible app by position |
| `Ctrl+Tab` / `Ctrl+PageDown` | Next app |
| `Ctrl+Shift+Tab` / `Ctrl+PageUp` | Previous app |
| `Ctrl+R` | Reload active |
| `Ctrl+Shift+D` | Focus mode |
| `Ctrl+Shift+M` | Mute |
| `Ctrl+Shift+H` | Hibernate background |
| `Ctrl+Shift+L` | Lock (if enabled) |
| `Ctrl+,` | Settings |
| `Ctrl+/` | Quick search |

Right-click a non-active app icon to hibernate it.

## Requirements

- Node.js 18+ (22 recommended)
- Linux Mint / Ubuntu-family for `.deb` packaging

## Develop

```bash
npm install
npm start
```

On some Linux setups Electron’s `chrome-sandbox` needs root permissions. `npm start` passes `--no-sandbox` for easy local development. For a stricter sandbox after install:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
npm run start:sandbox
```

## Package for Linux Mint

```bash
npm run make
```

Artifacts land in `out/make/` (`.deb`, `.zip`, optionally `.rpm`). Install the `.deb` on Mint with:

```bash
sudo apt install ./out/make/deb/x64/asperadock_*.deb
```

## Add / duplicate accounts

Edit `src/services.js`. Copy a service block and give it a unique `id` and `partition`, for example:

```js
{
  id: 'whatsapp-3',
  name: 'WhatsApp 3',
  group: 'Messaging',
  url: 'https://web.whatsapp.com',
  partition: 'persist:whatsapp-3',
  color: '#25D366',
  keepWarm: true, // optional: never auto-hibernate, keeps notifications live
}
```

Tunables in the same file: `HIBERNATE_AFTER_MS`, `MAX_WARM_VIEWS`, `SIDEBAR_WIDTH`, and `INTERNAL_HOSTS` (domains allowed to stay inside the dock).

## Tips for 16 GB machines

1. Open only the services you need for the current task
2. Right-click a warm (non-active) service in the sidebar to hibernate it immediately
3. Prefer hibernating messaging apps when not chatting — they are the heaviest

## Project name

- App name: **Aspera Dock**
- Package / repo: **asperadock**
