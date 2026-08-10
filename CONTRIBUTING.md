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

Version bumps ship from **`master`**. Pushing a version tag triggers the
[Release workflow](.github/workflows/release.yml), which creates a GitHub Release,
publishes to npm, publishes metadata to the [Official MCP Registry](https://registry.modelcontextprotocol.io),
and refreshes release notes once npm is live.

**One-time setup:** add an npm automation token as the repository secret `NPM_TOKEN`
(Settings → Secrets and variables → Actions). Use an npm **Automation** or
**Publish** token scoped to `@alisaitteke/photoshop-mcp` (or the whole org).

1. Merge feature work to `master`.
2. Bump the `version` field in the root [`package.json`](package.json) only (the
   standalone UI package in `web/package.json` uses its own semver and is bumped
   separately when needed).
3. Regenerate [`CHANGELOG.md`](CHANGELOG.md) and commit the release (tag is
   created **after** the commit — `backfill-changelog.sh` reads `package.json`
   for the pending version):

   ```bash
   ./scripts/backfill-changelog.sh
   npm run sync:server-version
   git add CHANGELOG.md package.json server.json
   git commit -m "X.Y.Z"
   git tag vX.Y.Z
   ```

4. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin master
   git push origin vX.Y.Z
   ```

5. Wait for the [Release workflow](.github/workflows/release.yml) to finish, then
   verify the new release on the repo **Releases** page. The workflow publishes to
   npm and the MCP Registry, then refreshes release notes with **✅ Published on
   npm.** Each release includes install commands, npm registry link,
   [CHANGELOG.md](CHANGELOG.md) anchor, categorized commits, PR links (when `#123`
   appears in messages), and **New Contributors** when applicable (see
   [`scripts/build-release-notes.sh`](scripts/build-release-notes.sh)).

   If publish failed but the GitHub Release exists, fix the issue and re-run the
   failed **publish** job from Actions, or run [Refresh Release Notes](.github/workflows/refresh-release-notes.yml)
   after a manual `npm publish` + `./mcp-publisher publish`.

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

## Registry listings

### Official MCP Registry

Metadata lives in [`server.json`](server.json). The Release workflow publishes to
[registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) after
each npm publish (`mcp-publisher` via GitHub OIDC). `npm run sync:server-version`
keeps `server.json` aligned with `package.json` before tagging.

### Glama

Listing: [glama.ai/mcp/servers/alisaitteke/photoshop-mcp](https://glama.ai/mcp/servers/alisaitteke/photoshop-mcp)

[`glama.json`](glama.json) at the repo root lets org maintainers claim the server.
After merging changes to `glama.json`, re-run the claim flow on Glama so metadata
syncs.

1. Open the server page → **Claim ownership** (GitHub OAuth).
2. On the **admin** tab, configure the Docker/build spec (Node 20, `npm install`,
   `node dist/index.js` via Glama's `mcp-proxy` wrapper).
3. **Deploy** → wait for the sandbox health check (`initialize` + `tools/list`).
4. **Make Release** with the semver matching the GitHub tag.

Glama releases are independent of GitHub Releases — trigger a new Glama release when
you want the directory grade/security scan refreshed for a shipped version.

### Smithery (MCPB)

Smithery distributes stdio servers as `.mcpb` bundles. Source manifest:
[`mcpb/manifest.json`](mcpb/manifest.json). Build script:
[`scripts/build-mcpb.ts`](scripts/build-mcpb.ts).

```bash
npm run build:mcpb
# → release/photoshop-mcp-<version>.mcpb

npx @smithery/cli auth login
npx @smithery/cli mcp publish "./release/photoshop-mcp-<version>.mcpb" -n alisaitteke/photoshop-mcp
```

`tools_generated` / `prompts_generated` are set because this server exposes a large
dynamic catalog. Rebuild and republish the MCPB after each semver release. Native
deps (`better-sqlite3`) are compiled for the machine that runs `build:mcpb` — build
on macOS for darwin bundles and on Windows for win32 if you need platform-specific
artifacts.

## Site development (GitHub Pages)

Marketing site: [alisaitteke.github.io/photoshop-mcp](https://alisaitteke.github.io/photoshop-mcp/)

| Path | Purpose |
| --- | --- |
| `site/` | VitePress site (landing pages per locale) |
| `site/content/*/index.md` | Hand-authored marketing landings (committed) |
| `site/content/**/readme.md`, `site/content/docs/` | Generated by `scripts/sync-site-content.ts` (not committed) |

```bash
cd site && npm install && npm run dev    # local preview
cd site && npm run build                 # sync + vitepress build + sitemap
```

**One-time GitHub setup:** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Edit canonical content in repo root `docs/` and `README*.md`; the sync script copies them before each build. Deploy workflow: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | MCP server core, tools, recipes, and UI backend |
| `web/` | Vue 3 standalone UI (Tailwind v4, shadcn-vue) |
| `scripts/` | Integration and verification test scripts |
| `site/` | VitePress marketing site (GitHub Pages) |
| `docs/` | Additional documentation (synced to the site at build time) |

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
