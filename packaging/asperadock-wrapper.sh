#!/bin/sh
# Safe Aspera Hub launcher for Linux Mint (XFCE / Cinnamon).
# - Clears stale single-instance locks from previous GPU crashes
# - Always disables GPU + sandbox (Electron otherwise FATAL-exits on many PCs)
set -eu

BIN="/usr/lib/asperadock/asperadock"
UD="${XDG_CONFIG_HOME:-$HOME/.config}/Aspera Dock"
LOG="$UD/startup.log"

if [ ! -x "$BIN" ]; then
  echo "Aspera Hub binary missing: $BIN" >&2
  if command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Aspera Hub" --text="Aspera Hub is not installed correctly.\nMissing: $BIN\n\nReinstall asperadock_0.2.82_amd64.deb" 2>/dev/null || true
  fi
  exit 1
fi

mkdir -p "$UD" 2>/dev/null || true

# Drop stale Electron singleton locks left after a crash (looks like "won't start").
rm -f "$UD/SingletonLock" "$UD/SingletonCookie" 2>/dev/null || true
# SingletonSocket is often a symlink into /tmp — remove if dangling.
if [ -L "$UD/SingletonSocket" ] && [ ! -e "$UD/SingletonSocket" ]; then
  rm -f "$UD/SingletonSocket" 2>/dev/null || true
fi

{
  echo "==== $(date -Is) starting Aspera Hub ===="
  echo "user=$(id -un) display=${DISPLAY:-} xdg=${XDG_SESSION_TYPE:-}"
  echo "bin=$BIN"
  ls -la "$BIN" 2>&1 || true
} >>"$LOG" 2>&1 || true

# Important: flags must be before user args. Mint GPUs + chrome-sandbox often
# cause an instant exit with no window.
exec "$BIN" \
  --no-sandbox \
  --disable-gpu-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --class=asperadock \
  "$@" >>"$LOG" 2>&1
