#!/usr/bin/env bash
# Seeds Emjosh's data dir with a snapshot of Emdash's. Safe while Emdash is open; Emjosh must be
# closed. Refuses to overwrite existing Emjosh data unless --force is given.
set -euo pipefail

SRC="$HOME/Library/Application Support/emdash"
DST="$HOME/Library/Application Support/emjosh"
EMJOSH_BIN='/Applications/Emjosh.app/Contents/MacOS/Emjosh'

if ps -axo command= | awk -v bin="$EMJOSH_BIN" '$0 == bin || index($0, bin " ") == 1 { f = 1 } END { exit !f }'; then
  echo 'Emjosh is running; quit it first.' >&2
  exit 1
fi
if [ -e "$DST" ] && [ "${1:-}" != '--force' ]; then
  echo "$DST already exists; pass --force to replace it." >&2
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

# Active session intents are resumed at boot; suspend them so Emjosh doesn't start second copies
# of agents still running in Emdash. They resume when opened.
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
