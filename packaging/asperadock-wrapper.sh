#!/bin/sh
# Safe Aspera Hub launcher for Linux Mint (XFCE / Cinnamon).
set -eu

BIN="/usr/lib/asperadock/asperadock"
UD="${XDG_CONFIG_HOME:-$HOME/.config}/Aspera Dock"
LOG="$UD/startup.log"

if [ ! -x "$BIN" ]; then
  echo "Aspera Hub binary missing: $BIN" >&2
  exit 1
fi

mkdir -p "$UD" 2>/dev/null || true
rm -f "$UD/SingletonLock" "$UD/SingletonCookie" 2>/dev/null || true
if [ -L "$UD/SingletonSocket" ] && [ ! -e "$UD/SingletonSocket" ]; then
  rm -f "$UD/SingletonSocket" 2>/dev/null || true
fi

{
  echo "==== $(date -Is) starting Aspera Hub ===="
  echo "user=$(id -un) display=${DISPLAY:-} xdg=${XDG_SESSION_TYPE:-} wayland=${WAYLAND_DISPLAY:-}"
  echo "bin=$BIN"
} >>"$LOG" 2>&1 || true

FLAGS="--no-sandbox --disable-gpu-sandbox --disable-gpu --disable-software-rasterizer --class=asperadock"

# From a terminal: show output so it does not look "stuck".
# From the menu/desktop: keep a log file.
if [ -t 1 ]; then
  echo "Starting Aspera Hub… (log: $LOG)"
  exec "$BIN" $FLAGS "$@" 2>>"$LOG"
else
  exec "$BIN" $FLAGS "$@" >>"$LOG" 2>&1
fi
