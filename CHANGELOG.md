# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.21] - 2026-09-25

[v1.7.20...v1.7.21](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.20...v1.7.21)

### Fixed

- Generative tools no longer fail to parse in ExtendScript. Object shorthand `{ wait }` in the six Firefly JSX templates is written as `wait: wait`, which Photoshop's ES3 engine accepts. Thanks **onurleventogluu-ui** for the report in [#41](https://github.com/alisaitteke/photoshop-mcp/issues/41) and the fix in [#42](https://github.com/alisaitteke/photoshop-mcp/pull/42).

## [1.7.20] - 2026-09-22

[v1.7.19...v1.7.20](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.19...v1.7.20)

Shaped by anonymous product feedback.

### Fixed

- Generative remove calls Firefly `syntheticFill` instead of empty `removeTool` / `generativeFill` descriptors. Those descriptors make Photoshop return Error 8 Syntax error.
- Selection expand, contract, and feather use Action Manager when the DOM command is unavailable. `photoshop_select_rectangle` accepts `mode` (`replace`, `add`, `subtract`, `intersect`).
- Generate Image uses the same Firefly `syntheticFill` path. The tool description names it as Photoshop Generate Image / ImageGen.
- Photoshop Error 8 / "Syntax error" is classified as `extendscript_runtime_error` instead of `unknown`.

## [1.7.19] - 2026-09-21

[v1.7.18...v1.7.19](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.18...v1.7.19)

### Fixed

