#!/bin/sh
set -eu
echo "=== version ==="
dpkg -s asperadock 2>/dev/null | grep -E 'Version|Status' || true
echo "=== launcher ==="
file /usr/bin/asperadock || true
head -5 /usr/bin/asperadock || true
echo "=== binary ==="
file /usr/lib/asperadock/asperadock || true
echo "=== processes ==="
ps aux | grep -i '[a]speradock' || echo none
echo "=== locks ==="
ls -la "${XDG_CONFIG_HOME:-$HOME/.config}/Aspera Dock"/Singleton* 2>/dev/null || echo none
echo "=== display ==="
echo "DISPLAY=$DISPLAY XDG_SESSION_TYPE=$XDG_SESSION_TYPE"
echo "=== startup.log (last 80 lines) ==="
tail -80 "${XDG_CONFIG_HOME:-$HOME/.config}/Aspera Dock/startup.log" 2>/dev/null || echo "no log yet"
