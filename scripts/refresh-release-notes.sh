#!/usr/bin/env bash
# Refresh GitHub Release notes for one tag (e.g. after npm publish).
#
# Usage: scripts/refresh-release-notes.sh <tag>
set -euo pipefail

TAG="${1:?tag required (e.g. v1.3.9)}"
REPO="${GITHUB_REPOSITORY:-alisaitteke/photoshop-mcp}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/release-notes-lib.sh
source "${SCRIPT_DIR}/release-notes-lib.sh"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required" >&2
  exit 1
fi

cd "$ROOT"
git fetch --tags --force origin >/dev/null 2>&1 || true

PREV="$(previous_version_tag "$TAG")"
BODY="$(bash scripts/build-release-notes.sh "$TAG" "${PREV}")"

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "error: release ${TAG} not found on ${REPO}" >&2
  exit 1
fi

gh release edit "$TAG" --repo "$REPO" --notes "$BODY"
echo "Refreshed release notes for ${TAG}"
