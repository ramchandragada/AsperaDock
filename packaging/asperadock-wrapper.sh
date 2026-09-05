#!/bin/sh
# Safe Aspera Hub launcher for Linux Mint (XFCE / Cinnamon), Zorin OS
# (GNOME / Lite XFCE), and Q4OS Andromeda (Plasma / Trinity). Always uses
# --no-sandbox --disable-gpu* because Electron's GPU/sandbox often FATAL-exits
# on company PCs. Desktop-specific lean defaults and maximize-on-launch live
# in the app — see docs/MINT-ELECTRON-MATRIX.md.
set -eu

BIN="/usr/lib/asperadock/asperadock"
UD="${XDG_CONFIG_HOME:-$HOME/.config}/Aspera Dock"
LOG="$UD/startup.log"

if [ ! -x "$BIN" ]; then
  echo "Aspera Hub binary missing: $BIN" >&2
  exit 1
fi

mkdir -p "$UD" 2>/dev/null || true

# Only clear Chromium singleton files left by a crashed/dead session.
# Never delete a live lock — that allows a second Hub window on the same
# profile and can sign WhatsApp / Arattai out.
clear_stale_singleton() {
  lock="$UD/SingletonLock"
  cookie="$UD/SingletonCookie"
  socket="$UD/SingletonSocket"

  # Live lock owner → leave every singleton file alone (dangling socket must
  # not wipe a live SingletonLock).
  if [ -L "$lock" ]; then
    target=$(readlink "$lock" 2>/dev/null || true)
    pid=${target##*-}
    case "$pid" in
      ''|*[!0-9]*) ;;
      *)
        if kill -0 "$pid" 2>/dev/null; then
          return 0
        fi
        ;;
    esac
  fi

  stale=0
  if [ -L "$lock" ]; then
    # Lock present but owner is dead (or pid unreadable) — clean.
    stale=1
  fi
  if [ -L "$socket" ] && [ ! -e "$socket" ]; then
    stale=1
  fi

  if [ "$stale" -eq 1 ]; then
    rm -f "$lock" "$cookie" "$socket" 2>/dev/null || true
  fi
}
clear_stale_singleton

{
  echo "==== $(date -Is) starting Aspera Hub ===="
  echo "user=$(id -un) display=${DISPLAY:-} xdg=${XDG_SESSION_TYPE:-} wayland=${WAYLAND_DISPLAY:-}"
  echo "bin=$BIN"
} >>"$LOG" 2>&1 || true

FLAGS="--no-sandbox --disable-gpu-sandbox --disable-gpu --disable-software-rasterizer --class=asperadock"

# Mint Wayland + newer Chromium: prefer X11 backend (avoids fatal Wayland reset).
# Harmless on pure X11 sessions.
case "${XDG_SESSION_TYPE:-}:${WAYLAND_DISPLAY:-}" in
  wayland:*|*:wayland*)
    FLAGS="$FLAGS --ozone-platform=x11"
    export ELECTRON_OZONE_PLATFORM_HINT=x11
    ;;
esac

# From a terminal: show output so it does not look "stuck".
# From the menu/desktop: keep a log file.
if [ -t 1 ]; then
  echo "Starting Aspera Hub… (log: $LOG)"
  exec "$BIN" $FLAGS "$@" 2>>"$LOG"
else
  exec "$BIN" $FLAGS "$@" >>"$LOG" 2>&1
fi
