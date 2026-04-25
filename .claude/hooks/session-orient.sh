#!/usr/bin/env bash
# session-orient.sh — per-repo SessionStart hook for Bioluminescent Sea.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

TMP=$(mktemp -t orient.XXXXXX)
trap 'rm -f "$TMP"' EXIT

QUEUE_FILE="$REPO/docs/PRODUCTION.md"

{
  echo "# Bioluminescent Sea — Autopilot Session Orient"
  echo ""
  echo "Repo: $REPO"
  echo ""
  if [ -f "$QUEUE_FILE" ]; then
    # See pat-on-back-trap.sh: grep -c on zero matches needs `|| true`
    # (not `|| echo 0`) under set -euo pipefail or the variable becomes
    # "0\n0" and downstream string compares break.
    OPEN=$(grep -c '^\- \[ \]' "$QUEUE_FILE" 2>/dev/null || true)
    OPEN=${OPEN:-0}
    DONE=$(grep -c '^\- \[x\]' "$QUEUE_FILE" 2>/dev/null || true)
    DONE=${DONE:-0}
    echo "PRODUCTION queue: $DONE done · $OPEN open"
    echo ""
    if [ "$OPEN" != "0" ]; then
      echo "## Next open items (top 10)"
      echo ""
      grep '^\- \[ \]' "$QUEUE_FILE" | head -10
      echo ""
    fi
  fi
  if [ -d "$REPO/.git" ]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
    echo "Branch: $BRANCH"
    echo ""
    echo "Recent commits:"
    git log --oneline -5 2>/dev/null
    echo ""
  fi
  echo "## Autopilot directive"
  echo ""
  echo "1. Read docs/PRODUCTION.md for the open queue."
  echo "2. Read CLAUDE.md, STANDARDS.md, docs/DESIGN.md for context."
  echo "3. Pick the top open item and execute. Do not ask what to do."
  echo "4. The Stop hook blocks ending the session while any docs/PRODUCTION.md"
  echo "   checkbox is unchecked. Check boxes as you complete items."
} > "$TMP"

python3 - "$TMP" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    context = f.read()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
PY
