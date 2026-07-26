#!/usr/bin/env bash
# Prefer the installed package. Fall back to a local npm start only for developers.
set -euo pipefail

if [[ -x /usr/bin/asperadock ]]; then
  exec /usr/bin/asperadock "$@"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
exec npm start -- "$@"
