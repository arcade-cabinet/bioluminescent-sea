#!/usr/bin/env bash
# keep-going.sh — per-repo Stop hook for Bioluminescent Sea.
#
# Blocks stop while docs/PRODUCTION.md still has open checkboxes.
# PRODUCTION.md supersedes HANDOFF-PRD.md as the 1.0 readiness queue;
# HANDOFF-PRD is kept as a frozen extraction artifact and no longer
# drives the autopilot loop.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

QUEUE_FILE="$REPO/docs/PRODUCTION.md"
if [ ! -f "$QUEUE_FILE" ]; then
  # Pre-foundation fallback: honor the old HANDOFF-PRD for historical
  # trees that haven't migrated yet.
  QUEUE_FILE="$REPO/HANDOFF-PRD.md"
fi

OPEN_BOXES=0
if [ -f "$QUEUE_FILE" ]; then
  OPEN_BOXES=$(grep -c '^\- \[ \]' "$QUEUE_FILE" 2>/dev/null || echo 0)
fi

if [ "$OPEN_BOXES" = "0" ]; then
  exit 0
fi

QUEUE_NAME="$(basename "$QUEUE_FILE")"

TMP=$(mktemp -t keep-going.XXXXXX)
trap 'rm -f "$TMP"' EXIT

{
  echo "Stop blocked: $OPEN_BOXES $QUEUE_NAME checkboxes still open for Bioluminescent Sea."
  echo ""
  echo "Next open items:"
  grep '^\- \[ \]' "$QUEUE_FILE" | head -10
  echo ""
  echo "Pick one and execute. Do not ask what to do."
} > "$TMP"

python3 - "$TMP" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    reason = f.read()
print(json.dumps({"decision": "block", "reason": reason}))
PY
