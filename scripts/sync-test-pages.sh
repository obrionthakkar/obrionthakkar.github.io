#!/usr/bin/env bash
# Copy static site files into test/ for staging at devangthakkar.com/test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/test"

mkdir -p "$DEST"
cp "$ROOT/index.html" "$DEST/index.html"
cp "$ROOT/dress-code-mehendi.html" "$DEST/"
cp "$ROOT/styles.css" "$ROOT/script.js" "$ROOT/auth.js" "$ROOT/events.js" "$ROOT/rsvp.js" "$DEST/"
rsync -a --delete "$ROOT/assets/" "$DEST/assets/"

echo "Synced to $DEST"
echo "Staging copy updated. Production is index.html at repo root (devangandcarrington.com)."
