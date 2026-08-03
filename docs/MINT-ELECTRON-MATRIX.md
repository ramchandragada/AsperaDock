# Electron / Mint smoke matrix (Phase 4)

Use this checklist on a **Linux Mint + Cinnamon** office PC after any Electron major bump.
Local installs only until every row is green.

| Check | How | Pass? |
|-------|-----|-------|
| Version title | Window title shows expected Hub version | |
| Tray | Quit / Show from tray; icon visible | |
| GPU off | Settings lean/low-memory or `--disable-gpu` still launches | |
| no-sandbox | Packaged `/usr/bin/asperadock` starts (company default) | |
| WhatsApp | Open chat, pin person, badge count | |
| Arattai | Open chat; link → Hub top-bar tab | |
| Gmail | Stay in inbox; outbound link → Hub tab / ask | |
| Zoho CRM / One | Login survives; deep link Hub tab | |
| Downloads | Save dialog does not freeze other apps | |
| Find in page | Ctrl+F bar visible above guest | |
| Updater | Help → Check for updates (stable feed) | |
| Hibernate / wake | Background app wakes on click without blank pane | |

## Status (2026-08-03)

| Electron | Result on this Mint/Wayland PC |
|----------|--------------------------------|
| **37.10.3** | Known good (ship this until Phase 4 re-tried) |
| **42.8.0** | **Failed** — Wayland fatal: `Connection reset by peer` / `Failed to shutdown` in `startup.log`. Reverted in v0.4.59. |

Do **not** bump Electron again without a full matrix pass on Mint Cinnamon (X11 and Wayland if used). Never ship an Electron bump the same day as navigation-policy changes without that pass.
