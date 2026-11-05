#!/usr/bin/env bash
# Builds the personal flavor and replaces /Applications/Emdash Josh.app with it.
# Run from inside Emdash Josh, the swap is deferred until you quit the app.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME='Emdash Josh'
APP="/Applications/$APP_NAME.app"
STAGE="${TMPDIR:-/tmp}/emdash-josh-install"
# Process checks match the main binary path in `ps` output: osascript and pgrep can both miss
# processes from detached sessions, and a missed check must never read as "not running" before
# the app bundle is deleted.
PERSONAL_BIN="$APP/Contents/MacOS/$APP_NAME"
STABLE_BIN='/Applications/Emdash.app/Contents/MacOS/Emdash'

# Shells spawned by Electron apps can inherit ELECTRON_RUN_AS_NODE, which would start the app
# as plain Node, so strip it from everything that launches apps.
unset ELECTRON_RUN_AS_NODE

pids_of() {
  ps -axo pid=,command= | awk -v bin="$1" '{
    pid = $1; sub(/^ *[0-9]+ /, "")
    if ($0 == bin || index($0, bin " ") == 1) print pid
  }'
}
is_running() { [ -n "$(pids_of "$1")" ]; }
inside_personal_app() {
  local pid=$$ personal
  personal=" $(pids_of "$PERSONAL_BIN" | tr '\n' ' ') "
  [ "$personal" = '  ' ] && return 1
  while [ -n "$pid" ] && [ "$pid" -gt 1 ]; do
    [[ "$personal" == *" $pid "* ]] && return 0
    pid=$(ps -o ppid= -p "$pid" | tr -d ' ')
  done
  return 1
}

pnpm run package:personal

rm -rf "$STAGE"
mkdir -p "$STAGE"
ditto "release/mac-arm64/$APP_NAME.app" "$STAGE/$APP_NAME.app"
codesign --verify --deep --strict "$STAGE/$APP_NAME.app"

{
  echo '#!/usr/bin/env bash'
  echo 'set -euo pipefail'
  echo 'unset ELECTRON_RUN_AS_NODE'
  declare -f pids_of is_running
} >"$STAGE/swap.sh"
cat >>"$STAGE/swap.sh" <<EOF
while is_running '$PERSONAL_BIN'; do sleep 1; done
sleep 1
rm -rf '$APP'
ditto '$STAGE/$APP_NAME.app' '$APP'
codesign --verify --deep --strict '$APP'
echo "\$(date) installed $APP"
# Both apps share one data dir and single-instance lock, so only one can run at a time.
if is_running '$STABLE_BIN'; then
  echo "\$(date) Emdash is running; quit it, then open $APP_NAME"
else
  open '$APP'
fi
EOF
chmod +x "$STAGE/swap.sh"

if is_running "$PERSONAL_BIN"; then
  if inside_personal_app; then
    # Quitting the app kills this shell, so hand the swap to a process outside its session.
    python3 - "$STAGE/swap.sh" "$STAGE/swap.log" <<'PY'
import os, subprocess, sys
script, log = sys.argv[1], sys.argv[2]
if os.fork() == 0:
    os.setsid()
    with open(log, 'w') as out:
        subprocess.Popen(['/bin/bash', script], stdin=subprocess.DEVNULL, stdout=out,
                         stderr=out, start_new_session=True)
    os._exit(0)
PY
    echo "Staged. Quit $APP_NAME (Cmd+Q) to finish installing; progress: $STAGE/swap.log"
    exit 0
  fi
  osascript -e "tell application id \"com.emdash.personal\" to quit"
fi

bash "$STAGE/swap.sh"
