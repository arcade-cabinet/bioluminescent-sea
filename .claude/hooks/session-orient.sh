#!/usr/bin/env bash
# session-orient.sh — per-repo SessionStart hook for Bioluminescent Sea.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

TMP=$(mktemp -t orient.XXXXXX)
trap 'rm -f "$TMP"' EXIT

PRODUCTION_FILE="$REPO/docs/PRODUCTION.md"
DIRECTIVE_FILE="$REPO/.agent-state/directive.md"

# See pat-on-back-trap.sh: grep -c on zero matches needs `|| true`
# (not `|| echo 0`) under set -euo pipefail or the variable becomes
# "0\n0" and downstream string compares break.
count_marker() {
  local file="$1" marker="$2"
  if [ ! -f "$file" ]; then echo 0; return; fi
  local n
  n=$(grep -c "$marker" "$file" 2>/dev/null || true)
  echo "${n:-0}"
}

{
  echo "# Bioluminescent Sea — Autopilot Session Orient"
  echo ""
  echo "Repo: $REPO"
  echo ""

  if [ -f "$DIRECTIVE_FILE" ]; then
    DIR_STATUS=$(grep -iE '^status:' "$DIRECTIVE_FILE" 2>/dev/null \
      | head -1 \
      | sed -E 's/^[Ss]tatus:[[:space:]]*//' \
      | tr -d '[:space:]' \
      | tr '[:lower:]' '[:upper:]')
    DIR_STATUS=${DIR_STATUS:-ACTIVE}
    DIR_OPEN=$(count_marker "$DIRECTIVE_FILE" '^\- \[ \]')
    DIR_DONE=$(count_marker "$DIRECTIVE_FILE" '^\- \[x\]')
    echo "Directive (.agent-state/directive.md): Status=${DIR_STATUS} · ${DIR_DONE} done · ${DIR_OPEN} open"
    echo ""
    if [ "$DIR_OPEN" != "0" ]; then
      echo "## Directive — next open items (top 10)"
      echo ""
      grep '^\- \[ \]' "$DIRECTIVE_FILE" | head -10
      echo ""
    fi
  fi

  if [ -f "$PRODUCTION_FILE" ]; then
    PROD_OPEN=$(count_marker "$PRODUCTION_FILE" '^\- \[ \]')
    PROD_DONE=$(count_marker "$PRODUCTION_FILE" '^\- \[x\]')
    echo "PRODUCTION queue: ${PROD_DONE} done · ${PROD_OPEN} open"
    echo ""
    if [ "$PROD_OPEN" != "0" ]; then
      echo "## PRODUCTION — next open items (top 10)"
      echo ""
      grep '^\- \[ \]' "$PRODUCTION_FILE" | head -10
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
  echo "1. The directive at .agent-state/directive.md is the active"
  echo "   work-unit queue. While Status: ACTIVE, the Stop hook blocks"
  echo "   session end until every '- [ ]' is checked."
  echo "2. Read CLAUDE.md, STANDARDS.md, docs/DESIGN.md for context."
  echo "3. One long-running PR per topic, commits per issue inside it."
  echo "   Local branch only — DO NOT push until every directive box is"
  echo "   checked AND local 3-agent review findings are folded in."
  echo "4. After each commit, dispatch in PARALLEL + BACKGROUND:"
  echo "   - feature-dev:code-reviewer  (bugs / logic / convention drift)"
  echo "   - general-purpose            (security review, scoped to diff)"
  echo "   - code-simplifier            (over-abstraction / redundant code)"
  echo "   Then immediately move to the next task. Fold findings into the"
  echo "   next commit when notifications arrive."
  echo "5. Docs → Tests → Code per spec. Tests encode the player journey"
  echo "   and visual/audio/gameplay patterns the docs require."
  echo "6. Pick the top open directive item and execute. Do not ask."
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
