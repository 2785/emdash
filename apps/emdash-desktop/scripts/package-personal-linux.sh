#!/usr/bin/env bash
# Builds the Emjosh Linux x64 AppImage into release/linux-x64, in a Linux container of the
# host's architecture (scripts/linux-container-build.sh cross-builds for x64; nothing runs
# emulated).
#
# Builds the checked-out commit plus uncommitted changes to tracked files (not untracked ones).
# Needs Docker, by default a Colima profile created once with:
#   colima start -p emjosh-linux --vm-type vz
set -euo pipefail
cd "$(dirname "$0")/.."

CONTEXT="${EMJOSH_LINUX_DOCKER_CONTEXT:-colima-emjosh-linux}"
# Debian 11 (glibc 2.31): binaries built here also run on older distributions.
IMAGE='node:24-bullseye'
OUT='release/linux-x64'

# Same version rules as scripts/package-personal.sh.
EMJOSH_VERSION="${EMJOSH_VERSION:-$(bash scripts/emjosh-version.sh)}"
export EMJOSH_VERSION="${EMJOSH_VERSION:-0.0.1}"

docker --context "$CONTEXT" info >/dev/null 2>&1 || {
  echo "Docker context '$CONTEXT' is not running (colima start -p emjosh-linux)." >&2
  exit 1
}

rm -rf "$OUT"
mkdir -p "$OUT"

# `git stash create` snapshots tracked changes as a commit without touching the stash list.
root="$(git rev-parse --show-toplevel)"
tree="$(git -C "$root" stash create)"
tree="${tree:-HEAD}"

# The Docker host's own architecture, so nothing runs emulated.
platform="linux/$(docker --context "$CONTEXT" version --format '{{.Server.Arch}}')"

git -C "$root" archive --format=tar "$tree" |
  docker --context "$CONTEXT" run --rm -i --platform "$platform" \
    -e EMJOSH_VERSION \
    -v emjosh-linux-pnpm-store:/pnpm-store \
    -v "$PWD/scripts/linux-container-build.sh:/build.sh:ro" \
    -v "$PWD/$OUT:/out" \
    "$IMAGE" bash -c 'mkdir /src && tar -xf - -C /src && bash /build.sh && chown -R '"$(id -u):$(id -g)"' /out'

ls -lh "$OUT"
