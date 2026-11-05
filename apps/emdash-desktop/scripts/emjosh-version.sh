#!/usr/bin/env bash
# Prints the latest Emjosh release version (from `emjosh-vX.Y.Z` tags on origin), or nothing
# when there is none or origin is unreachable. Only origin's tags count: a checkout may also
# hold upstream Emdash's `vX.Y.Z` tags.
set -uo pipefail
git ls-remote --tags --refs origin 'refs/tags/emjosh-v*' 2>/dev/null |
  sed -nE 's#.*refs/tags/emjosh-v([0-9]+\.[0-9]+\.[0-9]+)$#\1#p' |
  sort -t. -k1,1n -k2,2n -k3,3n |
  tail -1
