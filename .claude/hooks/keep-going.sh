#!/usr/bin/env bash
# keep-going.sh — per-repo Stop hook for Bioluminescent Sea.
#
# Blocks stop while EITHER docs/PRODUCTION.md or .autopilot/QUEUE.md
# still has open checkboxes. PRODUCTION.md is the production-cycle
# queue; .autopilot/QUEUE.md is the autopilot loop's queue (the
# self-enforcing /loop reads it). Both must be empty before the
# session may end.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

QUEUE_FILES=(
  "$REPO/docs/PRODUCTION.md"
  "$REPO/.autopilot/QUEUE.md"
)

# `grep -c` exits non-zero on zero matches; under `set -euo pipefail`
# `|| echo 0` runs in addition to grep's "0" and produces "0\n0".
# Use `|| true` and clamp via parameter expansion.
count_open() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo 0
    return
  fi
  local n
  n=$(grep -c '^\- \[ \]' "$file" 2>/dev/null || true)
  echo "${n:-0}"
}

TOTAL_OPEN=0
declare -a SUMMARY_LINES
for file in "${QUEUE_FILES[@]}"; do
  n=$(count_open "$file")
  if [ "$n" != "0" ]; then
    TOTAL_OPEN=$((TOTAL_OPEN + n))
    SUMMARY_LINES+=("$n open in $(basename "$(dirname "$file")")/$(basename "$file")")
  fi
done

if [ "$TOTAL_OPEN" = "0" ]; then
  exit 0
fi

TMP=$(mktemp -t keep-going.XXXXXX)
trap 'rm -f "$TMP"' EXIT

{
  echo "Stop blocked: ${TOTAL_OPEN} checkboxes still open for Bioluminescent Sea."
  for line in "${SUMMARY_LINES[@]}"; do
    echo "  - $line"
  done
  echo ""
  for file in "${QUEUE_FILES[@]}"; do
    n=$(count_open "$file")
    if [ "$n" != "0" ]; then
      rel="${file#$REPO/}"
      echo "Open items in $rel:"
      grep '^\- \[ \]' "$file" | head -5
      echo ""
    fi
  done
  echo "Pick one and execute. Do not ask what to do."
} > "$TMP"

python3 - "$TMP" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    reason = f.read()
print(json.dumps({"decision": "block", "reason": reason}))
PY
