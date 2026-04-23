#!/usr/bin/env bash
# keep-going.sh — per-repo Stop hook for Bioluminescent Sea.
# Blocks stop while HANDOFF-PRD.md still has open checkboxes.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

OPEN_BOXES=0
if [ -f "$REPO/HANDOFF-PRD.md" ]; then
  OPEN_BOXES=$(grep -c '^\- \[ \]' "$REPO/HANDOFF-PRD.md" 2>/dev/null || echo 0)
fi

if [ "$OPEN_BOXES" = "0" ]; then
  exit 0
fi

TMP=$(mktemp -t keep-going.XXXXXX)
trap 'rm -f "$TMP"' EXIT

{
  echo "Stop blocked: $OPEN_BOXES HANDOFF-PRD checkboxes still open for Bioluminescent Sea."
  echo ""
  echo "Next open items:"
  grep '^\- \[ \]' "$REPO/HANDOFF-PRD.md" | head -10
  echo ""
  echo "Pick one and execute. Do not ask what to do."
} > "$TMP"

python3 - "$TMP" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    reason = f.read()
print(json.dumps({"decision": "block", "reason": reason}))
PY
