#!/usr/bin/env bash
# Regenerate CHANGELOG.md from all v* tags (oldest → newest).
#
# Usage: scripts/backfill-changelog.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/release-notes-lib.sh
source "${SCRIPT_DIR}/release-notes-lib.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHANGELOG="${ROOT}/CHANGELOG.md"

cd "$ROOT"

TAGS=()
while IFS= read -r tag; do
  TAGS+=("$tag")
done < <(git tag -l 'v*' --sort=-v:refname)

{
  cat <<'EOF'
# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF

  for TAG in "${TAGS[@]}"; do
    VERSION="${TAG#v}"
    DATE="$(tag_date "$TAG")"
    PREV="$(previous_version_tag "$TAG")"
    COMPARE=""
    [[ -n "$PREV" ]] && COMPARE="https://github.com/${release_notes_repo}/compare/${PREV}...${TAG}"

    echo "## [${VERSION}] - ${DATE}"
    echo
    if [[ -n "$COMPARE" ]]; then
      echo "[${PREV}...${TAG}](${COMPARE})"
      echo
    fi

    commits="$(collect_commits "$PREV" "$TAG")"
    if [[ -n "$commits" ]]; then
      categorize_commits <<<"$commits"
    else
      echo "- No commits in range."
      echo
    fi
  done
} >"$CHANGELOG"

echo "Wrote ${CHANGELOG} (${#TAGS[@]} versions)"
