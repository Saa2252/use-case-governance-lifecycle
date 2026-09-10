#!/usr/bin/env bash
# Regenerate the lifecycle diagram PNG from its SVG source.
#
#   ./tools/make-assets.sh
#
# Needs Google Chrome.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME"; exit 1; }
mkdir -p "$ROOT/media"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
          --force-color-profile=srgb --force-device-scale-factor=2 \
          --window-size=1600,900 \
          --screenshot="$ROOT/media/00-lifecycle-diagram.png" \
          "file://$ROOT/assets/lifecycle-diagram.svg" >/dev/null 2>&1

echo "Done. media/00-lifecycle-diagram.png"
