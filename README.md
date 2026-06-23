# Photoshop MCP Server

*v1.1+ — recipe workflows, fewer round-trips, snappier sessions. Standalone UI ships **Action Plan (beta)** for plan-then-execute runs.*

> **Note:** This is an unofficial, community-maintained project and is not affiliated with or endorsed by Adobe Inc.

[![npm version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![Action Plan](https://img.shields.io/badge/Action%20Plan-beta-amber.svg)](#action-plan-beta)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

A Model Context Protocol (MCP) server that enables AI assistants like Claude and Cursor to control Adobe Photoshop programmatically. This allows you to create designs, manipulate images, and automate Photoshop workflows through natural language commands while working in your IDE — or through the bundled **standalone web UI**, which supports both API keys and CLI subscription accounts (Claude Code / Gemini CLI). The UI also offers an opt-in **Action Plan (beta)** mode that plans every Photoshop step in one LLM call, then runs them in a single pass.

## 🖥️ Standalone UI (no IDE required)

Don't want to wire this into Claude Desktop or Cursor? The same package ships a
fully local web UI that lets you chat with an AI model and drive Photoshop
through this MCP server underneath. Connect with a provider API key **or**, for
Anthropic and Google, reuse the OAuth session from **Claude Code** or **Gemini
CLI** — no separate API key required.

![Standalone UI Screenshot](./images/frame_generic_light.png)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

That's it. A local server starts on `127.0.0.1` (random free port) and your
default browser opens the chat UI automatically.

### Supported providers

Pick any of the following on first launch — use an API key **or** your existing
CLI subscription account (Anthropic and Google):

| Provider | Models | API key | CLI account |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100+ models from any provider | [openrouter.ai](https://openrouter.ai/keys) | — |

### Authentication modes

- **`api_key` (default)** — Vercel AI SDK + your provider API key. Usage is billed
  per token at API rates; the UI shows estimated cost per chat.
- **`cli_account`** — Uses your local Claude Code or Gemini CLI OAuth session.
  No API key is stored; the UI probes `claude auth status` / `gemini` headless
  to verify login. Usage counts against your **subscription quota**, not API
  billing — the status bar shows "Included in subscription".

You can switch auth method per provider in Settings without losing the other
credential (e.g. keep an API key while trying CLI account, then switch back).

### Action Plan (beta)

An optional execution mode in the standalone web UI for **API key auth only**
(`cli_account` always uses the default agentic flow). Turn it on with the
**Action Plan** toggle next to the model selector in the composer.

Instead of a per-step ReAct loop (model → tool → model → tool …), Action Plan:

1. Makes **one** planning LLM call that outputs an ordered todo list of
   Photoshop MCP tool calls with parameters.
2. Executes those tools **directly** in sequence — no extra model round-trips
   between steps.
3. On a failed step or unresolved dependency, runs a bounded **repair** loop
   (re-plans only the remaining steps, up to 3 times).

The plan appears as a live todo list above the tool-call cards, with per-step
status (`pending` → `running` → `done` / `error`). Plans are persisted in chat
history so they survive reload. The toggle is off by default; the existing
agentic flow is unchanged when Action Plan is disabled.

Good for multi-step prompts such as *"remove the background and export for web"*
where you want fewer model calls and faster end-to-end execution.

### What happens on first launch

1. Pick a provider and choose **API key** or **Uses your account**.
2. Validate the key or check the CLI connection. Config is stored locally at
   `~/.photoshop-mcp/data.db` (SQLite, `chmod 600`). API keys never leave your
   machine; CLI mode inherits OAuth from `~/.claude/` or `~/.gemini/`.
3. Type natural-language prompts. The UI streams the model's reply, runs
   Photoshop tool calls in real time, and renders each tool call as an
   inspectable card (input + result).
4. Switch provider, auth method, or model anytime from Settings / model selector
   — chats, costs and tool history are persisted across sessions.

### Switching auth method later

Open **Settings** from the sidebar at any time:

| Action | API key mode | CLI account mode |
|---|---|---|
| Set up | Paste key → **Save** | Install CLI → `auth login` → **Check connection** |
| Switch away | Choose **API key** — stored key is kept | Choose **Uses your account** — key is not deleted |
| Custom binary | — | Optional **CLI path** if `claude` / `gemini` is not on `PATH` |
| Cost display | Per-token estimate in status bar | **Included in subscription** badge |

Auth method is stored per provider in `~/.photoshop-mcp/data.db` (`authMethod`:
`api_key` or `cli_account`). Existing configs without `authMethod` default to
`api_key` and keep working unchanged.

### CLI flags

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

### Notes

- The agent is restricted to Photoshop MCP tools only — built-in shell, file
  and web tools are disabled.
- Tech stack: Vue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/)
  on the frontend; [Hono](https://hono.dev/) on the backend. API-key mode uses
  the [Vercel AI SDK](https://sdk.vercel.ai/); CLI account mode uses the
  [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp) (Anthropic)
  or Gemini CLI headless `stream-json` (Google). All paths talk to this same
  Photoshop MCP server over STDIO.
- **CLI account limitations:** Gemini headless may open a new session each turn
  (history is prepended to the prompt). Anthropic CLI account consumes
  subscription quota. OAuth login is macOS-first (`claude auth login` /
  `gemini auth login` in Terminal).

---

## AI/Prompt Layer for Photoshop

The photoshop-mcp server exposes 66 atomic `photoshop_*` tools plus 12 recipe
`photoshop_recipe_*` tools (78 total), along with a thin
AI/prompt layer ported from TTT: server-level instructions, MCP prompt templates,
recipe tools, state/preview tools, version-aware capabilities, and structured
error envelopes.

### 1. Server `instructions`

Source: [`src/prompts/instructions.ts`](src/prompts/instructions.ts)

Advertised on MCP `initialize`. Covers session bootstrap, recipe-over-atomic
selection, user intent glossary, degrade paths, disambiguation, guide vs recipe
prompt discovery, `~/.photoshop-mcp/exports` conventions, and error recovery contract.

### 2. MCP `prompts` primitive

Sixteen templates in [`src/prompts/templates/`](src/prompts/templates/), registered via
[`src/prompts/registry.ts`](src/prompts/registry.ts).

#### Recipe prompts (12 — 1:1 with `photoshop_recipe_*`)

| Prompt | Recipe tool |
|--------|-------------|
| `ps.enhance_portrait` | `photoshop_recipe_enhance_portrait` |
| `ps.remove_background` | `photoshop_recipe_remove_background` |
| `ps.prepare_for_web` | `photoshop_recipe_prepare_for_web` |
| `ps.export_social_variants` | `photoshop_recipe_export_social_variants` |
| `ps.apply_color_grade` | `photoshop_recipe_apply_color_grade` |
| `ps.frequency_separation` | `photoshop_recipe_frequency_separation` |
| `ps.batch_mockup_replace` | `photoshop_recipe_batch_mockup_replace` |
| `ps.organize_layers` | `photoshop_recipe_organize_layers` |
| `ps.gradient_fade` | `photoshop_recipe_gradient_fade` |
| `ps.sky_blend` | `photoshop_recipe_sky_blend` |
| `ps.dodge_burn` | `photoshop_recipe_dodge_burn` |
| `ps.remove_distraction` | `photoshop_recipe_remove_distraction` |

#### Guide prompts (4 — no recipe pair)

| Prompt | Purpose |
|--------|---------|
| `ps.gradient_blend` | Fade subject into background via mask gradient (atomic chain) |
| `ps.color_correct` | Tone / contrast fix chain |
| `ps.dodge_burn_guide` | 50% gray overlay retouch setup |
| `ps.composite_blend` | Place asset + mask + blend mode |

Each template uses arg coercion helpers from [`src/prompts/_shared.ts`](src/prompts/_shared.ts)
and returns a `GetPromptResult` with `description` + structured Goal/Plan/End state text
(guide prompts also include an Intent line).

### 3. Recipe tools

Twelve recipes in [`src/tools/recipes/`](src/tools/recipes/), sharing
[`src/tools/recipes/_shared.ts`](src/tools/recipes/_shared.ts) (`executeRecipe`,
`suspendHistory`, uniform `{ ok, summary, ... }` envelope).

Export recipes write to `~/.photoshop-mcp/exports` (or `~/.photoshop-mcp/exports/<chat-id>`
when the standalone UI passes `PHOTOSHOP_EXPORT_CHAT_ID` to the MCP child).

### 4. State & preview tools

| Tool | File |
|------|------|
| `photoshop_get_state` | [`src/tools/state-tools.ts`](src/tools/state-tools.ts) |
| `photoshop_get_preview` | same |
| `photoshop_get_capabilities` | same |

### 5. Verification

```bash
npm run verify:photoshop-prompts
```

Strict **12↔12** recipe/prompt parity plus separate guide prompt registration check.

### Backwards compatibility

All original `photoshop_*` tool names and schemas are unchanged; this expansion
added 4 atomics + 4 recipes + 8 prompt templates (additive only).

Verify parity: `npm run verify:photoshop-prompts`. Latest results: [Integration test results](#integration-test-results).

## Example Prompts

Below are example prompts you can use with AI assistants (Claude, Cursor, etc.)
when this MCP server is configured. Prefer **recipe tools** (`photoshop_recipe_*`)
for multi-step outcomes — each recipe is a single undo step. Use atomic
`photoshop_*` tools only for fine-grained edits no recipe covers.

<details>
<summary>🧠 State-aware session (recommended first step)</summary>

```
Ping Photoshop and read capabilities for my installed version.
Get the current document state before changing anything.
Open portrait.jpg, get a downscaled preview so you can verify the subject.
After each major recipe, get another preview to confirm the result.
```

</details>

<details>
<summary>👤 Portrait retouch (recipe)</summary>

```
Enhance the portrait on the active layer at medium intensity with skin smoothing.
Use the enhance-portrait recipe — I want frequency separation + auto-tone in one undoable step.
If the active layer is text or a Smart Object, rasterize first or pick a raster layer.
Show me a preview when done.
```

Equivalent MCP prompt template: `ps.enhance_portrait` with `{ intensity: "medium", skin_smoothing: "true" }`.

</details>

<details>
<summary>✂️ Background removal (recipe)</summary>

```
Remove the background from the active portrait layer.
Use Select Subject + a layer mask with a 2px feather. Keep the original pixels behind the mask.
The subject must be on the active layer — not a flat color fill.
```

Equivalent MCP prompt template: `ps.remove_background` with `{ feather_px: "2", keep_shadow: "false" }`.

</details>

<details>
<summary>🎨 Color grade (recipe)</summary>

```
Apply a warm film color grade to the open document as non-destructive adjustment layers.
Use the apply-color-grade recipe with preset warm_film.
Preview the result when finished.
```

</details>

<details>
<summary>🔬 Frequency separation setup (recipe)</summary>

```
Set up frequency separation on the active raster layer with a 6px blur radius.
I will paint on the Low and High layers myself — do not apply extra smoothing.
Tell me which layers to edit when the stack is ready.
```

Equivalent MCP prompt template: `ps.frequency_separation` with `{ radius_px: "6" }`.

</details>

<details>
<summary>🌐 Prepare for web + social export (recipes)</summary>

```
Prepare the active document for web: sRGB, downscale, sharpen, export one optimized JPEG to ~/.photoshop-mcp/exports.
Then export Instagram post and X post variants as separate JPEGs from the same document.
List the output paths in a table.
```

Equivalent templates: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>📦 Batch mockup replace (recipe)</summary>

```
I have a mockup PSD open with a Smart Object layer named "Screen".
Replace it with every PNG/JPG in ~/assets/mockups/ and export one JPEG per asset.
Do not place flat layers — swap the Smart Object so perspective is preserved.
```

Equivalent MCP prompt template: `ps.batch_mockup_replace`.

</details>

<details>
<summary>🗂️ Organize layers (recipe)</summary>

```
Organize the layer stack: rename by kind, auto-group related layers, preserve originals.
Run the organize-layers recipe, then list layers so I can review the new structure.
```

</details>

<details>
<summary>🎨 Basic Design Creation</summary>

```
Create a 1920x1080 Photoshop document with RGB color mode.
Add a light blue background layer and fill it with RGB(240, 248, 255).
Add centered text "Welcome" in 64pt font.
Save as welcome.psd to my Desktop.
```

</details>

<details>
<summary>🖼️ Stock Image Design (with Pexels MCP)</summary>

```
Search Pexels for "mountain sunset" images.
Create a 1920x1080 Photoshop document.
Place the downloaded image and fit it to fill the entire canvas.
Apply a subtle Gaussian blur of 3px.
Increase brightness by 15 and contrast by 10.
Add white text "Adventure Awaits" centered at the top in 72pt.
Set the text opacity to 90% and blend mode to OVERLAY.
Save as adventure.jpg with quality 10.
```

</details>

<details>
<summary>✨ Photo Enhancement</summary>

```
Open photo.jpg from my Desktop in Photoshop.
Get state, then run the enhance-portrait recipe at low intensity.
If I only need quick tone fixes, apply auto levels, auto contrast, and unsharp mask (120%, 1.5, 0) on the active layer instead.
Adjust hue +15 and saturation +15, or use prepare-for-web when I'm ready to export.
Save as enhanced-photo.jpg with quality 12.
```

</details>

<details>
<summary>🎭 Layer Effects & Blending</summary>

```
Create a 1200x800 document.
Add a new layer named "Background" and fill with RGB(50, 50, 50).
Place logo.png at position (100, 100).
Fit the logo layer to 50% of its current size.
Set blend mode to SCREEN and opacity to 85%.
Add another layer, fill with RGB(255, 100, 50).
Set this layer's blend mode to MULTIPLY and opacity to 60%.
Merge all visible layers.
Save as composite.psd.
```

</details>

<details>
<summary>📝 Text Poster Design</summary>

```
Create a 1080x1350 portrait document (Instagram story size).
Add a layer and fill with gradient-like color RGB(120, 40, 200).
Add text "SUMMER" at (540, 300) in 96pt.
Change text color to white RGB(255, 255, 255).
Set text alignment to CENTER.
Add another text "2026" at (540, 450) in 128pt, white color.
Apply Gaussian blur 2px to the background layer.
Save as summer-poster.png.
```

</details>

<details>
<summary>🎬 Batch Processing</summary>

```
Open image1.jpg.
Resize to 1920x1080.
Apply auto contrast.
Apply subtle sharpen (amount 80%, radius 1.0).
Save as processed-1.jpg with quality 10.
Close without saving changes to original.

Repeat for image2.jpg and image3.jpg.
```

</details>

<details>
<summary>🖌️ Creative Manipulation</summary>

```
Create a 2000x2000 square document.
Place abstract-pattern.jpg and fit to fill document.
Duplicate the layer.
On the duplicate, apply motion blur at 45 degrees, radius 50px.
Set blend mode to OVERLAY and opacity to 70%.
Add centered text "MOTION" in 120pt white.
Apply a rectangular selection from (200, 200) to (1800, 1800).
Invert the selection and delete (to create a border effect).
Flatten the image.
Save as motion-art.jpg.
```

</details>

<details>
<summary>🎯 Advanced Workflow</summary>

```
Create a 3000x2000 document at 300 DPI for print.
Place hero-image.jpg and fit to fill the canvas.
Duplicate the image layer.
On the duplicate, desaturate it completely.
Set blend mode to LUMINOSITY and opacity to 50%.
Create a new layer named "Overlay".
Fill with RGB(255, 150, 0) and set blend mode to SOFTLIGHT at 30% opacity.
Add text "PORTFOLIO" at top center (1500, 200) in 96pt.
Set text color to white.
Add subtext "2026 Collection" at (1500, 320) in 36pt.
Create a rectangular selection around the text area.
Create a layer mask on the overlay layer.
Merge visible layers.
Save as portfolio-cover.psd.
Export as portfolio-cover.jpg at quality 12.
```

</details>

<details>
<summary>🔄 Using Actions</summary>

```
Open my-photo.jpg.
Play the "Vintage Look" action from "My Actions" set.
Adjust brightness by -10 to darken slightly.
Save as vintage-photo.jpg.
```

</details>

<details>
<summary>⚡ Custom Script Execution</summary>

```
Execute this custom ExtendScript code:
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ Undo/Redo Operations</summary>

```
Apply Gaussian blur 15px to the active layer.
[Wait for result]
Actually, that's too much blur. Undo that.
Apply Gaussian blur 5px instead.
```

Or:

```
Get the history states to see what operations were performed.
Undo the last 3 operations.
Redo 1 step to bring back one operation.
```

</details>

<details>
<summary>🔁 Error recovery (structured envelopes)</summary>

```
If a recipe returns version_unsupported or generative_unavailable, call get_capabilities and tell me which Photoshop feature is missing.
If a tool fails with suggested_next_tool, follow that hint (e.g. rasterize_layer before a raster-only recipe).
Never guess — read get_state after a failure and propose the next single step.
```

</details>

## Features

- **Standalone web UI** — local chat interface (`photoshop-mcp-ui`); API key or CLI
  subscription auth per provider (Anthropic, Google)
- **Action Plan (beta)** — opt-in plan-then-execute mode in the web UI (API key
  only): one planning call, direct tool execution, bounded repair on failure
- **Works on both Windows and macOS**
- **Supports Photoshop 2012-2025+**
- **ExtendScript API**: Universal compatibility via AppleScript/COM automation
- **Auto-Detection**: Automatically finds Photoshop installation on your system
- **78 Tools**: 66 atomic `photoshop_*` + 12 recipe `photoshop_recipe_*`
- **AI/Prompt Layer**: 16 MCP prompt templates (12 recipe + 4 guide), server instructions, state/preview/capabilities tools
- **Document Management**: Create, open, save, close, crop documents
- **Layer Operations**: Create, delete, duplicate, merge, transform layers
- **Layer Properties**: Opacity, blend modes, visibility, locking
- **Text Formatting**: Font, size, color, alignment controls
- **Image Placement**: Place images, open files, fit to document
- **Filters**: Gaussian Blur, Sharpen, Noise, Motion Blur
- **Color Adjustments**: Brightness/Contrast, Hue/Saturation, Curves, Auto Levels/Contrast
- **Selections & Masks**: Rectangular selections, select subject, content-aware fill, gradient mask, layer masks
- **History Control**: Undo/Redo operations, view history states
- **Actions**: Play recorded actions, execute custom scripts
- **Auto-Rasterize**: Automatically converts layers when needed for filters
- **Context Tracking**: Returns document/layer state after each operation for AI context awareness

## Installation

### Using NPX (Recommended)

No installation required! Just configure your MCP client:

```bash
npx @alisaitteke/photoshop-mcp
```

To hack on the repo locally, see [From Source](#from-source) in the Development section below.

## Configuration

### For Cursor

Add to your Cursor settings (`.cursor/config.json` or workspace settings):

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": {
        "LOG_LEVEL": "1"
      }
    }
  }
}
```

### For Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": {
        "LOG_LEVEL": "1"
      }
    }
  }
}
```

### Environment Variables

- `PHOTOSHOP_PATH`: (Optional) Specify custom Photoshop installation path
- `LOG_LEVEL`: Logging level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
- `POSTHOG_DISABLED`: Set to `1` or `true` to disable anonymous usage analytics entirely
- `POSTHOG_KEY`: (Optional) Override the PostHog project key used for analytics
- `POSTHOG_API_HOST`: (Optional) PostHog ingest host (default: `https://a.alisait.com`)
- `POSTHOG_UI_HOST`: (Optional) PostHog UI host for dashboard links (default: `https://eu.posthog.com`)

## Available Tools

Reference for all atomic `photoshop_*` MCP tools exposed by this server (parameters, examples, and return shapes).


### Connection & Info

#### `photoshop_ping`
Test connection to Photoshop.

```javascript
// Example: Check if Photoshop is accessible
photoshop_ping()
```

#### `photoshop_get_version`
Get Photoshop version information.

```javascript
// Example: Get version details
photoshop_get_version()
```

### Document Management

#### `photoshop_create_document`
Create a new Photoshop document.

**Parameters:**
- `width` (number, required): Document width in pixels
- `height` (number, required): Document height in pixels
- `resolution` (number, optional): DPI resolution (default: 72)
- `colorMode` (string, optional): Color mode - RGB, CMYK, or Grayscale (default: RGB)

```javascript
// Example: Create a 1920x1080 RGB document
photoshop_create_document({
  width: 1920,
  height: 1080,
  resolution: 72,
  colorMode: "RGB"
})
```

#### `photoshop_get_document_info`
Get information about the active document.

```javascript
// Example: Get current document details
photoshop_get_document_info()
```

#### `photoshop_save_document`
Save the active document.

**Parameters:**
- `path` (string, required): Full path where to save
- `format` (string, optional): PSD, JPEG, or PNG (default: PSD)
- `quality` (number, optional): JPEG quality 1-12 (default: 8)

```javascript
// Example: Save as JPEG
photoshop_save_document({
  path: "/Users/username/Desktop/output.jpg",
  format: "JPEG",
  quality: 10
})
```

#### `photoshop_close_document`
Close the active document.

**Parameters:**
- `save` (boolean, optional): Save before closing (default: false)

```javascript
// Example: Close without saving
photoshop_close_document({ save: false })
```

### Layer Operations

#### `photoshop_create_layer`
Create a new layer.

**Parameters:**
- `name` (string, optional): Layer name

```javascript
// Example: Create a named layer
photoshop_create_layer({ name: "Background" })
```

#### `photoshop_delete_layer`
Delete the active layer.

```javascript
// Example: Delete current layer
photoshop_delete_layer()
```

#### `photoshop_create_text_layer`
Create a text layer.

**Parameters:**
- `text` (string, required): Text content
- `x` (number, optional): X position in pixels (default: 100)
- `y` (number, optional): Y position in pixels (default: 100)
- `fontSize` (number, optional): Font size in points (default: 24)
- `fontName` (string, optional): Font display or PostScript name (see `photoshop_list_fonts`)

```javascript
// Example: Create a text layer with Arial
photoshop_create_text_layer({
  text: "Hello World",
  x: 200,
  y: 150,
  fontSize: 48,
  fontName: "Arial"
})
```

#### `photoshop_fill_layer`
Fill the active layer with a solid color.

**Parameters:**
- `red` (number, required): Red component (0-255)
- `green` (number, required): Green component (0-255)
- `blue` (number, required): Blue component (0-255)

```javascript
// Example: Fill with blue
photoshop_fill_layer({
  red: 0,
  green: 100,
  blue: 255
})
```

#### `photoshop_get_layers`
Get list of all layers in the active document.

```javascript
// Example: List all layers
photoshop_get_layers()
```

#### `photoshop_set_layer_opacity`
Set the opacity of the active layer.

**Parameters:**
- `opacity` (number, required): Opacity value (0-100)

```javascript
// Example: Set opacity to 75%
photoshop_set_layer_opacity({ opacity: 75 })
```

#### `photoshop_set_layer_blend_mode`
Set the blend mode of the active layer.

**Parameters:**
- `blendMode` (string, required): Blend mode (NORMAL, MULTIPLY, SCREEN, OVERLAY, etc.)

```javascript
// Example: Set blend mode to multiply
photoshop_set_layer_blend_mode({ blendMode: "MULTIPLY" })
```

Available blend modes: NORMAL, DISSOLVE, DARKEN, MULTIPLY, COLORBURN, LINEARBURN, DARKERCOLOR, LIGHTEN, SCREEN, COLORDODGE, LINEARDODGE, LIGHTERCOLOR, OVERLAY, SOFTLIGHT, HARDLIGHT, VIVIDLIGHT, LINEARLIGHT, PINLIGHT, HARDMIX, DIFFERENCE, EXCLUSION, SUBTRACT, DIVIDE, HUE, SATURATION, COLOR, LUMINOSITY

#### `photoshop_set_layer_visibility`
Show or hide the active layer.

**Parameters:**
- `visible` (boolean, required): Visibility state

```javascript
// Example: Hide layer
photoshop_set_layer_visibility({ visible: false })
```

#### `photoshop_set_layer_locked`
Lock or unlock the active layer.

**Parameters:**
- `locked` (boolean, required): Lock state

```javascript
// Example: Lock layer
photoshop_set_layer_locked({ locked: true })
```

#### `photoshop_rename_layer`
Rename the active layer.

**Parameters:**
- `name` (string, required): New layer name

```javascript
// Example: Rename layer
photoshop_rename_layer({ name: "Hero Image" })
```

#### `photoshop_duplicate_layer`
Duplicate the active layer.

**Parameters:**
- `newName` (string, optional): Name for duplicated layer

```javascript
// Example: Duplicate layer with new name
photoshop_duplicate_layer({ newName: "Background Copy" })
```

#### `photoshop_merge_visible_layers`
Merge all visible layers into one.

```javascript
// Example: Merge visible layers
photoshop_merge_visible_layers()
```

#### `photoshop_flatten_image`
Flatten all layers into a single background layer.

```javascript
// Example: Flatten image
photoshop_flatten_image()
```

#### `photoshop_rasterize_layer`
Rasterize the active layer (convert text/smart object to normal layer).

```javascript
// Example: Rasterize layer
photoshop_rasterize_layer()
```

### Layer Ordering

#### `photoshop_move_layer_to_position`
Move the active layer relative to another layer.

**Parameters:**
- `targetLayerName` (string, required): Name of the reference layer
- `position` (string, required): ABOVE, BELOW, TOP, or BOTTOM

```javascript
// Example: Move layer above "Background"
photoshop_move_layer_to_position({
  targetLayerName: "Background",
  position: "ABOVE"
})
```

#### `photoshop_move_layer_to_top`
Move the active layer to the top of the layer stack.

```javascript
// Example: Move to top
photoshop_move_layer_to_top()
```

#### `photoshop_move_layer_to_bottom`
Move the active layer to the bottom of the layer stack.

```javascript
// Example: Move to bottom
photoshop_move_layer_to_bottom()
```

#### `photoshop_move_layer_up`
Move the active layer up one position.

```javascript
// Example: Move up
photoshop_move_layer_up()
```

#### `photoshop_move_layer_down`
Move the active layer down one position.

```javascript
// Example: Move down
photoshop_move_layer_down()
```

### Layer Transformations

#### `photoshop_fit_layer_to_document`
Scale the active layer to fit the document canvas while maintaining aspect ratio.

**Parameters:**
- `fillDocument` (boolean, optional): If true, fills entire canvas (may crop). If false, fits within canvas (may have margins). Default: false

```javascript
// Example: Fit layer within canvas
photoshop_fit_layer_to_document({ fillDocument: false })

// Example: Fill entire canvas (cropping if needed)
photoshop_fit_layer_to_document({ fillDocument: true })
```

#### `photoshop_scale_layer`
Scale the active layer by a percentage.

**Parameters:**
- `scalePercent` (number, required): Scale percentage (e.g., 50 for 50%, 200 for 200%)
- `centerAnchor` (boolean, optional): Scale from center (true) or top-left (false). Default: true

```javascript
// Example: Scale to 150%
photoshop_scale_layer({
  scalePercent: 150,
  centerAnchor: true
})
```

#### `photoshop_move_layer`
Move the active layer by specified offset.

**Parameters:**
- `deltaX` (number, required): Horizontal offset in pixels
- `deltaY` (number, required): Vertical offset in pixels

```javascript
// Example: Move layer 100px right and 50px down
photoshop_move_layer({
  deltaX: 100,
  deltaY: 50
})
```

#### `photoshop_rotate_layer`
Rotate the active layer.

**Parameters:**
- `degrees` (number, required): Rotation angle in degrees (positive = clockwise)

```javascript
// Example: Rotate 45 degrees clockwise
photoshop_rotate_layer({ degrees: 45 })
```

### Filters

#### `photoshop_apply_gaussian_blur`
Apply Gaussian Blur filter to the active layer.

**Parameters:**
- `radius` (number, required): Blur radius in pixels (0.1-250)

```javascript
// Example: Apply 10px blur
photoshop_apply_gaussian_blur({ radius: 10 })
```

#### `photoshop_apply_sharpen`
Apply Unsharp Mask (sharpen) filter.

**Parameters:**
- `amount` (number, required): Sharpening amount in percent (1-500)
- `radius` (number, required): Radius in pixels (0.1-250)
- `threshold` (number, optional): Threshold levels (0-255, default: 0)

```javascript
// Example: Sharpen image
photoshop_apply_sharpen({
  amount: 100,
  radius: 1.5,
  threshold: 0
})
```

#### `photoshop_apply_noise`
Apply Add Noise filter.

**Parameters:**
- `amount` (number, required): Noise amount in percent (0.1-400)
- `distribution` (string, optional): UNIFORM or GAUSSIAN (default: UNIFORM)
- `monochromatic` (boolean, optional): Monochromatic noise (default: false)

```javascript
// Example: Add noise
photoshop_apply_noise({
  amount: 10,
  distribution: "GAUSSIAN",
  monochromatic: false
})
```

#### `photoshop_apply_motion_blur`
Apply Motion Blur filter.

**Parameters:**
- `angle` (number, required): Blur angle in degrees (-360 to 360)
- `radius` (number, required): Blur distance in pixels (1-999)

```javascript
// Example: Apply motion blur
photoshop_apply_motion_blur({
  angle: 45,
  radius: 20
})
```

### Color Adjustments

#### `photoshop_adjust_brightness_contrast`
Adjust brightness and contrast.

**Parameters:**
- `brightness` (number, required): Brightness adjustment (-100 to 100)
- `contrast` (number, required): Contrast adjustment (-100 to 100)

```javascript
// Example: Increase brightness and contrast
photoshop_adjust_brightness_contrast({
  brightness: 20,
  contrast: 15
})
```

#### `photoshop_adjust_hue_saturation`
Adjust hue, saturation, and lightness.

**Parameters:**
- `hue` (number, required): Hue shift (-180 to 180)
- `saturation` (number, required): Saturation adjustment (-100 to 100)
- `lightness` (number, required): Lightness adjustment (-100 to 100)

```javascript
// Example: Adjust colors
photoshop_adjust_hue_saturation({
  hue: 30,
  saturation: 20,
  lightness: 0
})
```

#### `photoshop_auto_levels`
Apply auto levels adjustment.

```javascript
// Example: Auto levels
photoshop_auto_levels()
```

#### `photoshop_auto_contrast`
Apply auto contrast adjustment.

```javascript
// Example: Auto contrast
photoshop_auto_contrast()
```

#### `photoshop_adjust_curves`
Create a Curves adjustment layer on the active document.

**Parameters:**
- `preset` (string, optional): `auto_tone` (S-curve) or `neutral` (identity curve); default `auto_tone`

```javascript
// Example: Auto-tone S-curve
photoshop_adjust_curves({ preset: 'auto_tone' })
```

#### `photoshop_desaturate`
Desaturate the layer (convert to grayscale).

```javascript
// Example: Desaturate
photoshop_desaturate()
```

#### `photoshop_invert`
Invert colors of the layer.

```javascript
// Example: Invert colors
photoshop_invert()
```

### Text Formatting

#### `photoshop_list_fonts`
List installed fonts available to Photoshop. First call may be slow (`app.fonts` can exceed 1000 entries).

**Parameters:**
- `query` (string, optional): Substring filter (matches name, postScriptName, or family)
- `limit` (number, optional): Maximum fonts to return (default: 200)

**Returns:** `{ fonts: [{ name, postScriptName, family, style }], total, truncated }`

Use `postScriptName` when setting fonts manually via `execute_script`; `photoshop_set_text_font` and `photoshop_create_text_layer` resolve display names automatically.

```javascript
// Example: Find Arial variants
photoshop_list_fonts({ query: "Arial", limit: 20 })
```

#### `photoshop_set_text_font`
Set font family and size for active text layer. Accepts display name (e.g. `"Arial"`) or PostScript name (e.g. `"ArialMT"`).

**Parameters:**
- `fontName` (string, required): Font display or PostScript name (use `photoshop_list_fonts` to discover)
- `fontSize` (number, optional): Font size in points

```javascript
// Example: Change font
photoshop_set_text_font({
  fontName: "Helvetica",
  fontSize: 48
})
```

#### `photoshop_set_text_color`
Set color for active text layer.

**Parameters:**
- `red` (number, required): Red component (0-255)
- `green` (number, required): Green component (0-255)
- `blue` (number, required): Blue component (0-255)

```javascript
// Example: Set text to blue
photoshop_set_text_color({
  red: 0,
  green: 100,
  blue: 255
})
```

#### `photoshop_set_text_alignment`
Set text alignment.

**Parameters:**
- `alignment` (string, required): LEFT, CENTER, RIGHT, LEFTJUSTIFIED, CENTERJUSTIFIED, RIGHTJUSTIFIED, FULLYJUSTIFIED

```javascript
// Example: Center align text
photoshop_set_text_alignment({ alignment: "CENTER" })
```

#### `photoshop_update_text_content`
Update text content of active text layer.

**Parameters:**
- `text` (string, required): New text content

```javascript
// Example: Update text
photoshop_update_text_content({ text: "New Text" })
```

### Selections & Masks

#### `photoshop_select_rectangle`
Create a rectangular selection.

**Parameters:**
- `left`, `top`, `right`, `bottom` (number, required): Selection bounds in pixels

```javascript
// Example: Select area
photoshop_select_rectangle({
  left: 100,
  top: 100,
  right: 500,
  bottom: 400
})
```

#### `photoshop_select_all`
Select the entire document.

```javascript
// Example: Select all
photoshop_select_all()
```

#### `photoshop_deselect`
Clear all selections.

```javascript
// Example: Deselect
photoshop_deselect()
```

#### `photoshop_invert_selection`
Invert the current selection.

```javascript
// Example: Invert selection
photoshop_invert_selection()
```

#### `photoshop_create_layer_mask`
Create a layer mask from the current selection.

```javascript
// Example: Create mask
photoshop_create_layer_mask()
```

#### `photoshop_delete_layer_mask`
Delete the layer mask from active layer.

```javascript
// Example: Delete mask
photoshop_delete_layer_mask()
```

#### `photoshop_apply_layer_mask`
Apply (merge) the layer mask to the layer.

```javascript
// Example: Apply mask
photoshop_apply_layer_mask()
```

#### `photoshop_select_subject`
Run Select Subject on the active layer (pixel selection only, no mask). Requires Photoshop 23+.

**Parameters:**
- `sample_all_layers` (boolean, optional): Sample all layers for autoCutout fallback; default `false`

```javascript
// Example: Select the main subject
photoshop_select_subject()
```

#### `photoshop_content_aware_fill`
Fill the current pixel selection using Content-Aware Fill. Requires an active selection.

```javascript
// Example: Remove selected distraction
photoshop_content_aware_fill()
```

#### `photoshop_apply_gradient_mask`
Apply a linear black-to-white gradient on the active layer mask (fade/blend).

**Parameters:**
- `direction` (string, optional): Fade direction — `bottom_to_top`, `top_to_bottom`, `left_to_right`, `right_to_left`; default `bottom_to_top`
- `start_pct` (number, optional): Gradient start along fade axis (0–100); default `0`
- `end_pct` (number, optional): Gradient end along fade axis (0–100); default `100`
- `angle_deg` (number, optional): Override gradient angle in degrees

```javascript
// Example: Fade subject into background from bottom
photoshop_apply_gradient_mask({
  direction: 'bottom_to_top',
  start_pct: 0,
  end_pct: 100
})
```

### History & Undo/Redo

#### `photoshop_undo`
Undo the last operation(s) - equivalent to Ctrl/Cmd+Z.

**Parameters:**
- `steps` (number, optional): Number of steps to undo (default: 1)

```javascript
// Example: Undo last operation
photoshop_undo()

// Example: Undo last 3 operations
photoshop_undo({ steps: 3 })
```

#### `photoshop_redo`
Redo previously undone operation(s) - equivalent to Ctrl/Cmd+Shift+Z.

**Parameters:**
- `steps` (number, optional): Number of steps to redo (default: 1)

```javascript
// Example: Redo last undone operation
photoshop_redo()

// Example: Redo last 2 undone operations
photoshop_redo({ steps: 2 })
```

#### `photoshop_get_history`
Get the history states of the active document.

```javascript
// Example: View history
photoshop_get_history()
```

### Actions & Automation

#### `photoshop_play_action`
Play a recorded action from the Actions palette.

**Parameters:**
- `actionName` (string, required): Action name
- `actionSetName` (string, required): Action set name

```javascript
// Example: Play action
photoshop_play_action({
  actionName: "My Action",
  actionSetName: "Default Actions"
})
```

#### `photoshop_execute_script`
Execute custom ExtendScript code (advanced).

**Parameters:**
- `code` (string, required): ExtendScript code

```javascript
// Example: Execute custom code
photoshop_execute_script({
  code: "app.beep();"
})
```

### Image Manipulation

#### `photoshop_resize_image`
Resize the active image.

**Parameters:**
- `width` (number, required): New width in pixels
- `height` (number, required): New height in pixels

```javascript
// Example: Resize to Instagram post size
photoshop_resize_image({
  width: 1080,
  height: 1080
})
```

#### `photoshop_crop_document`
Crop the document to specified bounds.

**Parameters:**
- `left` (number, required): Left edge in pixels
- `top` (number, required): Top edge in pixels
- `right` (number, required): Right edge in pixels
- `bottom` (number, required): Bottom edge in pixels

```javascript
// Example: Crop document
photoshop_crop_document({
  left: 100,
  top: 100,
  right: 1820,
  bottom: 980
})
```

#### `photoshop_place_image`
Place an image file as a layer in the active document.

**Parameters:**
- `filePath` (string, required): Full path to the image file
- `x` (number, optional): X position offset in pixels (default: 0)
- `y` (number, optional): Y position offset in pixels (default: 0)

```javascript
// Example: Place an image at specific position
photoshop_place_image({
  filePath: "/Users/username/Pictures/photo.jpg",
  x: 100,
  y: 200
})
```

#### `photoshop_open_image`
Open an image file as a new document.

**Parameters:**
- `filePath` (string, required): Full path to the image file

```javascript
// Example: Open an image
photoshop_open_image({
  filePath: "/Users/username/Pictures/photo.jpg"
})
```

## Context Tracking

Each tool returns comprehensive context information about the current state of Photoshop, including:

- **Document Info**: Name, dimensions, resolution, color mode, layer count
- **Active Layer Info**: Name, type, opacity, blend mode, visibility, lock state
- **Selection State**: Whether a selection is active
- **Operation Result**: Specific details about what was changed

This allows AI assistants to maintain awareness of:
- Which document is active
- Which layer is being worked on
- Current layer properties (opacity, blend mode, etc.)
- Document dimensions and settings

**Example Response:**
```javascript
{
  "applied": true,
  "filter": "Gaussian Blur",
  "radius": 10,
  "wasRasterized": true,
  "context": {
    "hasDocument": true,
    "document": {
      "name": "design.psd",
      "width": 1920,
      "height": 1080,
      "resolution": 72,
      "colorMode": "RGBColorMode",
      "layerCount": 3,
      "hasSelection": false
    },
    "activeLayer": {
      "name": "Background",
      "kind": "NORMAL",
      "opacity": 100,
      "blendMode": "NORMAL",
      "visible": true,
      "locked": false,
      "isBackground": false
    }
  }
}
```

This context helps AI assistants remember what document and layer they're working on across multiple commands.

---

## Platform-Specific Notes

### Windows

- Uses COM automation to communicate with Photoshop
- Registry-based auto-detection for installation paths
- Supports both 32-bit and 64-bit versions

### macOS

- Uses AppleScript/OSA for Photoshop communication
- Spotlight-based auto-detection
- Supports multiple Photoshop versions installed simultaneously
- **CLI account auth** (standalone UI) is macOS-first: run `claude auth login` /
  `gemini auth login` in Terminal; credentials live under `~/.claude/` and
  `~/.gemini/`

## Supported Photoshop Versions

- **All Photoshop versions** (2012-2025+): Uses ExtendScript API via AppleScript (macOS) or COM (Windows)

**Important Note**: While Photoshop 2022+ supports UXP for plugins, external automation via AppleScript/COM can only use ExtendScript. UXP is designed for internal plugins and cannot be invoked from external scripts. Therefore, this MCP server uses ExtendScript for maximum compatibility across all Photoshop versions.

## Troubleshooting

Common issues when connecting to or scripting Photoshop through the MCP server.


### "Photoshop not found"

1. Make sure Photoshop is installed in the default location
2. Or set `PHOTOSHOP_PATH` environment variable to custom installation path

```json
{
  "env": {
    "PHOTOSHOP_PATH": "C:\Custom\Path\Adobe Photoshop 2025\Photoshop.exe"
  }
}
```

### "Failed to connect to Photoshop"

1. Ensure Photoshop is running (the server will try to launch it if not)
2. Check that scripting is enabled in Photoshop preferences
3. On Windows, verify COM automation is not blocked by security settings

### "Script execution timeout"

- Some operations may take longer on large documents
- The default timeout is 30 seconds
- For complex operations, consider breaking them into smaller steps

### Debug Logging

Enable detailed logging by setting `LOG_LEVEL=0`:

```json
{
  "env": {
    "LOG_LEVEL": "0"
  }
}
```

## Standalone UI — CLI account auth

| Symptom | Likely cause | Fix |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLI not installed | `npm i -g @anthropic-ai/claude-code` or `npm i -g @google/gemini-cli` |
| `not_authenticated` | No OAuth session | Run `claude auth login` or `gemini auth login` in Terminal |
| `claude` / `gemini` not on `PATH` | Custom install location | Settings → **CLI path** → **Check connection** |
| Chat works in IDE but not UI (CLI mode) | OAuth tokens are CLI-only | Use **CLI account** in UI; API keys and CLI sessions are separate |
| Gemini multi-turn feels forgetful | Headless CLI may start a fresh session each turn | Known limitation; history is prepended to the prompt (MVP) |


## Development

Build, lint, and test the photoshop-mcp server locally.

### From Source

```bash
git clone https://github.com/alisaitteke/photoshop-mcp.git
cd photoshop-mcp
npm install
npm run build
```

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Lint & Format

```bash
npm run lint
npm run format
```

### Integration tests (requires running Photoshop)

```bash
npm run build:server
npm run spike:issue-2     # issue #2 targeted regression (10 checks)
npm run test:mcp-local    # prompt-layer smoke
npm run test:mcp-all      # full sequential tool sweep
npm run verify:photoshop-prompts
```

### Integration test results

Local MCP integration tests run against a live Photoshop instance over stdio
(same path as Cursor / Claude Desktop). Last verified on **Photoshop 26.5.0**
(macOS).

*Recorded on PS 26.5.0 (macOS) after issue #2 fixes and Phase 2 test harness — re-run `npm run test:mcp-all` to refresh.*

| Suite | Command | Result |
|-------|---------|--------|
| Issue #2 regression | `npm run spike:issue-2` | Targeted checks (metadata, layers, place, Smart Object transform, jsString escapes, fonts, alert, CJK names) |
| Full tool + recipe sweep | `npm run test:mcp-all` | **119 pass**, **0 fail**, **4 skip** (123 total) |
| Prompt-layer smoke | `npm run test:mcp-local` | 16 prompt templates + core recipes |
| Prompt ↔ recipe parity | `npm run verify:photoshop-prompts` | 12↔12 strict match + 4 guides |

**Tool coverage:** 80 total tools (68 atomic `photoshop_*` + 12 recipe
`photoshop_recipe_*`) — re-run `npm run test:mcp-all` for a fresh pass count.

**Intentional skips** (environment-dependent, not regressions):

| Tool | Reason |
|------|--------|
| `photoshop_play_action` | Requires a real Actions palette entry on the machine |
| `photoshop_select_subject` | Requires a recognizable subject in the active layer |
| `photoshop_recipe_remove_background` | Synthetic test canvas has no recognizable subject for Select Subject |
| `photoshop_recipe_batch_mockup_replace` | Requires a Smart Object mockup PSD |

**PS 26 compatibility notes** (ExtendScript): layer masks use `stringID make`;
mask apply uses `delete` + `apply: true`; hue/saturation uses `Hst2` descriptors;
frequency separation uses `applyImageEvent` calculation descriptors. See
[`src/api/extendscript.ts`](src/api/extendscript.ts) and
[`src/tools/recipes/_shared.ts`](src/tools/recipes/_shared.ts).

Prerequisites: Photoshop installed and scriptable; run from the repo root after
`npm run build:server`.

### Usage Examples

Prompt the AI assistant in natural language — the MCP server picks the right tools.

#### Create a Simple Design

> Create an 800×600 RGB document, add a light blue background layer, center the text "My Design" at 64pt, then save as `design.psd` on the Desktop.

#### Batch Process Images

> Open my image, resize to 1920×1080, save as a high-quality JPEG to the Desktop, then close without saving the PSD.

#### Design with Stock Images (Pexels)

Combine with a [Pexels MCP server](https://github.com/modelcontextprotocol/servers) if configured:

> Search Pexels for "nature landscape", place the downloaded photo in a 1920×1080 document, fit to fill the canvas, add "Beautiful Nature" as overlay text at the top, save as `nature-design.psd`.

### Quick Start Examples

#### Common Use Cases

| Task | Prompt Example |
|------|----------------|
| **Basic Design** | "Create 1920x1080 document, add blue background, center text 'Hello'" |
| **Photo Edit** | "Open photo.jpg, apply auto levels, sharpen 100%, save as edited.jpg" |
| **Stock Image** | "Place image.jpg, fit to fill canvas, add overlay text 'Summer 2026'" |
| **Layer Effects** | "Set active layer blend mode to MULTIPLY, opacity 80%" |
| **Filters** | "Apply 10px Gaussian blur to current layer" |
| **Text Styling** | "Change text to Helvetica 64pt, color red, center aligned" |
| **Batch Work** | "Resize to 1080x1080, auto contrast, save as square.jpg, close" |
| **Masks** | "Select rectangle 100,100 to 500,500, create layer mask" |
| **Portrait recipe** | "Enhance portrait at medium intensity with skin smoothing, then preview" |
| **Background removal** | "Remove background from active layer, 2px feather, non-destructive mask" |
| **Web export** | "Prepare for web + export Instagram and X post variants to exports folder" |
| **Color grade** | "Apply warm_film color grade as adjustment layers" |
| **Frequency separation** | "Build FS stack at 6px — I'll paint the Low/High layers myself" |
| **State check** | "Ping Photoshop, get capabilities, then get_state before editing" |


## Architecture

Repository layout and module responsibilities.


```
photoshop-mcp/
├── src/
│   ├── core/              # MCP server core
│   │   ├── server.ts      # Main MCP server
│   │   ├── session.ts     # Session management
│   │   └── tool-registry.ts  # Tool registration system
│   ├── platform/          # Platform-specific detection & execution
│   │   ├── detector.ts    # Main detector
│   │   ├── connection.ts  # Connection manager
│   │   ├── windows-detector.ts  # Windows registry detection
│   │   ├── windows-executor.ts  # Windows COM automation
│   │   ├── macos-detector.ts    # macOS Spotlight detection
│   │   └── macos-executor.ts    # macOS AppleScript execution
│   ├── api/              # Photoshop API abstractions
│   │   ├── photoshop-api.ts    # API factory
│   │   ├── batch-play.ts       # UXP batchPlay helpers (legacy)
│   │   └── extendscript.ts     # ExtendScript snippets library
│   ├── tools/            # MCP tool implementations (80 tools: 68 atomic + 12 recipe)
│   │   ├── document-tools.ts        # Document operations
│   │   ├── layer-tools.ts           # Layer creation/deletion
│   │   ├── layer-properties-tools.ts # Opacity, blend modes, etc.
│   │   ├── layer-transform-tools.ts  # Scale, rotate, move
│   │   ├── image-tools.ts           # Resize, crop
│   │   ├── image-placement-tools.ts # Place/open images
│   │   ├── filter-tools.ts          # Blur, sharpen, noise
│   │   ├── adjustment-tools.ts      # Color adjustments
│   │   ├── text-tools.ts            # Text formatting
│   │   ├── selection-tools.ts       # Selections & subject isolation
│   │   ├── mask-tools.ts            # Gradient mask blending
│   │   ├── state-tools.ts           # State, preview, capabilities
│   │   ├── action-tools.ts          # Actions & custom scripts
│   │   └── recipes/                 # 12 outcome-oriented recipe tools
│   └── utils/            # Utilities
│       └── logger.ts     # Logging system (stderr-based)
└── examples/             # Configuration examples
    ├── cursor-config.json
    └── claude-desktop-config.json
```


## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## License

MIT

## Anonymous Usage Analytics

This project collects **anonymous, aggregated usage events** to understand how the
MCP server and standalone UI are used and to improve the product. Analytics are
**enabled by default** and can be turned off at any time.


### What we collect

- App version, operating system (platform, type, release), CPU count, memory tier
  (bucketed GB), Node.js version, launch method, system locale/timezone, and whether
  optional env overrides are configured (flags only — never paths or values)
- **MCP-only usage** (no UI required): session lifecycle, virtual page views,
  Photoshop connection status, **batched** tool usage summaries (tool names and
  counts per agent turn — never arguments or results), and prompt template names
  when requested
- **UI server** startup and setup funnel events (provider chosen, auth method,
  validation success/failure codes — not credentials)
- **Browser UI** events (app loaded, onboarding completed, page views on route
  changes)

Events use a random anonymous identifier stored locally at
`~/.photoshop-mcp/` (SQLite `kv` table and/or `analytics-store.json`). That ID
is registered with PostHog via `identify()` so MCP, UI server, and browser
events merge under one anonymous person per install (`person_profiles:
identified_only` — no email, name, or other PII).

The person profile also stores **total installed RAM (GB)** and the **detected
Photoshop version** when available, so cohort reports can segment by hardware
and Photoshop release without repeating those fields on every event.

Country/region signals come from PostHog GeoIP on outbound requests (when enabled)
and from `system_locale_region` / `browser_locale_region` as a secondary hint.

### MCP events

When you run `photoshop-mcp` directly (e.g. via Cursor MCP config), these events
are sent:

| Event | When | Key properties |
| --- | --- | --- |
| `$pageview` | MCP session start | Virtual URL `photoshop-mcp://mcp`, `usage_surface: mcp` |
| `mcp_session_started` | MCP session start | `app_version`, `photoshop_detected`, `tools_registered_count` |
| `mcp_session_startup_failed` | Startup error | `ok: false`, `error_code` |
| `mcp_photoshop_connection` | Initial connect or failed reconnect | `ok`, `photoshop_connected`, `error_code?` |
| `mcp_tool_batch` | After 30s idle or session end | `tools_called_count`, `tools_error_count`, `unique_tools_count`, `tool_usage_summary`, `error_codes_summary?`, `batch_flush_reason` |
| `mcp_prompt_requested` | Prompt template fetch | `prompt_name` |
| `$pageleave` | Graceful shutdown (SIGINT/SIGTERM/stdio close) | `duration_ms`, `shutdown_reason` |
| `mcp_session_ended` | Graceful shutdown | `duration_ms`, `shutdown_reason` |

Tool usage is **not** sent per call. Calls are aggregated in memory and flushed as
`mcp_tool_batch` when the MCP client goes idle for 30 seconds (proxy for end of an
agent turn) or when the session ends.

MCP-only installs appear in PostHog Web Analytics via the virtual `$pageview` at
`photoshop-mcp://mcp`, even when the standalone UI is never opened.

### What we do **not** collect (unless you opt into beta team sharing)

- API keys or OAuth tokens
- Chat messages, prompts, or model responses **by default**
- Photoshop document or layer names, file paths, or image content
- CLI account labels, email addresses, or other account identifiers
- Tool call **arguments** or **results** (MCP logs tool **names** only)

### Beta team content sharing (opt-in)

On first launch of the standalone UI, you are asked whether you want to **join the
beta team**. This is separate from anonymous usage analytics above.

If you accept:

- Your **prompts**, **assistant responses**, **reasoning text**, and **tool names**
  (not arguments or results) may be sent to PostHog after each chat turn
- Content is truncated for very long messages
- Requires anonymous analytics to remain enabled

If you decline, no chat content is logged. You can change this later in
**Settings → General → Privacy → Beta team content sharing**.

Existing installs that have not answered yet are prompted once on the next launch.

### Processor and hosting

Analytics are processed by [PostHog](https://posthog.com/). Events are sent to a
managed reverse proxy at `https://a.alisait.com`; the PostHog project UI is
hosted in the EU (`https://eu.posthog.com`). See the
[PostHog privacy policy](https://posthog.com/privacy) for how PostHog handles
data on their side.

#### GeoIP and the reverse proxy

PostHog enriches server-side events with `$geoip_country_code` from the client IP
when GeoIP is enabled (`disableGeoip: false` in `posthog-node`). The reverse proxy
at `https://a.alisait.com` **must forward the end-user IP** (e.g. via
`X-Forwarded-For` / `X-Real-IP`) to PostHog ingest. If all MCP users appear in one
country, fix proxy headers before investigating application code.

### PostHog dashboard recipes (maintainers)

| Insight | Configuration |
| --- | --- |
| MCP active users | `$pageview` where `$current_url = photoshop-mcp://mcp` |
| Country breakdown | Breakdown by `$geoip_country_code` on `mcp_tool_batch` or `$pageview` |
| Tool error rate | `mcp_tool_batch` where `tools_error_count > 0`, breakdown by `error_codes_summary` |
| Photoshop reachability | `mcp_photoshop_connection` where `ok = false` |
| Session duration | Average `duration_ms` on `mcp_session_ended` |
| MCP vs UI usage | Person property `usage_surface` or filter `event_source = mcp` |

### How to opt out

1. **Standalone UI:** Settings → General → Privacy → set **Anonymous usage
   analytics** to **Off** (also disables beta content sharing).
2. **Beta content only:** Settings → General → Privacy → set **Beta team content
   sharing** to **Off** (anonymous analytics can stay on).
3. **Environment variable:** set `POSTHOG_DISABLED=1` before starting
   `photoshop-mcp` or `photoshop-mcp-ui` (disables all analytics for that
   process and persists opt-out in local storage).


## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Inspired by the Adobe Photoshop scripting community
