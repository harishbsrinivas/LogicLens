#!/usr/bin/env bash
# Rotating backups of a directory into a destination, keeping the newest N.
set -euo pipefail

usage() {
  echo "usage: $0 SOURCE DEST [KEEP]" >&2
  exit 2
}

[[ $# -ge 2 ]] || usage
src=$1
dest=$2
keep=${3:-7}

[[ -d $src ]] || { echo "no such directory: $src" >&2; exit 1; }
[[ $keep =~ ^[0-9]+$ && $keep -gt 0 ]] || { echo "KEEP must be a positive number" >&2; exit 2; }
mkdir -p "$dest"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$dest/backup-$stamp.tar.gz"
tmp=$(mktemp "$dest/.partial.XXXXXX")
trap 'rm -f "$tmp"' EXIT

tar -C "$(dirname "$src")" -czf "$tmp" "$(basename "$src")"
mv "$tmp" "$archive"
trap - EXIT
echo "wrote $archive"

# Delete all but the newest $keep archives. Names sort by time.
mapfile -t old < <(ls -1 "$dest"/backup-*.tar.gz | sort | head -n -"$keep")
for f in "${old[@]}"; do
  rm -- "$f"
  echo "removed $f"
done
