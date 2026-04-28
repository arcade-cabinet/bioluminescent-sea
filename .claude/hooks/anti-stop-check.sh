#!/usr/bin/env bash
# anti-stop-check.sh — generic continuous-work guardrail.
#
# Reads the directive (.agent-state/directive.md) for ACTIVE/RELEASED.
# Counts unchecked `- [ ]` items in:
#   - .agent-state/directive.md (the active work-unit queue)
#   - docs/PRODUCTION.md               (the long-running production queue)
#   - .autopilot/QUEUE.md              (the /loop autopilot queue, if used)
#
# Behavior:
#   - directive missing or Status ≠ ACTIVE → fall back to legacy queue counts
#                                            (PRODUCTION.md + .autopilot/QUEUE.md)
#   - directive Status: ACTIVE + any queue has open items → exit 2 (block)
#   - all queues empty → exit 0 (allow stop)
#
# Block via {"decision":"block","reason":...} JSON so the agent receives
# the open items as actionable feedback instead of a silent block.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

DIRECTIVE="$REPO/.agent-state/directive.md"
QUEUE_FILES=(
  "$DIRECTIVE"
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

# Resolve directive Status. Lines look like `status: ACTIVE` (frontmatter)
# or `Status: ACTIVE` (body). Default to ACTIVE if directive exists but
# no Status line is found — be strict by default.
DIRECTIVE_STATUS="ABSENT"
if [ -f "$DIRECTIVE" ]; then
  STATUS_LINE=$(grep -iE '^(status:|# *status:)' "$DIRECTIVE" 2>/dev/null | head -1 || true)
  if [ -n "$STATUS_LINE" ]; then
    DIRECTIVE_STATUS=$(echo "$STATUS_LINE" \
      | sed -E 's/^[#[:space:]]*[Ss]tatus:[[:space:]]*//' \
      | tr -d '[:space:]' \
      | tr '[:lower:]' '[:upper:]')
  else
    DIRECTIVE_STATUS="ACTIVE"
  fi
fi

# RELEASED / DRAINED → user explicitly let us stop (directive-wise).
# Still respect PRODUCTION.md / .autopilot/QUEUE.md.
if [ "$DIRECTIVE_STATUS" = "RELEASED" ] || [ "$DIRECTIVE_STATUS" = "DRAINED" ]; then
  PROD_OPEN=$(count_open "$REPO/docs/PRODUCTION.md")
  AUTO_OPEN=$(count_open "$REPO/.autopilot/QUEUE.md")
  if [ "$PROD_OPEN" = "0" ] && [ "$AUTO_OPEN" = "0" ]; then
    exit 0
  fi
fi

TOTAL_OPEN=0
declare -a SUMMARY_LINES
for file in "${QUEUE_FILES[@]}"; do
  n=$(count_open "$file")
  if [ "$n" != "0" ]; then
    TOTAL_OPEN=$((TOTAL_OPEN + n))
    rel="${file#$REPO/}"
    SUMMARY_LINES+=("$n open in $rel")
  fi
done

if [ "$TOTAL_OPEN" = "0" ]; then
  exit 0
fi

TMP=$(mktemp -t anti-stop.XXXXXX)
trap 'rm -f "$TMP"' EXIT

{
  echo "Stop blocked: ${TOTAL_OPEN} checkboxes still open for Bioluminescent Sea."
  echo "Directive Status: ${DIRECTIVE_STATUS}"
  for line in "${SUMMARY_LINES[@]}"; do
    echo "  - $line"
  done
  echo ""
  for file in "${QUEUE_FILES[@]}"; do
    n=$(count_open "$file")
    if [ "$n" != "0" ]; then
      rel="${file#$REPO/}"
      echo "Open items in $rel (top 5):"
      grep '^\- \[ \]' "$file" | head -5
      echo ""
    fi
  done
  echo "Pick the next open item and execute. Do not summarize, do not ask."
  echo "If a spec commit just landed, dispatch 3 background reviewers"
  echo "(feature-dev:code-reviewer, security via general-purpose, code-simplifier),"
  echo "then immediately move to the next task. Fold findings into the next commit."
  echo "Push only after every box above is checked."
} > "$TMP"

python3 - "$TMP" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    reason = f.read()
print(json.dumps({"decision": "block", "reason": reason}))
PY
