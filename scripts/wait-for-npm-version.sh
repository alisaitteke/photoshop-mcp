#!/usr/bin/env bash
# Wait until an exact npm version is readable on the public registry.
# npm publish-time malware scanning can delay availability by ~5–15 minutes.
#
# Usage: wait-for-npm-version.sh <package> <version> [max_attempts] [sleep_seconds]
# Defaults: 40 attempts × 30s = 20 minutes.
set -euo pipefail

PKG="${1:?package required (e.g. @scope/name)}"
VERSION="${2:?version required (e.g. 1.7.17)}"
MAX_ATTEMPTS="${3:-40}"
SLEEP_SECONDS="${4:-30}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/release-notes-lib.sh
source "${SCRIPT_DIR}/release-notes-lib.sh"

wait_for_npm_version "$PKG" "$VERSION" "$MAX_ATTEMPTS" "$SLEEP_SECONDS"
