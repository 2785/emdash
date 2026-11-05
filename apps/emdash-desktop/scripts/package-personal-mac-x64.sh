#!/usr/bin/env bash
# Builds Emjosh for Intel Macs into release/mac-x64, on any Mac and without Rosetta. Works in a
# scratch copy so this checkout's node_modules keep the host's native modules. JavaScript builds
# natively; the x64 native modules come prebuilt: node-pty ships them, better-sqlite3 publishes
# Electron builds, and @parcel/watcher has a per-platform package.
#
# Builds the checked-out commit plus uncommitted changes to tracked files (not untracked ones).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="$PWD/release/mac-x64"
WORK="${TMPDIR:-/tmp}/emjosh-mac-x64"

# Same version rules as scripts/package-personal.sh; the scratch copy has no git metadata.
EMJOSH_VERSION="${EMJOSH_VERSION:-$(bash scripts/emjosh-version.sh)}"
export EMJOSH_VERSION="${EMJOSH_VERSION:-0.0.1}"

rm -rf "$WORK" "$OUT"
mkdir -p "$WORK" "$OUT"
root="$(git rev-parse --show-toplevel)"
# `git stash create` snapshots tracked changes as a commit without touching the stash list.
tree="$(git -C "$root" stash create)"
git -C "$root" archive --format=tar "${tree:-HEAD}" | tar -xf - -C "$WORK"

cd "$WORK"
# Also install the x64 variants of platform-specific packages (@parcel/watcher's binary).
cat >>pnpm-workspace.yaml <<'YAML'
supportedArchitectures:
  os: [current]
  cpu: [current, x64]
YAML
# Install scripts would build the native modules for this Mac's architecture.
pnpm install --frozen-lockfile --ignore-scripts

cd apps/emdash-desktop
module_dir() { node -p "require('path').dirname(require.resolve('$1/package.json'))"; }
electron_version="$(node -p "require('electron/package.json').version")"
(cd "$(module_dir better-sqlite3)" &&
  npx --yes prebuild-install --runtime electron --target "$electron_version" --arch x64 --platform darwin)
# node-pty loads its bundled prebuild; npm tarballs lose the helper's executable bit.
chmod 755 "$(module_dir node-pty)/prebuilds/darwin-x64/spawn-helper"

EMJOSH_MAC_ARCH=x64 bash scripts/package-personal.sh

# Every native module in the package must be x64.
unpacked='release/mac/Emjosh.app/Contents/Resources/app.asar.unpacked/node_modules'
for addon in better-sqlite3/build/Release/better_sqlite3.node \
  node-pty/prebuilds/darwin-x64/pty.node \
  @parcel/watcher-darwin-x64/watcher.node; do
  lipo -archs "$unpacked/$addon" | grep -qx x86_64 || {
    echo "Not an x64 binary: $addon ($(lipo -archs "$unpacked/$addon" 2>&1))" >&2
    exit 1
  }
done
lipo -archs release/mac/Emjosh.app/Contents/MacOS/Emjosh | grep -qx x86_64

ditto release/mac/Emjosh.app "$OUT/Emjosh.app"
cd /
rm -rf "$WORK"
echo "Built $OUT/Emjosh.app"
