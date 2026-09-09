#!/usr/bin/env bash
# Regenerate the image assets from the app itself, so the screenshots can
# never drift from what the app actually does.
#
#   ./tools/make-assets.sh
#
# Needs Google Chrome and python3 (Pillow, for the animated GIF).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/media"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=4173
BASE="http://localhost:$PORT"

[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME"; exit 1; }
mkdir -p "$OUT" "$OUT/frames"

# Serve the repo; JS deep links do not work over file://
python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1

shot () { # shot <url> <outfile> <w> <h>
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
            --force-color-profile=srgb --force-device-scale-factor=2 \
            --virtual-time-budget=3000 \
            --window-size="$3,$4" --screenshot="$2" "$1" >/dev/null 2>&1
}

echo "→ lifecycle diagram"
shot "$BASE/assets/lifecycle-diagram.svg" "$OUT/00-lifecycle-diagram.png" 1600 900

echo "→ summary cards"
for i in 0 1 2 3 4 5 6 7 8; do
  shot "$BASE/media/cards.html#card-$i" "$OUT/card-$(printf %02d "$i").png" 1080 1080
done

echo "→ click-through frames"
n=0
for step in \
  "record=firstpass#gate-1" \
  "record=firstpass#gate-2" \
  "record=firstpass#gate-3" \
  "record=approved#gate-3" \
  "record=approved#gate-4" \
  "record=approved#gate-5" \
  "record=approved#gate-6" ; do
  shot "$BASE/index.html?$step" "$OUT/frames/frame-$(printf %02d "$n").png" 1400 900
  n=$((n+1))
done

echo "→ animated GIF"
python3 "$ROOT/tools/make-gif.py" "$OUT/frames" "$OUT/walkthrough.gif"

echo "Done. Assets in $OUT"
