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

# `grep -c` exits non-zero on zero matches; under `set -euo pipefail`
# a `|| echo 0` fallback runs in addition to grep's "0" output and
# produces "0\n0". Use `|| true` and clamp to a single value so the
# variable is always a single integer.
count_open() {
  local file="$1"
  if [ ! -f "$file" ]; then echo 0; return; fi
  local n
  n=$(grep -c '^\- \[ \]' "$file" 2>/dev/null || true)
  echo "${n:-0}"
}

{
  echo "[autopilot] Brief acknowledgement — do not stop, do not summarize."
  echo ""

  DIRECTIVE="$REPO/.agent-state/directive.md"
  if [ -f "$DIRECTIVE" ]; then
    DIR_OPEN=$(count_open "$DIRECTIVE")
    echo "$DIR_OPEN .agent-state/directive.md items still open."
    echo ""
    if [ "$DIR_OPEN" != "0" ]; then
      echo "Top open directive items:"
      grep '^\- \[ \]' "$DIRECTIVE" | head -5
      echo ""
    fi
  fi

  PRODUCTION="$REPO/docs/PRODUCTION.md"
  if [ -f "$PRODUCTION" ]; then
    PROD_OPEN=$(count_open "$PRODUCTION")
    if [ "$PROD_OPEN" != "0" ]; then
      echo "$PROD_OPEN docs/PRODUCTION.md items still open."
      echo ""
      grep '^\- \[ \]' "$PRODUCTION" | head -5
      echo ""
    fi
  fi

  echo "Pick the next open directive item. Ship a commit. Do not ask what to do."
  echo "After each commit, dispatch the 3 background reviewers and move on."
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
