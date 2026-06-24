#!/usr/bin/env bash
# One-time backfill: create GitHub Releases for existing remote tags that lack one.
# Mirrors the commit-range notes logic in .github/workflows/release.yml.
# Requires: gh CLI authenticated with repo write access.
#
# Usage: ./scripts/backfill-github-releases.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

REPO="${GITHUB_REPOSITORY:-alisaitteke/photoshop-mcp}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required (https://cli.github.com/)" >&2
  exit 1
fi

git fetch --tags --force origin

TAGS=()
while IFS= read -r tag; do
  TAGS+=("$tag")
done < <(git tag -l 'v*' --sort=v:refname)

if [[ ${#TAGS[@]} -eq 0 ]]; then
  echo "No v* tags found."
  exit 0
fi

echo "Found ${#TAGS[@]} tag(s) to process (oldest → newest)."

PREV=""
for TAG in "${TAGS[@]}"; do
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    echo "skip $TAG — release already exists"
    PREV="$TAG"
    continue
  fi

  if [[ -n "$PREV" ]]; then
    BODY=$(git log "${PREV}..${TAG}" --pretty=format:'- %s (`%h`)' --no-merges)
  else
    BODY=$(git log -30 "${TAG}" --pretty=format:'- %s (`%h`)' --no-merges)
  fi

  if [[ -z "$BODY" ]]; then
    BODY="- No commits between tags (or empty range)."
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "dry-run: would create release $TAG"
    echo "$BODY" | head -5
    echo "---"
  else
    echo "creating release $TAG ..."
    gh release create "$TAG" \
      --repo "$REPO" \
      --title "$TAG" \
      --notes "$BODY"
  fi

  PREV="$TAG"
done

echo "Done."
