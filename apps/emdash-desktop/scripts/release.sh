#!/usr/bin/env bash
# Builds Emjosh from merged main and publishes it as a GitHub release of 2785/emjosh, where
# installed copies pick it up (src/main/host/updates/personal-update.ts).
#
#   pnpm run release            # next patch version (the first release is 0.1.0)
#   pnpm run release minor      # or: major, or an explicit version such as 1.0.0
set -euo pipefail
cd "$(dirname "$0")/.."

REPO='2785/emjosh'
APP='release/mac-arm64/Emjosh.app'
OUT='release/publish'
ZIP_NAME='Emjosh-mac-arm64.zip'
# Keep in sync with PERSONAL_MANIFEST_ASSET in src/main/host/updates/personal-update.ts.
MANIFEST_NAME='emjosh-update.json'

# A GITHUB_TOKEN in the environment would take precedence over the keyring login.
gh_() { env -u GITHUB_TOKEN gh "$@"; }
die() {
  echo "$*" >&2
  exit 1
}

bump="${1:-patch}"

[ -z "$(git status --porcelain)" ] || die 'The working tree has changes; release from a clean checkout.'
git fetch -q origin main --tags
commit="$(git rev-parse HEAD)"
[ "$commit" = "$(git rev-parse origin/main)" ] || die 'HEAD is not origin/main; release from merged main.'

latest="$(gh_ release view --repo "$REPO" --json tagName --jq .tagName 2>/dev/null | sed 's/^v//' || true)"
case "$bump" in
  [0-9]*.[0-9]*.[0-9]*) version="$bump" ;;
  patch | minor | major)
    if [ -z "$latest" ]; then
      version='0.1.0'
    else
      IFS=. read -r major minor patch <<<"$latest"
      case "$bump" in
        patch) version="$major.$minor.$((patch + 1))" ;;
        minor) version="$major.$((minor + 1)).0" ;;
        major) version="$((major + 1)).0.0" ;;
      esac
    fi
    ;;
  *) die "Unknown version bump '$bump': use patch, minor, major, or X.Y.Z." ;;
esac
git rev-parse -q --verify "refs/tags/v$version" >/dev/null && die "v$version already exists."
echo "Releasing Emjosh $version (${latest:+after $latest, }commit ${commit:0:9})"

EMJOSH_VERSION="$version" pnpm run package:personal

# Installed copies only accept updates signed by the identity they were signed with, so every
# release must use the same stable one.
codesign -dvv "$APP" 2>&1 | grep -q '^Authority=Apple Development: ' ||
  die 'Releases must be signed with an Apple Development identity (see the README).'
[ "$(plutil -extract CFBundleShortVersionString raw "$APP/Contents/Info.plist")" = "$version" ] ||
  die "The packaged app does not report version $version."

rm -rf "$OUT"
mkdir -p "$OUT"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/$ZIP_NAME"
cat >"$OUT/$MANIFEST_NAME" <<EOF
{
  "version": "$version",
  "commit": "$commit",
  "file": "$ZIP_NAME",
  "sha512": "$(openssl dgst -sha512 -binary "$OUT/$ZIP_NAME" | base64)",
  "size": $(stat -f %z "$OUT/$ZIP_NAME"),
  "releasedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

gh_ release create "v$version" "$OUT/$ZIP_NAME" "$OUT/$MANIFEST_NAME" \
  --repo "$REPO" --target "$commit" --title "Emjosh $version" --generate-notes
git fetch -q origin --tags
echo "Published https://github.com/$REPO/releases/tag/v$version"
