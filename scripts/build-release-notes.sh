#!/usr/bin/env bash
# Build enriched GitHub Release notes for a version tag.
# Used by .github/workflows/release.yml and scripts/backfill-github-releases.sh.
#
# Usage: scripts/build-release-notes.sh <tag> [previous-tag]
# Expects package.json in the current working directory.
set -euo pipefail

TAG="${1:?tag required (e.g. v1.3.9)}"
PREV="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/release-notes-lib.sh
source "${SCRIPT_DIR}/release-notes-lib.sh"

VERSION="${TAG#v}"
PKG="$(node -p "require('./package.json').name")"
REPO="${release_notes_repo}"
NPM_URL="https://www.npmjs.com/package/${PKG}/v/${VERSION}"
README_URL="https://github.com/${REPO}/blob/${TAG}/README.md"
CHANGELOG_URL="https://github.com/${REPO}/blob/${TAG}/CHANGELOG.md#$(changelog_anchor "$VERSION")"

NPM_NOTE="$(npm_status_note "$PKG" "$VERSION")"

if [[ -n "$PREV" ]]; then
  PREV_SHA="$(git rev-parse "${PREV}^{commit}" 2>/dev/null || true)"
  TAG_SHA="$(git rev-parse "${TAG}^{commit}" 2>/dev/null || true)"
  if [[ -n "$PREV_SHA" && "$PREV_SHA" == "$TAG_SHA" ]]; then
    RELEASE_COMMIT="$(release_commit_for_version "$PREV" "$VERSION" || true)"
    if [[ -n "$RELEASE_COMMIT" ]]; then
      COMPARE_URL="https://github.com/${REPO}/compare/${PREV}...${RELEASE_COMMIT}"
    else
      COMPARE_URL="https://github.com/${REPO}/compare/${PREV}...${TAG}"
    fi
  else
    COMPARE_URL="https://github.com/${REPO}/compare/${PREV}...${TAG}"
  fi
else
  COMPARE_URL=""
fi

commits="$(collect_commits "$PREV" "$TAG")"
if [[ -n "$commits" ]]; then
  CHANGES="$(categorize_commits <<<"$commits")"
else
  CHANGES="- No commits in range."
fi

CONTRIBUTORS="$(new_contributors "$PREV" "$TAG")"

{
  echo "## Install"
  echo
  echo '```bash'
  echo "# MCP server (Cursor, Claude Desktop, etc.)"
  echo "npx ${PKG}@${VERSION}"
  echo
  echo "# Standalone web UI"
  echo "npx -p ${PKG}@${VERSION} ui"
  echo
  echo "# Pin in package.json"
  echo "npm install ${PKG}@${VERSION}"
  echo '```'
  echo
  echo "## Links"
  echo
  echo "| | |"
  echo "| --- | --- |"
  echo "| **npm** | [${PKG}@${VERSION}](${NPM_URL}) |"
  echo "| **Docs** | [README](${README_URL}) |"
  echo "| **Changelog** | [${VERSION} in CHANGELOG.md](${CHANGELOG_URL}) |"
  if [[ -n "$COMPARE_URL" ]]; then
    echo "| **Full diff** | [${PREV}...${TAG}](${COMPARE_URL}) |"
  fi
  echo
  echo "## Requirements"
  echo
  echo "- Node.js ≥ 18"
  echo "- Adobe Photoshop (Windows or macOS)"
  echo
  echo "> ${NPM_NOTE}"
  echo
  if [[ -n "$CONTRIBUTORS" ]]; then
    echo "$CONTRIBUTORS"
  fi
  echo "## What's Changed"
  echo
  echo "$CHANGES"
}
