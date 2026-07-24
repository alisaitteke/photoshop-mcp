# Social preview & LinkedIn

Assets and copy for sharing this project on LinkedIn, GitHub, and other channels.

## Open Graph image

| Asset | Path | Size |
| ----- | ---- | ---- |
| Social preview | [`images/og-social.png`](../images/og-social.png) | 1200×630 (LinkedIn / GitHub recommended) |
| README hero | [`images/readme-hero.png`](../images/readme-hero.png) | 1280×400 (GitHub README banner) |

Branding matches [alisait.com](https://alisait.com): cyan logo gradient (`#06b6d4` → `#67e8f9`), Photoshop icon (`#001E36` / `#31A8FF`), and **Ali** + *said* footer text.

### GitHub repository social preview

1. Open **Settings → General → Social preview** on [github.com/alisaitteke/photoshop-mcp](https://github.com/alisaitteke/photoshop-mcp).
2. Upload `images/og-social.png`.
3. Save — link previews on LinkedIn, Slack, and X will use this image when sharing the repo URL.

### Personal site (alisait.com)

If you add a project page, set Open Graph tags to the same image and point `og:url` at the GitHub repo or a dedicated `/projects/photoshop-mcp` URL.

---

## Suggested LinkedIn post

Copy, adjust, and attach `images/og-social.png` or a short screen recording of the standalone UI.

---

**Hook**

I spent the last months making Photoshop controllable by AI agents — not with fragile one-off scripts, but with an MCP server that understands document state and ships real pixels.

**Problem**

When LLMs call Photoshop one command at a time, they burn tokens, guess layer types, and break on the first ExtendScript error. Real creative workflows need undoable multi-step runs and a way for the agent to recover.

**What I built (open source)**

- **Photoshop MCP** — 89 tools incl. 15 recipe workflows (single-undo outcomes)
- Cross-platform: macOS (AppleScript) + Windows (COM)
- Bundled **standalone web UI** — chat with Claude, GPT, or Gemini; drive Photoshop without an IDE
- **Action Plan (beta)** — plan all steps in one LLM call, execute without per-step round-trips

**Technical call**

External automation can't invoke UXP plugins — only ExtendScript via AppleScript/COM. I chose compatibility across Photoshop 2012–2025 over bleeding-edge APIs. Structured error envelopes tell the agent which tool to call next when something fails.

**Links**

- GitHub: https://github.com/alisaitteke/photoshop-mcp
- `npx @alisaitteke/photoshop-mcp` (MCP) · `npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui` (UI)
- Architecture write-up: https://github.com/alisaitteke/photoshop-mcp/blob/main/docs/architecture.md

Feedback and contributors welcome. If your team builds agent tooling or creative automation, happy to connect.

---

## GitHub repo About (manual)

Set in repository **About** sidebar:

- **Description:** `MCP server + local UI for AI-driven Photoshop automation. 80 tools, recipe workflows, cross-platform.`
- **Website:** `https://alisait.com`
- **Topics:** `mcp`, `model-context-protocol`, `typescript`, `ai-agents`, `photoshop`, `automation`, `vue`, `hono`, `developer-tools`, `cursor`, `claude`, `extendscript`
