# Electron / Mint + Ubuntu smoke matrix

Use this checklist on **Linux Mint XFCE**, **Linux Mint Cinnamon**, and **Ubuntu** after Electron bumps or Hub releases that touch guests, overlays, or downloads.

Local installs only until every row is green.

| Check | How | XFCE | Cinnamon | Ubuntu |
|-------|-----|------|----------|--------|
| Version title | Window title shows expected Hub version | | | |
| Launch (GPU off) | Packaged `/usr/bin/asperadock` starts; wrapper uses `--disable-gpu` | | | |
| no-sandbox | Company default launcher starts without chrome-sandbox | | | |
| Tray | Quit / Show from tray; icon visible (StatusNotifier) | | | |
| Opaque menus | App menu + chrome menu paint solid (not black) on XFCE | | | |
| Floating Find | Ctrl+F popup above guest; type immediately; page does **not** jump | | | |
| Downloads | Save once; no false “file exists”; dialog not behind Hub | | | |
| PDF preview | Open PDF in busy group chat; loads without long jank | | | |
| Tab retention | Fill Zoho CRM form → switch WhatsApp → return → drafts kept | | | |
| Reload button | Top-bar Reload refreshes active tab; QR/login not hard-reloaded | | | |
| WhatsApp | Open chat, pin person, badge count | | | |
| Arattai | Open chat; link → Hub top-bar tab | | | |
| Gmail | Stay in inbox; outbound link → Hub tab / ask | | | |
| Zoho CRM / One | Login survives; deep link Hub tab | | | |
| Hibernate / wake | Idle unload after timer; warm apps switch without blank pane | | | |
| Alt-tab blank | Leave Hub 30+ min, return — guest repaints (not permanently blank) | | | |
| Updater | Help → Check for updates (stable feed) | | | |

## Desktop notes

| Desktop | Overlay style | Notes |
|---------|---------------|--------|
| **Mint XFCE** | Opaque floats (`linuxUsesOpaqueOverlays`) | Weak/no compositor — transparent windows go black. Park warm guests off-screen (never `setVisible(false)`). |
| **Mint Cinnamon** | Transparent floats OK | Compositor on. Same park/keepWarm paths. |
| **Ubuntu GNOME** | Transparent floats OK | Prefer X11 (`--ozone-platform=x11`) when session is Wayland. |

## Electron status

| Electron | Result |
|----------|--------|
| **37.10.3** | Known good — ship this until matrix re-pass |
| **42.x** | **Failed** on Mint/Wayland (`Connection reset by peer`). Do not bump without full matrix. |

## Packaged Linux flags (always)

Wrapper (`packaging/asperadock-wrapper.sh`) and early `main.js` switches:

- `--no-sandbox`
- `--disable-gpu` / `--disable-gpu-sandbox`
- `--ozone-platform=x11` when Wayland is detected

Do **not** bump Electron the same day as navigation-policy or guest-lifecycle changes without a Mint XFCE + Cinnamon pass.
