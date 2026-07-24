# AI / Prompt Layer for Photoshop

The photoshop-mcp server exposes 74 atomic `photoshop_*` tools plus 15 recipe
`photoshop_recipe_*` tools (89 total), along with a thin
AI/prompt layer ported from TTT: server-level instructions, MCP prompt templates,
recipe tools, state/preview tools, version-aware capabilities, and structured
error envelopes.

## 1. Server `instructions`

Source: [`src/prompts/instructions.ts`](../src/prompts/instructions.ts)

Advertised on MCP `initialize`. Covers session bootstrap, recipe-over-atomic
selection, user intent glossary, degrade paths, disambiguation, guide vs recipe
prompt discovery, `~/.photoshop-mcp/exports` conventions, and error recovery contract.

## 2. MCP `prompts` primitive

Twenty-two templates in [`src/prompts/templates/`](../src/prompts/templates/), registered via
[`src/prompts/registry.ts`](../src/prompts/registry.ts).

### Recipe prompts (15 — 1:1 with `photoshop_recipe_*`)

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
| `ps.split_carousel` | `photoshop_recipe_split_carousel` |
| `ps.batch_watermark` | `photoshop_recipe_batch_watermark` |
| `ps.passport_photo` | `photoshop_recipe_passport_photo` |

### Guide prompts (7 — no recipe pair)

| Prompt | Purpose |
|--------|---------|
| `ps.gradient_blend` | Fade subject into background via mask gradient (atomic chain) |
| `ps.color_correct` | Tone / contrast fix chain |
| `ps.dodge_burn_guide` | 50% gray overlay retouch setup |
| `ps.composite_blend` | Place asset + mask + blend mode |
| `ps.generative_fill` | Firefly generative fill workflow |
| `ps.generative_remove` | AI Remove workflow |
| `ps.generative_expand` | Generative Expand workflow |

Each template uses arg coercion helpers from [`src/prompts/_shared.ts`](../src/prompts/_shared.ts)
and returns a `GetPromptResult` with `description` + structured Goal/Plan/End state text
(guide prompts also include an Intent line).

## 3. Recipe tools

Fifteen recipes in [`src/tools/recipes/`](../src/tools/recipes/), sharing
[`src/tools/recipes/_shared.ts`](../src/tools/recipes/_shared.ts) (`executeRecipe`,
`executeStandaloneRecipe`, `suspendHistory`, uniform `{ ok, summary, ... }` envelope).

Export recipes write to `~/.photoshop-mcp/exports` (or `~/.photoshop-mcp/exports/<chat-id>`
when the standalone UI passes `PHOTOSHOP_EXPORT_CHAT_ID` to the MCP child).

## 4. State & preview tools

| Tool | File |
|------|------|
| `photoshop_get_state` | [`src/tools/state-tools.ts`](../src/tools/state-tools.ts) |
| `photoshop_get_preview` | same |
| `photoshop_get_capabilities` | same |

## 5. Verification

```bash
npm run verify:photoshop-prompts
```

Strict **15↔15** recipe/prompt parity plus separate guide prompt registration check.

## Backwards compatibility

All original `photoshop_*` tool names and schemas are unchanged; this expansion
added 4 atomics + 4 recipes + 8 prompt templates (additive only).
