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

# collect_commits PREV TAG → newline-separated hash|subject|author (no merges).
collect_commits() {
  local prev="$1" tag="$2"
  if [[ -n "$prev" ]]; then
    git log "${prev}..${tag}" --pretty=format:'%H|%s|%an' --no-merges 2>/dev/null || true
  else
    git log -30 "${tag}" --pretty=format:'%H|%s|%an' --no-merges 2>/dev/null || true
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

# npm_status_note PKG VERSION → single-line status for release callout.
npm_status_note() {
  local pkg="$1" version="$2"
  if command -v npm >/dev/null 2>&1 \
    && npm view "${pkg}@${version}" version 2>/dev/null | grep -qx "${version}"; then
    echo "✅ Published on npm."
  else
    echo "⏳ Not on npm yet — \`npm publish\` usually follows shortly after this GitHub release."
  fi
}

# tag_date TAG → YYYY-MM-DD from tagger or commit date.
tag_date() {
  local tag="$1"
  git log -1 --format='%ad' --date=short "${tag}" 2>/dev/null || date +%Y-%m-%d
}
