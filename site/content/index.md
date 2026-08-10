---
layout: home

hero:
  name: Photoshop MCP
  text: Control Adobe Photoshop with AI
  tagline: MCP server for Cursor, Claude Desktop, and natural language — 102 tools, recipe workflows, standalone web UI.
  image:
    src: /images/readme-hero.png
    alt: Photoshop MCP — AI-driven Photoshop automation
  actions:
    - theme: brand
      text: Quick Start
      link: /readme
    - theme: alt
      text: Documentation
      link: /docs/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/alisaitteke/photoshop-mcp

features:
  - icon: 🎯
    title: State-aware agents
    details: get_state, get_preview, and get_capabilities so AI assistants know the document before they act — fewer brittle ExtendScript guesses.
  - icon: 🧩
    title: 102 MCP tools
    details: 86 atomic tools plus 16 recipe workflows (remove background, export for web, portrait enhance, and more) — each recipe is a single undo step.
  - icon: 🖥️
    title: Standalone web UI
    details: Chat with Claude, GPT, or Gemini and drive Photoshop without an IDE. API keys or Claude Code / Gemini CLI accounts.
  - icon: ⚡
    title: Action Plan (beta)
    details: Plan every Photoshop step in one LLM call, then execute in a single pass — fewer round-trips for multi-step prompts.
  - icon: 🎨
    title: Generative AI & Neural Filters
    details: Firefly generative fill/remove/expand via ExtendScript; optional UXP bridge for Neural Filters (skin smooth, colorize, …).
  - icon: 🌐
    title: Cross-platform
    details: macOS (AppleScript) and Windows (COM). Photoshop 2012–2025 compatibility by design.

---

## Quick start

**MCP server (stdio)** — Cursor, Claude Desktop, Claude Code, VS Code:

```bash
npx -y @alisaitteke/photoshop-mcp
```

**Standalone web UI** — local chat + Photoshop, no IDE:

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

**Prerequisites:** Adobe Photoshop running on Windows or macOS, Node.js 18+.

![Standalone UI](https://alisaitteke.github.io/photoshop-mcp/images/frame_generic_light.png)

## Why this exists

Raw ExtendScript from LLMs is brittle: agents waste tokens, layer types break filters, and one failed command leaves the document in an unknown state. Photoshop MCP adds structured errors, recipe tools, and state awareness so natural language can ship pixels.

[Read the full README](/readme) · [Browse all tools](/docs/available-tools) · [Architecture deep-dive](/docs/architecture)

> **Note:** Unofficial community project — not affiliated with or endorsed by Adobe Inc.
