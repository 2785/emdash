#!/usr/bin/env bash
# Creates a self-signed code signing identity in the login keychain (once) and prints its hash.
# Builds signed with it keep a stable code identity, so macOS remembers keychain and privacy
# approvals across rebuilds; ad-hoc signatures change with every build.
set -euo pipefail

NAME='Emjosh Local Signing'
find_identity() {
  security find-identity -p codesigning 2>/dev/null | awk -v n="\"$NAME\"" 'index($0, n) { print $2; exit }'
}

hash="$(find_identity)"
if [ -z "$hash" ]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  cat >"$tmp/cert.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
CNF
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$tmp/cert.cnf" \
    -keyout "$tmp/key.pem" -out "$tmp/cert.pem" 2>/dev/null
  openssl pkcs12 -export -legacy -name "$NAME" -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
    -out "$tmp/id.p12" -passout pass:emjosh
  # -T lets codesign use the key without a keychain prompt.
  security import "$tmp/id.p12" -k "$HOME/Library/Keychains/login.keychain-db" -P emjosh \
    -T /usr/bin/codesign >/dev/null
  hash="$(find_identity)"
fi
echo "$hash"
