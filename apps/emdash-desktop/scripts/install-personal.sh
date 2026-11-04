#!/usr/bin/env bash
# Builds the personal flavor and replaces /Applications/Emdash Josh.app with it.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME='Emdash Josh'
PERSONAL_ID='com.emdash.personal'
STABLE_ID='com.emdash.stable'

# Shells spawned by Electron apps can inherit ELECTRON_RUN_AS_NODE, which would start the app
# as plain Node, so strip it from everything that talks to or launches apps.
is_running() {
  [ "$(env -u ELECTRON_RUN_AS_NODE osascript -e "application id \"$1\" is running")" = true ]
}

pnpm run package:personal

if is_running "$PERSONAL_ID"; then
  env -u ELECTRON_RUN_AS_NODE osascript -e "tell application id \"$PERSONAL_ID\" to quit"
  while is_running "$PERSONAL_ID"; do sleep 0.5; done
fi

rm -rf "/Applications/$APP_NAME.app"
ditto "release/mac-arm64/$APP_NAME.app" "/Applications/$APP_NAME.app"

# Both apps share one data dir and single-instance lock, so only one can run at a time.
if is_running "$STABLE_ID"; then
  echo "Installed /Applications/$APP_NAME.app. Quit Emdash, then open $APP_NAME."
  exit 0
fi
env -u ELECTRON_RUN_AS_NODE open "/Applications/$APP_NAME.app"
