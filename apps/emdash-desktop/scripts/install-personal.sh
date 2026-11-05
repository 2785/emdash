#!/usr/bin/env bash
# Builds Emjosh and stages it for its Reload button. When Emjosh isn't running, installs it
# into /Applications right away instead.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME='Emjosh'
APP="/Applications/$APP_NAME.app"
# Keep in sync with PERSONAL_STAGE_DIR in src/main/host/updates/personal-reload.ts.
STAGE="$HOME/Library/Caches/emjosh/staged"
PERSONAL_BIN="$APP/Contents/MacOS/$APP_NAME"

# Shells spawned by Electron apps can inherit ELECTRON_RUN_AS_NODE, which would start the app
# as plain Node.
unset ELECTRON_RUN_AS_NODE

# Matches the main binary in `ps` output; osascript and pgrep can miss processes here.
is_running() {
  ps -axo command= | awk -v bin="$1" '$0 == bin || index($0, bin " ") == 1 { found = 1 } END { exit !found }'
}

pnpm run package:personal

# The Reload button watches build.json, so it is written last, once the bundle is complete.
rm -rf "$STAGE"
mkdir -p "$STAGE"
ditto "release/mac-arm64/$APP_NAME.app" "$STAGE/$APP_NAME.app"
commit="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . || echo '-dirty')"
printf '{"builtAt":"%s","commit":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$commit" >"$STAGE/build.json"

if is_running "$PERSONAL_BIN"; then
  echo "Staged $commit. Click Reload in $APP_NAME to switch to it."
  exit 0
fi

rm -rf "$APP"
ditto "$STAGE/$APP_NAME.app" "$APP"
rm -rf "$STAGE"
echo "Installed $commit to $APP"
open "$APP"
