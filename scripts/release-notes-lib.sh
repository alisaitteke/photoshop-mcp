#!/usr/bin/env bash
# Shared helpers for release note and CHANGELOG generation.
# Sourced by scripts/build-release-notes.sh and scripts/backfill-changelog.sh.

release_notes_repo="${GITHUB_REPOSITORY:-alisaitteke/photoshop-mcp}"

# previous_version_tag TAG → semver predecessor tag (e.g. v1.3.8 → v1.3.7), or empty.
previous_version_tag() {
  local tag="$1"
  git tag -l 'v*' --sort=-v:refname | awk -v t="$tag" 'found { print; exit } $0 == t { found = 1 }'
}

# next_version_tag TAG → semver successor tag (e.g. v1.3.8 → v1.3.9), or empty.
next_version_tag() {
  local tag="$1"
  git tag -l 'v*' --sort=-v:refname | awk -v t="$tag" '$0 == t { getline; print; exit }'
}

# changelog_anchor 1.3.9 → GitHub-compatible heading anchor fragment.
changelog_anchor() {
  local version="$1"
  echo "${version//./}" | tr '[:upper:]' '[:lower:]'
}

# format_commit_line formats one git log line as a markdown bullet with PR links.
# Input: hash|subject|author
format_commit_line() {
  local hash subject author repo linked
  IFS='|' read -r hash subject author <<<"$1"
  repo="${release_notes_repo}"
  linked="$(printf '%s' "$subject" | sed -E 's/\(#([0-9]+)\)/[(#\1)](https:\/\/github.com\/'"${repo//\//\\/}"'\/pull\/\1)/g')"
  echo "- ${linked} (\`${hash:0:7}\`)"
}

# release_commit_for_version PREV VERSION → newest commit after PREV whose package.json matches VERSION.
release_commit_for_version() {
  local prev="$1" version="$2" sha pkg_version
  while IFS= read -r sha; do
    [[ -z "$sha" ]] && continue
    pkg_version="$(git show "${sha}:package.json" 2>/dev/null \
      | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).version' 2>/dev/null || true)"
    if [[ "$pkg_version" == "$version" ]]; then
      echo "$sha"
      return 0
    fi
  done < <(git log "${prev}..HEAD" --pretty=format:'%H' --no-merges 2>/dev/null || true)
  return 1
}

# collect_commits PREV TAG → newline-separated hash|subject|author (no merges).
collect_commits() {
  local prev="$1"
  local release_tag="$2"
  local commits="" version="${release_tag#v}" end_ref="$release_tag"
  if [[ -n "$prev" ]]; then
    commits="$(git log "${prev}..${release_tag}" --pretty=format:'%H|%s|%an' --no-merges 2>/dev/null || true)"
    if [[ -z "$commits" ]]; then
      local prev_sha tag_sha release_commit=""
      prev_sha="$(git rev-parse "${prev}^{commit}" 2>/dev/null || true)"
      tag_sha="$(git rev-parse "${release_tag}^{commit}" 2>/dev/null || true)"
      if [[ -n "$prev_sha" && "$prev_sha" == "$tag_sha" ]]; then
        release_commit="$(release_commit_for_version "$prev" "$version" || true)"
        if [[ -n "$release_commit" ]]; then
          end_ref="$release_commit"
          commits="$(git log "${prev}..${end_ref}" --pretty=format:'%H|%s|%an' --no-merges 2>/dev/null || true)"
        fi
      fi
    fi
    printf '%s\n' "$commits"
  else
    git log -30 "${release_tag}" --pretty=format:'%H|%s|%an' --no-merges 2>/dev/null || true
  fi
}

# categorize_commits reads hash|subject|author lines on stdin; prints grouped markdown.
categorize_commits() {
  local line subject
  declare -a features fixes docs chores refactors other version_bumps

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    subject="${line#*|}"
    subject="${subject%%|*}"

    if [[ "$subject" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      version_bumps+=("$(format_commit_line "$line")")
    elif [[ "$subject" =~ ^feat(\(|:|\ ) ]]; then
      features+=("$(format_commit_line "$line")")
    elif [[ "$subject" =~ ^fix(\(|:|\ ) ]]; then
      fixes+=("$(format_commit_line "$line")")
    elif [[ "$subject" =~ ^docs(\(|:|\ ) ]]; then
      docs+=("$(format_commit_line "$line")")
    elif [[ "$subject" =~ ^refactor(\(|:|\ ) ]]; then
      refactors+=("$(format_commit_line "$line")")
    elif [[ "$subject" =~ ^chore(\(|:|\ ) ]]; then
      chores+=("$(format_commit_line "$line")")
    else
      other+=("$(format_commit_line "$line")")
    fi
  done

  print_category() {
    local title="$1"
    shift
    [[ $# -gt 0 ]] || return 0
    echo "### ${title}"
    echo
    printf '%s\n' "$@"
    echo
  }

  print_category "Features" ${features[@]+"${features[@]}"}
  print_category "Fixes" ${fixes[@]+"${fixes[@]}"}
  print_category "Documentation" ${docs[@]+"${docs[@]}"}
  print_category "Refactors" ${refactors[@]+"${refactors[@]}"}
  print_category "Chores" ${chores[@]+"${chores[@]}"}
  print_category "Other" ${other[@]+"${other[@]}"}
  print_category "Version bumps" ${version_bumps[@]+"${version_bumps[@]}"}
}

# new_contributors PREV TAG → markdown section or empty string.
new_contributors() {
  local prev="$1" tag="$2"
  local prior authors author name
  local -a lines=()

  if [[ -z "$prev" ]]; then
    return 0
  fi

  prior="$(git log "${prev}" --pretty=format:'%ae' --no-merges 2>/dev/null | sort -u)"
  authors="$(git log "${prev}..${tag}" --pretty=format:'%an|%ae' --no-merges 2>/dev/null | sort -u)"

  [[ -n "$authors" ]] || return 0

  while IFS='|' read -r name author; do
    [[ -z "$author" ]] && continue
    if ! echo "$prior" | grep -Fxq "$author"; then
      if [[ "$author" =~ ^[0-9]+\+([^@]+)@users.noreply.github.com$ ]]; then
        lines+=("- @${BASH_REMATCH[1]}")
      else
        lines+=("- ${name}")
      fi
    fi
  done <<<"$authors"

  [[ ${#lines[@]} -gt 0 ]] || return 0

  echo "## New Contributors"
  echo
  printf '%s\n' "${lines[@]}"
  echo
}

# npm_version_visible PKG VERSION → 0 when the exact version is on the public registry.
npm_version_visible() {
  local pkg="$1" version="$2"
  local registry="${NPM_REGISTRY:-https://registry.npmjs.org}"
  command -v npm >/dev/null 2>&1 \
    && npm view "${pkg}@${version}" version --registry="${registry}" 2>/dev/null | grep -qx "${version}"
}

# wait_for_npm_version PKG VERSION [MAX_ATTEMPTS] [SLEEP_SECONDS]
# Poll until the version is readable (npm publish-time scan can take ~5–15 minutes).
wait_for_npm_version() {
  local pkg="$1" version="$2"
  local max_attempts="${3:-40}"
  local sleep_seconds="${4:-30}"
  local attempt

  for attempt in $(seq 1 "${max_attempts}"); do
    if npm_version_visible "$pkg" "$version"; then
      echo "${pkg}@${version} is available on npm (attempt ${attempt}/${max_attempts})."
      return 0
    fi

    if (( attempt % 5 == 0 )); then
      echo "attempt ${attempt}/${max_attempts} — still waiting for ${pkg}@${version} (npm publish-time scan may be pending)…"
    fi

    if [[ "${attempt}" -lt "${max_attempts}" ]]; then
      sleep "${sleep_seconds}"
    fi
  done

  echo "error: ${pkg}@${version} is not available on npm after ${max_attempts} attempts (~$((max_attempts * sleep_seconds / 60)) minutes)." >&2
  echo "npm may still be scanning the package, or it may be held for manual review." >&2
  echo "Check npm notifications, then re-run the failed publish job or run:" >&2
  echo "  gh workflow run publish-mcp-registry.yml -f tag=v${version}" >&2
  return 1
}

# npm_status_note PKG VERSION → single-line status for release callout.
# Set NPM_PUBLISHED=1 after CI confirms npm availability.
# Set NPM_WAIT_FOR_VERSION=1 to poll up to ~20 minutes (manual refresh workflow).
npm_status_note() {
  local pkg="$1" version="$2"
  case "${NPM_PUBLISHED:-}" in
    1 | true | TRUE | True)
      echo "✅ Published on npm."
      return 0
      ;;
  esac

  if npm_version_visible "$pkg" "$version"; then
    echo "✅ Published on npm."
    return 0
  fi

  case "${NPM_WAIT_FOR_VERSION:-}" in
    1 | true | TRUE | True)
      if wait_for_npm_version "$pkg" "$version" "${NPM_WAIT_MAX_ATTEMPTS:-40}" "${NPM_WAIT_SLEEP_SECONDS:-30}"; then
        echo "✅ Published on npm."
        return 0
      fi
      ;;
  esac

  local attempt
  for attempt in 1 2 3 4 5 6; do
    if npm_version_visible "$pkg" "$version"; then
      echo "✅ Published on npm."
      return 0
    fi
    [[ "$attempt" -lt 6 ]] && sleep 5
  done

  echo "⏳ Not on npm yet — \`npm publish\` usually follows shortly after this GitHub release."
}

# tag_date TAG → YYYY-MM-DD from tagger or commit date.
tag_date() {
  local tag="$1"
  git log -1 --format='%ad' --date=short "${tag}" 2>/dev/null || date +%Y-%m-%d
}
