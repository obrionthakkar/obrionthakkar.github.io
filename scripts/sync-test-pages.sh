#!/usr/bin/env bash
# Copy static site files into test/ for GitHub Pages at www.devangthakkar.com/test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/test"

mkdir -p "$DEST"
cp "$ROOT/index1.html" "$DEST/index.html"
cp "$ROOT/styles.css" "$ROOT/script.js" "$ROOT/auth.js" "$ROOT/events.js" "$ROOT/rsvp.js" "$DEST/"
rsync -a --delete "$ROOT/assets/" "$DEST/assets/"

echo "Synced to $DEST"
echo "Copy the test/ folder into your devangthakkar.com GitHub Pages repo, then push."
