#!/usr/bin/env bash
# Replaces the Emdash Josh Dev data dir with a snapshot of the shared Emdash data dir.
# Safe to run while Emdash / Emdash Josh is open; Emdash Josh Dev must be closed.
set -euo pipefail

SRC="$HOME/Library/Application Support/emdash"
DST="$HOME/Library/Application Support/emdash-josh-dev"

if pgrep -f 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron' >/dev/null; then
  echo 'Emdash Josh Dev (pnpm run dev) is running; stop it first.' >&2
  exit 1
fi

rm -rf "$DST"
mkdir -p "$DST"

# Live SQLite files are snapshotted with the online backup API; everything else is copied.
# Caches, logs and Chromium's process locks are left out.
rsync -a \
  --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' \
  --exclude 'Singleton*' --exclude 'logs' \
  --exclude 'Cache' --exclude 'Code Cache' --exclude 'GPUCache' \
  --exclude 'DawnGraphiteCache' --exclude 'DawnWebGPUCache' \
  "$SRC/" "$DST/"
for db in "$SRC"/*.db; do
  sqlite3 "$db" ".backup '$DST/$(basename "$db")'"
done

# Active session intents are resumed at boot; suspend them so the dev app doesn't start second
# copies of agents that are running in the source app. They resume when opened.
for intents in "$DST"/*-session-intents.json; do
  [ -f "$intents" ] || continue
  python3 - "$intents" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    intents = json.load(f)
for intent in intents.values():
    if intent.get('status') == 'active':
        intent['status'] = 'suspended'
        intent['suspendedCause'] = 'seeded-from-emdash'
with open(path, 'w') as f:
    json.dump(intents, f, indent=2)
PY
done

echo "Seeded $DST from $SRC"
