#!/usr/bin/env bash
# sync-main.sh <repo-root>
#
# After a PR squash-merges, run this in the game's repo to leave the
# working tree unambiguous:
#   - checkout main
#   - pull with --prune --rebase=false
#   - delete the local feature branch whose upstream is gone
#   - remote prune origin
#
# Idempotent. No-ops if already synced.

set -euo pipefail

REPO_ROOT="${1:?usage: sync-main.sh <repo-root>}"
cd "$REPO_ROOT"

if [ ! -d ".git" ]; then
  echo "[sync-main] $REPO_ROOT is not a git repo — skipping" >&2
  exit 0
fi

CURRENT=$(git branch --show-current 2>/dev/null || echo "")

# 1. Fetch + prune so we know which local branches have vanishing upstream.
git fetch --prune origin

# 2. If we're on a branch other than main, check whether it's been
#    squash-merged (upstream branch was deleted by the PR merge).
if [ -n "$CURRENT" ] && [ "$CURRENT" != "main" ]; then
  UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || echo "")
  if [ -n "$UPSTREAM" ]; then
    REMOTE_REF=$(git show-ref --verify --quiet "refs/remotes/$UPSTREAM" && echo "alive" || echo "gone")
  else
    REMOTE_REF="no-upstream"
  fi

  if [ "$REMOTE_REF" = "gone" ]; then
    echo "[sync-main] feature branch '$CURRENT' upstream is gone — switching to main and deleting"
    git checkout main
    git branch -D "$CURRENT" 2>/dev/null || true
  fi
fi

# 3. Ensure we're on main and fast-forwarded.
git checkout main
git pull --ff-only origin main

# 4. Sweep any remaining local branches whose upstream is gone.
gone=$(git branch -vv | awk '/: gone\]/ {print $1}' | grep -v '^\*' || true)
if [ -n "$gone" ]; then
  echo "[sync-main] deleting local branches whose upstream is gone:"
  echo "$gone" | xargs -n1 echo "  -"
  echo "$gone" | xargs -n1 git branch -D
fi

echo "[sync-main] $REPO_ROOT on main @ $(git rev-parse --short HEAD)"
