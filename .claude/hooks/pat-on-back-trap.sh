#!/usr/bin/env bash
# pat-on-back-trap.sh — per-repo UserPromptSubmit hook for Bioluminescent Sea.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

INPUT=$(cat || echo "{}")
PROMPT=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('prompt',''))
except Exception:
    print('')
" 2>/dev/null || echo "")

NORM=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
WC=$(echo "$NORM" | wc -w | tr -d ' ')

TRIGGER=0
if [ "$WC" -le 5 ]; then
  case "$NORM" in
    "thanks"|"ty"|"thank you"|"nice"|"good"|"good job"|"great"|"great work"| \
    "awesome"|"cool"|"ok"|"okay"|"go"|"continue"|"keep going"|"sounds good"| \
    "looks good"|"lgtm"|"yes"|"yep"|"ship it"|"ready"|"done"|"all set"|"perfect"|"k")
      TRIGGER=1
      ;;
  esac
fi

if [ "$WC" = "1" ] && [ "${#NORM}" -le 3 ]; then
  TRIGGER=1
fi

if [ "$TRIGGER" = "0" ]; then
  echo "{}"
  exit 0
fi

TMP=$(mktemp -t pat.XXXXXX)
trap 'rm -f "$TMP"' EXIT

{
  echo "[autopilot] Brief acknowledgement — do not stop."
  echo ""
  if [ -f "$REPO/docs/PRODUCTION.md" ]; then
    OPEN=$(grep -c '^\- \[ \]' "$REPO/docs/PRODUCTION.md" 2>/dev/null || echo 0)
    echo "$OPEN docs/PRODUCTION.md items still open."
    echo ""
    grep '^\- \[ \]' "$REPO/docs/PRODUCTION.md" | head -5
  fi
} > "$TMP"

python3 - "$TMP" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    context = f.read()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": context
    }
}))
PY
