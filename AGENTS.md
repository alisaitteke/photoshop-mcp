# AGENTS.md — photoshop-mcp

> **Navigation map, not a reference manual.**
> Start with [llms.txt](llms.txt) or the site index [llms.txt](https://photoshop-mcp.com/llms.txt), then follow links as needed.

## Entry strategy

| Scenario | Path |
| -------- | ---- |
| Cursor | Install the `photoshop-mcp` plugin (Customize → Plugins / Marketplace) so the Photoshop logo appears in the MCP list. Fallback: `mcpServers` → `npx -y @alisaitteke/photoshop-mcp` (stdio, generic icon) |
| Claude Desktop / VS Code | Configure `mcpServers` → `npx -y @alisaitteke/photoshop-mcp` (stdio) |
| Claude Code | `claude mcp add photoshop -- npx -y @alisaitteke/photoshop-mcp` |
| Standalone chat UI (no IDE) | `npx -p @alisaitteke/photoshop-mcp ui` |
| Local development | `npm install && npm run build && node dist/index.js` — see [docs/development.md](docs/development.md) |

**Prerequisites:** Photoshop running on Windows or macOS, Node.js 18+. This is unofficial and not affiliated with Adobe.

**Tool surface:** 122 MCP tools — 106 atomic `photoshop_*` + 16 recipe `photoshop_recipe_*`; 23 MCP prompt templates (`ps.*`).

## Architecture (agent view)

```
AI host (Cursor / Claude / UI)
  │  MCP stdio
  ▼
PhotoshopMCPServer (Node.js)
  │  ExtendScript via AppleScript (macOS) or COM (Windows)
  ▼
Adobe Photoshop

Optional: UXP bridge plugin (uxp-plugin/) on 127.0.0.1:38452 for Neural Filters only.
```

Deep dive: [docs/architecture.md](docs/architecture.md).

## Recommended workflow

Follow the server `instructions` advertised on MCP `initialize` ([src/prompts/instructions.ts](src/prompts/instructions.ts)):

```
1. DISCOVER: tools/list + prompts/list (or get_capabilities once per session)
2. STATE:    photoshop_get_state before mutating; photoshop_get_preview after major steps
3. ACT:      prefer photoshop_recipe_* for multi-step outcomes (single undo step)
4. RECOVER:  on error, read structured envelope (code, suggested_next_tool) → get_state → retry one step
```

### Tool selection

| Need | Use |
| ---- | --- |
| Multi-step outcome (remove BG, export for web, portrait enhance) | `photoshop_recipe_*` |
| Single precise edit | atomic `photoshop_*` |
| Vague user intent | MCP prompt `prompts/get` (e.g. `ps.remove_background`) then call linked recipe/tool |
| Generative AI (Fill, Remove, Expand) | `photoshop_generative_*` — requires Adobe account + credits |
| Neural Filters (skin smooth, colorize, …) | `photoshop_neural_filter` — requires UXP bridge loaded |
| Version / feature check | `photoshop_get_capabilities` |
| Tracking, leading, paragraph box | `photoshop_set_text_style` (or those fields on `photoshop_create_text_layer`) |
| Mixed fonts/colors in one text layer | `photoshop_set_text_ranges` |

Full catalog: [docs/available-tools.md](docs/available-tools.md). Prompt layer: [docs/prompt-layer.md](docs/prompt-layer.md).

## MCP client configuration

Cursor: prefer the `photoshop-mcp` plugin (Customize → Plugins) so the Photoshop logo appears in the MCP list. Other hosts and the install-mcp deeplink use:

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": { "LOG_LEVEL": "1" }
    }
  }
}
```

Examples: [examples/cursor-config.json](examples/cursor-config.json), [examples/claude-desktop-config.json](examples/claude-desktop-config.json).

### Environment variables

| Variable | Purpose |
| -------- | ------- |
| `LOG_LEVEL` | `0`=DEBUG, `1`=INFO, `2`=WARN, `3`=ERROR |
| `PHOTOSHOP_PATH` | Optional custom Photoshop install path |
| `PHOTOSHOP_SCRIPT_TIMEOUT` | Default ExtendScript timeout in ms (default `30000`, max `600000`) |
| `PSMCP_UI_TOKEN` | Pin standalone UI API token (see README) |
| `PSMCP_FEEDBACK` | Set `0` to disable the product-feedback ping question (on by default) |

## Troubleshooting (common agent blockers)

| Symptom | Fix |
| ------- | --- |
| Photoshop not found | Start Photoshop; set `PHOTOSHOP_PATH` if non-standard install |
| Tool times out | Ping until Photoshop answers, then retry. Pass `timeout_ms` on `photoshop_execute_script` (max 600s), or set `PHOTOSHOP_SCRIPT_TIMEOUT`; batch recipes already use 600s. Do not immediately retry `get_state` after a timeout — Photoshop may still be running the previous script. |
| `generative_unavailable` / `version_unsupported` | Call `get_capabilities`; feature may need newer Photoshop or Adobe login |
| Neural filter fails | **Add Plugin** → `uxp-plugin/manifest.json` → **Load** in UXP Developer Tools — see [docs/development.md](docs/development.md#uxp-bridge-plugin-neural-filters) |
| No active document | Ask user to open/create a document, then `get_state` |

More: [docs/troubleshooting.md](docs/troubleshooting.md).

## Distribution

| Channel | Identifier |
| ------- | ---------- |
| npm | `@alisaitteke/photoshop-mcp` |
| MCP Registry | `io.github.alisaitteke/photoshop-mcp` |
| GitHub | https://github.com/alisaitteke/photoshop-mcp |
| Cursor Marketplace | plugin `photoshop-mcp` (submit via [CONTRIBUTING.md](CONTRIBUTING.md#cursor-marketplace)) |

## Key files

| File | Purpose |
| ---- | ------- |
| [llms.txt](llms.txt) | LLM-oriented project summary |
| [README.md](README.md) | Human docs, install, example prompts |
| [server.json](server.json) | MCP Registry metadata |
| [src/core/server.ts](src/core/server.ts) | MCP server entry |
| [src/tools/](src/tools/) | Tool implementations |
| [src/prompts/](src/prompts/) | MCP prompt templates |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR and release workflow |
| [`.cursor-plugin/plugin.json`](.cursor-plugin/plugin.json) | Cursor Plugin manifest (MCP list logo) |
| [`mcp.json`](mcp.json) | Cursor Plugin stdio server config |

## Contributing (agents editing this repo)

- Canonical language for code, comments, commits, and PRs: **English**.
- Before PR: `npm run lint`, `npm run build:server`, `npm run verify:photoshop-prompts`, `npm run verify:pack`.
- Do not add AI-attribution footers to commits or PR descriptions.
