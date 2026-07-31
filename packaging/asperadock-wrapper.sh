#!/bin/sh
# Aspera Hub Linux launcher — always starts even on GPUs that crash Electron.
# Deb installs this as /usr/bin/asperadock (wrapper around the real binary).
set -eu
BIN="/usr/lib/asperadock/asperadock"
if [ ! -x "$BIN" ]; then
  echo "Aspera Hub binary missing: $BIN" >&2
  exit 1
fi
# Drop stale single-instance locks from a previous GPU crash (dead PID).
UD="${XDG_CONFIG_HOME:-$HOME/.config}/Aspera Dock"
if [ -L "$UD/SingletonLock" ] || [ -e "$UD/SingletonLock" ]; then
  # Electron usually clears dead locks; if a lock blocks start, user can remove it.
  :
fi
exec "$BIN" --disable-gpu-sandbox --disable-gpu "$@"
