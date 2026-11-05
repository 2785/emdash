#!/usr/bin/env bash
# Builds and packages the personal flavor (Emjosh) into release/mac-arm64.
set -euo pipefail
cd "$(dirname "$0")/.."

node ../../tooling/scripts/ensure-packages-built.mjs
# out/ is shared with other build flows (e.g. Nx), so start clean: stale chunks or a
# non-personal main entry would otherwise end up in the package.
rm -rf out
VITE_BUILD=personal pnpm exec electron-vite build

# Every bundle must carry the personal flavor, or the app silently runs as stock Emdash.
missing=$(grep -rL --include='*.js' '"VITE_BUILD": "personal"' out/main/index.js out/main/chunks out/renderer/assets |
  xargs grep -l '__vite_import_meta_env__ = {' 2>/dev/null || true)
if [ -n "$missing" ]; then
  echo "Built without VITE_BUILD=personal:" >&2
  echo "$missing" >&2
  exit 1
fi

pnpm exec electron-builder --mac --publish never --config electron-builder.personal.config.ts

# Prefer an Apple Development identity (free with an Apple ID): its Team ID gives keychain items
# a stable partition, so they stay readable across rebuilds. The self-signed fallback keeps the
# same code requirement, but macOS ties its keychain partition to each build's hash, so expect
# one keychain prompt per rebuild with it.
identity="${EMJOSH_SIGNING_IDENTITY:-$(security find-identity -v -p codesigning |
  awk '/"Apple Development: / { print $2; exit }')}"
if [ -z "$identity" ]; then
  identity="$(bash scripts/setup-emjosh-signing.sh)"
fi
echo "Signing with $(security find-identity -p codesigning | awk -v h="$identity" '$2 == h { $1 = $2 = ""; print; exit }')"
codesign --force --deep --sign "$identity" release/mac-arm64/Emjosh.app
codesign --verify --deep --strict release/mac-arm64/Emjosh.app