- Windows: non-ASCII text returned from Photoshop (CJK document and layer names, localized errors) is no longer mojibake. Script results are written as UTF-16 instead of being printed through `cscript` stdout. Thanks **DENGGL2** for the report in [#40](https://github.com/alisaitteke/photoshop-mcp/issues/40).

### Changed

- Release publish waits until the new version is visible on npm (publish-time malware scan) before refreshing release notes and publishing MCP Registry metadata.

## [1.7.18] - 2026-09-21

[v1.7.17...v1.7.18](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.17...v1.7.18)

Shaped by anonymous product feedback. Rybbit assigns generated session nicknames (not real names or accounts) — thank you **Coral Hamster** and **Scarlet Turtle**.

### Added

- Artboard tools: `photoshop_list_artboards`, `photoshop_create_artboard`, `photoshop_set_active_artboard`, `photoshop_export_artboards`. `photoshop_get_state` includes artboard bounds; `photoshop_export_as` accepts `artboard_id`. Thanks **Coral Hamster** for asking for artboard / multi-screen workflows.
- `timeout_ms` on `photoshop_execute_script` (max 600s) and env `PHOTOSHOP_SCRIPT_TIMEOUT`. Batch recipes and multi-file exports use a 600s script budget. Thanks **Coral Hamster** for reporting long scripts timing out.
- `photoshop_list_documents` reports `artboard_count` and `saved` per open tab; `photoshop_get_state` includes `openDocumentCount`.
- Typography: `photoshop_set_text_style` (tracking, leading, paragraph box, alignment) and `photoshop_set_text_ranges` (mixed font/color in one layer). `photoshop_create_text_layer` accepts the same style fields. Thanks **Scarlet Turtle** for the tracking / leading / mixed-range / text-box request.

### Changed

- Product-feedback ping is on by default but opt-out (`PSMCP_FEEDBACK=0`, or MCPB **Product feedback prompts**). Hosts ask in the user's conversation language, in first person.

### Fixed

- Windows script-queue timeout now starts at dequeue (same two-phase model as macOS) and kills hung `cscript` processes.
- Script timeouts classify as `extendscript_timeout` instead of `unknown` / `generative_timeout`. After a timeout, the envelope points at `photoshop_ping` (Photoshop may still be running the previous JSX). `photoshop_execute_script` timeouts suggest retrying once with `timeout_ms: 180000`.

## [1.7.17] - 2026-09-18

[v1.7.16...v1.7.17](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.16...v1.7.17)

### Other

- Delay the MCP feedback nudge until 15 minutes after the first ping. (`e1def0e`)
- Ask first-time MCP users for product feedback after ping. (`680860e`)
- Restore the v1.1+ blurb in the Turkish README. (`dc43180`)
- Remove the outdated v1.1+ blurb from the Turkish README. (`0c63252`)

## [1.7.16] - 2026-09-18

[v1.7.15...v1.7.16](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.15...v1.7.16)

### Other

- Treat Cursor stdio respawns as one analytics session and cache Photoshop detection. (`fc4734c`)
- Show GitHub contributors in the README so credit is visible. (`437efc3`)

### Version bumps

- 1.7.16 (`e336fde`)

## [1.7.15] - 2026-09-16

[v1.7.14...v1.7.15](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.14...v1.7.15)

### Other

- Add Cursor plugin packaging so the MCP list can show the Photoshop logo. (`6e931d7`)
- Prefer native Remove Background and unlock locked Background layers in the recipe. (`e8d3f8e`)

### Version bumps

- 1.7.15 (`3b28983`)

## [1.7.14] - 2026-09-15

[v1.7.13...v1.7.14](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.13...v1.7.14)

### Other

- Drop the three-step how-it-works section and ignore the VitePress cache. (`fa4dbcf`)
- Simplify the homepage demo card by dropping tool-call steps and export details. (`0eff6b4`)

### Version bumps

- 1.7.14 (`bbceb82`)

## [1.7.13] - 2026-09-15

[v1.7.12...v1.7.13](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.12...v1.7.13)

### Other

- Skip native sqlite compile on Glama so the Docker sandbox can build without make. (`00ece07`)
- Add the Glama quality-score card to the README locales. (`641ecaf`)

### Version bumps

- 1.7.13 (`4646e8f`)

## [1.7.12] - 2026-09-15

[v1.7.11...v1.7.12](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.11...v1.7.12)

### Version bumps

- 1.7.12 (`64e5e37`)

## [1.7.11] - 2026-09-15

[v1.7.10...v1.7.11](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.10...v1.7.11)

### Version bumps

- 1.7.11 (`c19736c`)

## [1.7.10] - 2026-09-15

[v1.7.9...v1.7.10](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.9...v1.7.10)

### Version bumps

- 1.7.10 (`ee55064`)

## [1.7.9] - 2026-09-15

[v1.7.8...v1.7.9](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.8...v1.7.9)

### Version bumps

- 1.7.9 (`ffdb97a`)

## [1.7.8] - 2026-09-15

[v1.7.7...v1.7.8](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.7...v1.7.8)

### Version bumps

- 1.7.8 (`85e09f8`)

## [1.7.7] - 2026-09-15

[v1.7.6...v1.7.7](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.6...v1.7.7)

### Other

- Let Action Plan run on CLI subscription accounts. (`2f3e654`)
- Fall back from generative recipe paths when Photoshop rejects them. (`5c4c51a`)
- Stop shipping a dangling pageview.js import that crashes npx installs. (`514b22d`)
- Stop serving the marketing site from GitHub Pages. (`7b63596`)

### Version bumps

- 1.7.7 (`71c57f4`)

## [1.7.6] - 2026-09-12

[v1.7.5...v1.7.6](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.5...v1.7.6)

### Other

- Document PulseMCP and Chinese MCP directory listing workflows. (`1270b0b`)
- Redesign marketing site with landing, recipes, and tool explorer. (`9a379b7`)
- Keep the 1.7.6 changelog user-facing. (`31d0fdc`)
- Replace PostHog with self-hosted Rybbit for MCP, UI, and site analytics. (`375a940`)
- Add PostHog analytics to the marketing site (`442f1c0`)

### Version bumps

- 1.7.6 (`62dfcd5`)

## [1.7.5] - 2026-09-07

[v1.7.4...v1.7.5](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.4...v1.7.5)

### Fixes

- fix(macos): apply detected app name before the first script runs (`09bfaf9`)
- fix(release): validate tags and recover notes when tag points to wrong commit (`9f3190d`)

### Other

- Link the site footer to alisait.com and LinkedIn (`ce310f9`)
- Serve trailing-slash doc URLs on GitHub Pages (`bdcac5b`)
- Point the marketing site at photoshop-mcp.com (`91d169e`)
- Restore README badges, rename hero image to bust GitHub image cache (`d9396ae`)
- Improve site SEO and AI-search readiness (`69d0ae9`)
- Simplify README into a designer-friendly landing page, regenerate hero image (`f07d695`)
- Fix #31: wrap generative prompts as ExtendScript string literals. (`4181d98`)
- Harden #29 follow-ups: locale-safe drop shadow, Color Range min/max, fail on place translate. (`fbd3a3a`)
- Fix issue #29: Color blend mapping, drop shadow descriptor, place_image coords, studio BG fallback, and optional document_id. (`4a742dc`)
- Expand atomic tool surface to 118 tools and sync agent documentation. (`5a9d3cd`)

### Version bumps

- 1.7.5 (`df09a58`)
- 1.7.4 (`3777ca7`)

## [1.7.4] - 2026-08-25

[v1.7.3...v1.7.4](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.3...v1.7.4)

### Fixes

- fix(macos): apply detected app name before the first script runs (`09bfaf9`)
- fix(release): validate tags and recover notes when tag points to wrong commit (`9f3190d`)

### Other

- Link the site footer to alisait.com and LinkedIn (`ce310f9`)
- Serve trailing-slash doc URLs on GitHub Pages (`bdcac5b`)
- Point the marketing site at photoshop-mcp.com (`91d169e`)
- Restore README badges, rename hero image to bust GitHub image cache (`d9396ae`)
- Improve site SEO and AI-search readiness (`69d0ae9`)
- Simplify README into a designer-friendly landing page, regenerate hero image (`f07d695`)
- Fix #31: wrap generative prompts as ExtendScript string literals. (`4181d98`)
- Harden #29 follow-ups: locale-safe drop shadow, Color Range min/max, fail on place translate. (`fbd3a3a`)
- Fix issue #29: Color blend mapping, drop shadow descriptor, place_image coords, studio BG fallback, and optional document_id. (`4a742dc`)
- Expand atomic tool surface to 118 tools and sync agent documentation. (`5a9d3cd`)

### Version bumps

- 1.7.4 (`3777ca7`)

## [1.7.3] - 2026-08-25

[v1.7.2...v1.7.3](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.2...v1.7.3)

### Features

- feat(analytics): revert to PostHog-only and remove Mixpanel (`6041ea9`)

### Fixes

- fix(ci): install deps before MCP registry sync workflow (`d1af8e1`)

### Other

- ci: add MCP registry-only workflow and resilient npm publish (`6cfc560`)

### Version bumps

- 1.7.3 (`53c25b5`)

## [1.7.2] - 2026-08-25

[v1.7.1...v1.7.2](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.1...v1.7.2)

### Fixes

- fix(ci): defer PhotoshopConnection executor init to avoid Linux throw (`0f49d30`)

### Version bumps

- 1.7.2 (`38aa0ba`)

## [1.7.1] - 2026-08-25

[v1.7.0...v1.7.1](https://github.com/alisaitteke/photoshop-mcp/compare/v1.7.0...v1.7.1)

### Fixes

- fix(ci): align @eslint/js with eslint 9 for npm install (`f4bd3d4`)

### Version bumps

- 1.7.1 (`b9d3132`)

## [1.7.0] - 2026-08-25

[v1.6.1...v1.7.0](https://github.com/alisaitteke/photoshop-mcp/compare/v1.6.1...v1.7.0)

### Features

- feat(site): add llms.txt, AI discoverability, and full SEO meta layer (`cfccd5a`)
- feat(workflows): add GitHub Actions workflow for deploying marketing site to GitHub Pages feat(workflows): enhance release workflow to include npm publishing and MCP Registry publishing chore(gitignore): update .gitignore to exclude generated site content and build artifacts docs(CONTRIBUTING): update contributing guidelines to reflect new release and publishing processes (`1e56306`)

### Fixes

- fix(uxp): register bridge panel with manifestVersion 4 and correct entrypoint (`df70d46`)
- fix(site): use Photoshop MCP icon instead of recipe illustration as logo (`7a0710a`)
- fix(ci): commit site lockfile so Pages deploy can run npm ci (`bf5982f`)

### Other

- Add agent discoverability docs and fix MCP registry description sync. (`a1f976b`)

### Version bumps

- 1.7.0 (`ede9928`)

## [1.6.1] - 2026-08-11

[v1.6.0...v1.6.1](https://github.com/alisaitteke/photoshop-mcp/compare/v1.6.0...v1.6.1)

### Other

- Add csv-to-cards recipe infographic and README showcase section (`a928b50`)
- Add 13 tools and csv-to-cards recipe, expanding coverage to 102 tools. (`f79392b`)

### Version bumps

- 1.6.1 (`863c1ae`)

## [1.6.0] - 2026-08-07

[v1.5.0...v1.6.0](https://github.com/alisaitteke/photoshop-mcp/compare/v1.5.0...v1.6.0)

### Fixes

- fix(ui/server): require a per-session token on /api/* (`439d5c3`)
- fix(platform): AppleScript timeout block, queue cancellation, jsString control chars (`93574e1`)
- fix(macos): no focus-steal by default, per-app pgrep, timeout kills child, 2026/Beta paths (`d8adf79`)

### Other

- Improve docs and CLI auth UX for open issues #17–#19. (`5cc17b1`)
- test: add vitest unit-test harness (npm run test:unit) (`ffd21e4`)

### Version bumps

- 1.6.0 (`91d52ae`)

## [1.5.0] - 2026-07-27

[v1.4.0...v1.5.0](https://github.com/alisaitteke/photoshop-mcp/compare/v1.4.0...v1.5.0)

### Features

- feat(tools): add split_carousel, batch_watermark, passport_photo recipes and neural colorize (`f266aee`)

### Fixes

- fix(layers): make photoshop_duplicate_layer activate the duplicate (`50b1a88`)

### Documentation

- docs(readme): make recipe examples visible with infographics for all 15 recipes (`afbe5be`)
- docs(i18n): add locale README translations (ES, ZH, DE, JA, TR) (`bdde203`)

### Version bumps

- 1.5.0 (`5935101`)

## [1.4.0] - 2026-07-03

[v1.3.13...v1.4.0](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.13...v1.4.0)

### Other

- release: v1.4.0 — Photoshop native AI (Generative + Neural Filters) (`d76e822`)

### Version bumps

- 1.3.13 (`b94812f`)

## [1.3.13] - 2026-07-03

[v1.3.12...v1.3.13](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.12...v1.3.13)

### Documentation

- docs: add README hero banner with alisait.com branding (`c535f7d`)
- docs: add portfolio positioning, architecture deep-dive, and social preview assets (`1011044`)

### Chores

- chore(images): update og-social.png to enhance visual quality and branding (`74d48e5`)

## [1.3.12] - 2026-07-02

[v1.3.11...v1.3.12](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.11...v1.3.12)

### Features

- feat(analytics): improve Mixpanel tracking with cohorts, milestones, and flush parity (`b7daf3a`)

### Version bumps

- 1.3.12 (`d016e61`)

## [1.3.11] - 2026-07-02

[v1.3.10...v1.3.11](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.10...v1.3.11)

### Features

- feat(ui): add custom OpenAI/Anthropic-compatible API provider (`a1d3a1a`)
- feat(analytics): default to Mixpanel with PostHog rollback path (`4e9444d`)

### Fixes

- fix(release): generate CHANGELOG from package.json before tag exists (`c7f1a58`)

### Documentation

- docs: add CHANGELOG section for 1.3.10 and fix release tag order (`e6a58c1`)

### Version bumps

- 1.3.11 (`7908066`)

## [1.3.10] - 2026-06-24

[v1.3.9...v1.3.10](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.9...v1.3.10)

### Features

- feat(release): add CHANGELOG, categorized notes, and npm refresh workflow (`844485c`)
- feat(release): enrich GitHub release notes with npm install links (`087bca1`)

### Version bumps

- 1.3.10 (`65dce09`)

## [1.3.9] - 2026-06-24

[v1.3.8...v1.3.9](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.8...v1.3.9)

### Features

- feat(release): add GitHub Actions workflow for automated releases on version tags docs(CONTRIBUTING): update contributing guide with release process details docs(README): add GitHub release badge to README for better visibility chore(scripts): add backfill script to create GitHub Releases for existing tags without releases (`be01916`)

### Other

- Add GitHub Sponsors username to FUNDING.yml (`5f619dd`)
- Add GitHub Sponsors username to FUNDING.yml (`d4c2c66`)

### Version bumps

- 1.3.9 (`b8a3f47`)
- 1.3.5 (`7949efc`)
- 1.3.4 (`cfce75b`)

## [1.3.8] - 2026-06-18

[v1.3.7...v1.3.8](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.7...v1.3.8)

### Features

- feat(analytics): add app version retrieval from package.json for server-side events fix(docs): update anonymous usage analytics documentation to clarify app version tracking (`f767166`)

### Version bumps

- 1.3.8 (`b3c3871`)

## [1.3.7] - 2026-06-18

[v1.3.6...v1.3.7](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.6...v1.3.7)

### Features

- feat(analytics): enhance anonymous usage analytics to track MCP client connection and disconnection events feat(analytics): add support for recording active provider and model in analytics feat(analytics): implement usage surface tracking for anonymous profiles feat(analytics): create smoke tests for MCP client analytics functionality fix(analytics): update event properties to include new metrics for MCP client refactor(analytics): reorganize code for better clarity and maintainability chore(docs): update documentation to reflect changes in analytics tracking and events (`8b71106`)

### Version bumps

- 1.3.7 (`f9245c8`)

## [1.3.6] - 2026-06-18

[v1.3.5...v1.3.6](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.5...v1.3.6)

### Version bumps

- 1.3.6 (`9d84bf0`)

## [1.3.5] - 2026-06-18

[v1.3.4...v1.3.5](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.4...v1.3.5)

### Features

- feat(analytics): enhance tool batch flushing logic to improve performance and responsiveness during usage sessions fix(analytics): add flush method to analytics providers to ensure queued events are sent before shutdown docs(analytics): update documentation to reflect changes in tool batch flushing criteria and behavior (`0ce8d42`)

### Chores

- chore(images): update frame_generic_light.png to improve visual quality and consistency (`a5e8eb2`)

### Version bumps

- 1.3.5 (`4a11910`)

## [1.3.4] - 2026-06-17

[v1.3.3...v1.3.4](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.3...v1.3.4)

### Features

- feat(analytics): enhance anonymous usage analytics to collect more detailed runtime environment data including system locale, CPU count, and memory tier feat(analytics): implement MCP session tracking with tool usage summaries and error reporting fix(analytics): ensure proper identification of analytics person with additional properties for better segmentation fix(server): update tool handler registration to include tool name for accurate tracking fix(server): capture connection events and tool call metrics to improve error handling and analytics reporting docs(anonymous-usage-analytics): update documentation to reflect new data collection practices and clarify what is collected and not collected (`ec1dda2`)

### Version bumps

- 1.3.4 (`26e4849`)

## [1.3.3] - 2026-06-17

[v1.3.2...v1.3.3](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.2...v1.3.3)

### Version bumps

- 1.3.3 (`09ed18d`)

## [1.3.2] - 2026-06-17

[v1.3.1...v1.3.2](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.1...v1.3.2)

### Version bumps

- 1.3.2 (`e09cae6`)
- 1.3.1 (`17891a4`)

## [1.3.1] - 2026-06-17

[v1.3.0...v1.3.1](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.0...v1.3.1)

### Features

- feat(analytics): implement anonymous usage analytics with locale support to enhance user insights docs(README): simplify anonymous usage analytics section and link to detailed documentation docs(anonymous-usage-analytics): create dedicated documentation for anonymous usage analytics details fix(db): update data directory path to use getPhotoshopMcpHomeDir function for better compatibility (`b1b58e8`)

## [1.3.0] - 2026-06-17

[v1.1.3...v1.3.0](https://github.com/alisaitteke/photoshop-mcp/compare/v1.1.3...v1.3.0)

### Features

- feat(analytics): add launch method detection to capture analytics context (`39beb6c`)
- feat(analytics): implement analytics system with PostHog integration for usage tracking and beta telemetry feat(analytics): add API endpoints for managing analytics settings and beta telemetry opt-in feat(analytics): create UI components for user interaction with analytics settings and beta team participation feat(analytics): capture relevant events for analytics during server and UI operations feat(analytics): enable environment-based configuration for analytics settings docs: update README and .env.example to include new analytics configuration options and usage instructions (`097d19f`)
- feat(ui): enhance chat functionality by adding clear all chats feature and improving tool output handling (`8cef6e7`)
- feat(PlanCard.vue): refactor PlanCard component to use ToolCallStrip for better organization and clarity feat(StreamingMessage.vue): integrate ToolCallStrip for standalone tool calls display chore: remove ToolCallCard component as its functionality is replaced by ToolCallStrip feat: add ToolCallDetailDialog and ToolCallOrb components for enhanced tool call interaction feat: implement utility functions for tool name display and icon retrieval in tool-display and tool-icons modules (`6151bfc`)
- feat(README.md): update version description to include Action Plan (beta) feature and its benefits feat(Action Plan): implement Action Plan (beta) feature for streamlined execution of Photoshop commands feat(ui): add AppLoader component for improved loading experience during app initialization refactor(ui): remove Footer component and integrate author information into Sidebar fix(ui): enhance loading state management in SettingsDialog and ChatView components fix(ui): improve message handling in MessageList and StreamingMessage components for better user experience style(ui): add custom scrollbar styles for a cleaner interface chore(api): update API interfaces to include reasoning and activity tracking for chat messages chore(store): enhance chat store to manage streaming messages and reasoning deltas effectively chore(vite): configure proxy response headers to disable buffering and caching for real-time updates (`cd7d799`)
- feat(ChatView.vue): refactor layout to improve message list and composer positioning for better user experience feat(Composer.vue): implement textarea auto-resizing for improved usability style(Composer.vue): enhance styling of the composer component for better visual appeal fix(ModelSelector.vue): adjust button hover styles for better accessibility and user feedback (`a82cd5f`)
- feat(package.json): add packageManager field to specify pnpm version for consistency across environments feat(agent.ts): implement action plan feature to generate and execute a complete ordered plan for Photoshop tool calls feat(action-plan.ts): create action plan execution logic to handle planning and executing tool calls in a single pass feat(shared.ts): define new types for plan step status and plan view to support action plan feature feat(config.ts): add actionPlanBeta configuration option to enable or disable action plan feature feat(server.ts): add API endpoint to toggle action plan feature in the server configuration feat(chats.ts): extend chat message structure to include action plan details for better state management feat(App.vue): integrate action plan toggle in the UI to allow users to enable or disable the feature feat(ChatView.vue): display action plan and tool calls inline for better user experience feat(PlanCard.vue): create a new component to visualize the action plan and its steps feat(MessageList.vue): update message list to conditionally render action plan and tool calls feat(useTextareaAutosize.ts): add composable for auto-resizing text areas to improve user input experience feat(api.ts): implement API call to set action plan feature state in the backend fix(server.ts): ensure assistant messages persist action plan state when saving chat history (`de0c500`)

### Fixes

- fix(windows-executor.ts): remove unnecessary return statement in DoJavaScript call to streamline execution of JSX script (`2e8f719`)

### Refactors

- refactor: simplify error handling by removing error parameter in catch blocks across platform detector and executor files to enhance code readability and maintainability (`4253d62`)

### Chores

- chore(release): bump version to 1.3.0 (`5e1acaf`)
- chore(images): update image assets to improve visual quality and consistency (`8751c8a`)
- chore(eslint): update ESLint configuration to include globals for Node.js and ES2021 refactor(eslint): adjust no-unused-vars rule to improve TypeScript compatibility and ignore specific patterns (`b440fa1`)

### Version bumps

- 1.2.0 (`51f1756`)

## [1.1.3] - 2026-06-11

### Features

- feat(README.md): update tool counts and descriptions to reflect new features and improvements feat(api): add font listing functionality and enhance text layer creation with font support fix(api): resolve font names for text layers to ensure correct font application fix(errors): add 'font_not_found' error code for better error handling test: add tests for font listing and text layer creation with specified fonts (`5530756`)
- feat(CONTRIBUTING.md): add command for targeted regression tests for issue #2 feat(README.md): update recorded test results to reflect issue #2 fixes and new test harness feat(package.json): add new script for targeted regression tests for issue #2 feat(spike-issue-2.ts): create a new script for targeted regression tests for issue #2 fix(test-all-mcp-tools.ts): improve document info assertion to handle errors gracefully feat(layer-tools.ts): add new tool to select layer by name, including nested groups fix(extendscript.ts): improve error handling when accessing document properties fix(photoshop-api.ts): ensure alert suppression works correctly during script execution fix(macos-executor.ts): ensure ExtendScript BOM is prefixed when writing scripts fix(windows-executor.ts): ensure ExtendScript BOM is prefixed when writing scripts chore(_shared.ts): refactor jsString function to use utility from js-string module feat(extendscript-file.ts): add utility to prefix UTF-8 BOM for ExtendScript files feat(js-string.ts): create utility for escaping JavaScript strings (`68322ce`)
- feat(docs): update README and related documentation to reflect the addition of 12 new recipe tools and 4 new atomic tools, bringing the total to 78 tools fix(docs): correct tool coverage count in test script to match updated total of 78 tools (`6502d01`)
- feat(package.json): add new test script for intent expansion features feat(test-intent-expansion): create local integration test for prompt-intent-expansion features to ensure functionality and coverage of new features (`8fe5a68`)
- feat(docs): update README to reflect new MCP prompts and tools, including 16 pre-engineered templates and 12 outcome-oriented recipe tools feat(docs): add user intent glossary and degrade paths for better user guidance feat(docs): enhance instructions for prompt-layer usage and multi-step workflows feat(docs): finalize intent taxonomy and update phase documentation for clarity feat(prompts): introduce new prompts for gradient fade, sky blend, dodge & burn, and remove distraction feat(tools): add new mask tools for gradient application and enhance existing adjustment tools feat(recipes): implement new recipes for gradient fade, sky blend, dodge & burn, and remove distraction to streamline user workflows fix(extendScript): improve error handling and add new helper functions for gradient and mask operations fix(tests): update tests to cover new prompts and recipes, ensuring all functionalities are validated (`1ce32bb`)
- feat(tests): add local and all MCP tools test scripts to improve testing coverage chore(package.json): add new test scripts for local and all MCP tools to facilitate testing process refactor(extendscript): improve layer handling and error management in ExtendScript snippets for better reliability refactor(recipes): streamline recipe functions to utilize shared helper functions for consistency and maintainability (`56f303d`)
- feat(docs): add AI/Prompt Layer documentation to README.md to explain new features and usage feat(docs): create prompt-layer.md to provide detailed reference for AI/prompt layer functionality chore(gitignore): add local maintenance scripts to .gitignore to prevent unnecessary tracking feat(scripts): add verify-photoshop-prompt-coverage script to ensure prompt and recipe parity feat(scripts): create test-mcp-local script for local smoke testing of the photoshop-mcp server feat(core): implement PromptRegistry to manage prompt definitions and handlers feat(core): integrate prompt handling into PhotoshopMCPServer for improved functionality feat(recipes): add various recipe tools for enhanced image processing capabilities feat(recipes): implement frequency separation, enhance portrait, and batch mockup replace recipes feat(recipes): create export social variants and prepare for web recipes for streamlined exports fix(api): improve error handling in getContextInfo function to prevent crashes fix(api): ensure active layer checks are robust to avoid runtime errors fix(api): enhance error classification for better user feedback on failures fix(tools): update tool descriptions to clarify usage and preconditions for better developer experience (`3e871ab`)
- feat(extendscript): implement hue, saturation, and lightness adjustment for active layer using Action Descriptor for better compatibility with Photoshop (`77a35de`)
- feat: add provider and model information to chat messages and UI components (`80050c4`)
- feat(extendscript): enhance fillLayer function to handle locked and text layers and return additional information fix(macos-executor): improve error handling in parseResult method to throw an error for specific error messages (`658cdad`)
- feat: add Google AI Studio provider support to the application (`34eef62`)
- feat(ui): enhance chat functionality with usage tracking and cost calculation (`77f0cc6`)

### Fixes

- fix(extendscript.ts): improve hasSelection logic to handle exceptions when no active selection exists (`73f94ba`)

### Documentation

- docs(README): update features list formatting for improved readability and consistency (`d8688bb`)
- docs: update contributing and development documentation for clarity and organization (`dfb6878`)
- docs: add CONTRIBUTING.md and pull request template for better contribution guidelines and process clarity (`832292c`)
- docs(README.md): update README to reflect version 1.1 features and integration test results for better clarity and user guidance docs(prompt-intent-expansion): add initial documentation for prompt intent expansion project to outline phases and confirmed decisions docs(intent-taxonomy): create intent taxonomy draft to map user phrases to corresponding tools and recipes for improved user interaction (`1ec19f0`)
- docs(README): update screenshot image for standalone UI to reflect new design feat(images): add new screenshot image for standalone UI in light frame (`1aa0e79`)
- docs(README): add screenshot of standalone UI to enhance documentation clarity feat(images): add standalone UI screenshot to provide visual reference for users (`a3833f1`)
- docs(README): update documentation to include standalone UI mode and usage instructions for better user guidance (`34149f5`)

### Chores

- chore(package.json): update build:web script to use install instead of ci for better dependency management (`1bb0075`)
- chore(.gitignore): add local planning docs directory to .gitignore to prevent tracking of unpublished files (`cc18f6c`)
- chore(.gitignore): add *.tgz to ignore list to prevent tarball files from being tracked (`b5e7097`)
- chore: update package versions to 0.1.8 for both main and web packages to reflect new changes chore: update author information in package.json for better attribution chore: add repository, homepage, and bugs fields in package.json for better project visibility chore: clean up .npmignore by removing unnecessary entries and adding defensive filters feat(cli.ts): dynamically retrieve package version from package.json for CLI output feat(server.ts): implement cache control headers for static assets to improve performance and caching behavior (`9dabea6`)
- chore(package.json): update build:web script to use npm ci for better performance and reliability chore(web/.npmignore): add .npmignore file to exclude unnecessary files from the package feat(web/package.json): add @lobehub/icons-static-svg dependency for icon support feat(main.ts): self-host only the Latin subset of Source Sans 3 Variable font to reduce bundle size (`9101fbe`)

### Version bumps

- 1.1.3 (`bcbba5c`)
- 1.1.2 (`0414f29`)
- 1.1.1 (`5cac9c1`)
- 1.1.0 (`6e1c1f0`)
- 1.0.0 (`17d8d91`)

