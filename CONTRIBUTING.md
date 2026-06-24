# Contributing to Photoshop MCP

Thank you for your interest in contributing! This is a community-maintained project and is not affiliated with or endorsed by Adobe Inc.

## Language policy

This project uses **English** as its canonical language for all project artifacts:

- **Pull request titles, descriptions, and commit messages** must be written in English.
- **Source code, comments, and user-facing UI strings** must be written in English.
- **Documentation** (README, guides, inline docs) must be written in English.

Issues and review comments may be written in any language, but English is preferred so maintainers and future contributors can search and reference them easily.

## Before you start

1. Search [existing issues](https://github.com/alisaitteke/photoshop-mcp/issues) and [pull requests](https://github.com/alisaitteke/photoshop-mcp/pulls) to avoid duplicate work.
2. For large or architectural changes, open an issue first to discuss the approach.
3. For bug fixes and small improvements, a PR without a prior issue is fine.

## Development setup

### Prerequisites

- **Node.js** ≥ 18
- **npm**
- **Adobe Photoshop** installed and scriptable (required only for integration tests)

### Getting started

```bash
git clone https://github.com/alisaitteke/photoshop-mcp.git
cd photoshop-mcp
npm install
npm run build
```

### UI development

The standalone web UI runs a Hono backend and a Vite + Vue frontend:

```bash
npm run dev:ui
```

This starts the server on port 5174 (with hot reload) and the web dev server concurrently.

## Releasing

Version bumps ship from **`master`**. npm publish and GitHub Releases are related but
separate steps: pushing a version tag triggers a GitHub Release automatically; npm
publish stays manual on the maintainer machine (OTP/2FA).

1. Merge feature work to `master`.
2. Bump the `version` field in the root [`package.json`](package.json) only (the
   standalone UI package in `web/package.json` uses its own semver and is bumped
   separately when needed).
3. Regenerate [`CHANGELOG.md`](CHANGELOG.md) and include it in the release commit:

   ```bash
   ./scripts/backfill-changelog.sh
   git add CHANGELOG.md package.json
   git commit -m "X.Y.Z"
   ```

4. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin master
   git push origin vX.Y.Z
   ```

5. Wait for the [Release workflow](.github/workflows/release.yml) to finish, then
   verify the new release on the repo **Releases** page. Each release includes
   install commands, npm registry link, [CHANGELOG.md](CHANGELOG.md) anchor,
   categorized commits, PR links (when `#123` appears in messages), and
   **New Contributors** when applicable (see
   [`scripts/build-release-notes.sh`](scripts/build-release-notes.sh)).
6. From a clean `master` checkout, run `npm publish` (`prepublishOnly` runs
   `npm run build` automatically).
7. After npm publish, refresh the GitHub release so the body shows **Published on
   npm**:

   ```bash
   ./scripts/refresh-release-notes.sh vX.Y.Z
   ```

   Or run the [Refresh Release Notes](.github/workflows/refresh-release-notes.yml)
   workflow in GitHub Actions (Actions → Refresh Release Notes → enter the tag).

Always tag the **release commit on `master`**, not a feature branch. Re-pushing an
existing tag is safe — the workflow skips creation when a release already exists.

To backfill releases for tags that predate this workflow, run once:

```bash
./scripts/backfill-github-releases.sh
```

To rewrite release notes on existing releases (e.g. after improving the template):

```bash
./scripts/backfill-github-releases.sh --refresh
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | MCP server core, tools, recipes, and UI backend |
| `web/` | Vue 3 standalone UI (Tailwind v4, shadcn-vue) |
| `scripts/` | Integration and verification test scripts |
| `docs/` | Additional documentation |

See [`docs/architecture.md`](docs/architecture.md) for a detailed breakdown.

## Making changes

1. Branch from `master`.
2. Keep diffs focused — avoid unrelated refactors in the same PR.
3. Follow existing patterns:
   - Provider adapters in `src/ui/providers/`
   - MCP tools in `src/tools/`
   - Recipe tools in `src/tools/recipes/`
   - Prompt templates in `src/prompts/templates/`

## Code style

- **TypeScript** with strict mode enabled (`tsconfig.json`).
- **ESLint:** `npm run lint`
- **Prettier:** `npm run format:check` (check) or `npm run format` (auto-fix)

Match the style of surrounding code. Prefer extending existing abstractions over introducing parallel patterns.

## Testing

Tests are tiered by whether Photoshop must be running:

### Required (no Photoshop needed)

```bash
npm run build:server
npm run lint
npm run verify:photoshop-prompts
```

Run these before every PR.

### Recommended (Photoshop must be running)

```bash
npm run test:mcp-local    # prompt-layer smoke tests
npm run spike:issue-2     # issue #2 targeted regression
npm run test:mcp-all      # full sequential tool sweep
```

Integration tests communicate with a live Photoshop instance over stdio — the same path used by Cursor and Claude Desktop. Note which tests you ran in your PR description.

## Pull request checklist

- [ ] PR title, description, and commit messages are in **English**
- [ ] Code comments and user-facing strings are in **English**
- [ ] `npm run lint` passes
- [ ] `npm run build:server` passes
- [ ] `npm run verify:photoshop-prompts` passes
- [ ] Integration tests run (if applicable — requires Photoshop)
- [ ] Screenshots attached for UI changes

A [pull request template](.github/pull_request_template.md) is provided automatically when you open a PR on GitHub.

## Reporting bugs

Open a [GitHub Issue](https://github.com/alisaitteke/photoshop-mcp/issues) and include:

- Operating system (Windows / macOS) and version
- Photoshop version
- Node.js version
- Steps to reproduce
- Expected vs. actual behavior
- Relevant log output (`LOG_LEVEL=0` for debug)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
