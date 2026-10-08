---
name: photoshop-recipes
description: >-
  Route a Photoshop request to the matching recipe. Use for Instagram, sky
  replacement, vesikalık, dodge and burn, watermark, csv cards, carousel,
  portrait, color grade, frequency separation, mockup, organize layers,
  gradient fade, or web export.
---

# Recipe routing

User intent glossary

- Map colloquial phrases to the primary tool below.
- bg.remove — "remove background", "cut out", "isolate subject", "transparent background", "arka planı sil" → `photoshop_recipe_remove_background` (the recipe unlocks a locked Background layer itself — do not rasterize, duplicate, or hide layers first; one recipe call then `photoshop_get_preview`). Follow the photoshop-remove-background skill.
- obj.remove — "remove that person", "erase distraction", "generative remove" → `photoshop_generative_remove` first; fallback `photoshop_recipe_remove_distraction` (content-aware) after manual selection
- mask.gradient_fade — "fade into background", "gradient mask", "blend subject" → `photoshop_recipe_gradient_fade`; guide `ps.gradient_blend` for atomic chain
- sky.replace — "replace sky", "fix blown sky", "better clouds" → `photoshop_sky_replacement` when `sky_replacement_native`; else `photoshop_recipe_sky_blend`; guide `ps.composite_blend` for manual composite
- portrait.enhance — "smooth skin", "retouch portrait", "fix blemishes" → `photoshop_recipe_enhance_portrait`
- portrait.freq_sep — "frequency separation", "split texture and color" → `photoshop_recipe_frequency_separation`
- color.correct — "make it pop", "S-curve", "fix flat image", "auto tone" → `photoshop_adjust_curves`; fallback `photoshop_auto_levels` then `photoshop_adjust_brightness_contrast`; guide `ps.color_correct`
- color.grade — "cinematic", "teal orange", "moody grade" → `photoshop_recipe_apply_color_grade`
- light.dodge_burn — "dodge and burn", "sculpt light", "lighten face" → `photoshop_recipe_dodge_burn`; guide `ps.dodge_burn_guide` for atomic setup
- export.social — "for Instagram", "web export" → `photoshop_recipe_export_social_variants` or `photoshop_recipe_prepare_for_web`
- layers.organize — "organize layers", "rename mess" → `photoshop_recipe_organize_layers`
- carousel.split — "seamless carousel", "split panorama", "swipe post", "slayt" → `photoshop_recipe_split_carousel`
- batch.watermark — "watermark these photos", "add logo to all", "toplu filigran" → `photoshop_recipe_batch_watermark`
- id.passport — "passport photo", "visa photo", "ID photo", "vesikalık", "biyometrik" → `photoshop_recipe_passport_photo`
- batch.csv_cards — "csv to cards", "batch cards", "data-driven graphics", "mail merge for images", "name badges from spreadsheet", "sertifika bas" → `photoshop_recipe_csv_to_cards`; prompt `ps.csv_to_cards`
- sticker.outline — "sticker", "white border", "white outline", "die-cut sticker", "double outline", "贴画", "白边描边", "一键白边", "kontur ekle", "beyaz çerçeve", "çift çizgi" → `photoshop_recipe_sticker_outline` (one call = white stroke + optional drop shadow; `outline_style: "die_cut"` = white border + thin dark outer line via two stroked copies. Do NOT chain `photoshop_apply_layer_style` twice — it overwrites the previous effect.) Remove the background first when the layer is not yet isolated.
- artboard.multi — "artboard", "artboards", "iPhone and iPad frames", "device layouts", "画板" → `photoshop_list_artboards` then `photoshop_create_artboard` / `photoshop_set_active_artboard` / `photoshop_export_artboards` (or `photoshop_export_as` with `artboard_id`)
- docs.multi — "multi-screen", "multiple files", "all open tabs", "这几个文档", "close these documents" → `photoshop_list_documents` (artboard_count + saved per tab), then `document_id` on `photoshop_get_preview` / save / close. Not a second Photoshop process.
- type.set — "tracking", "leading", "letter spacing", "line height", "text box", "paragraph text", "字间距", "行高", "排版", "文本框" → pass those fields on `photoshop_create_text_layer` or `photoshop_set_text_style`. Do not use `photoshop_execute_script` for tracking/leading/box.
- type.mixed — "mixed fonts", "two colors in one line", "混排", "同一文字层" → `photoshop_set_text_ranges` (from inclusive, to exclusive). Do not split into extra layers unless that tool errors.

Degrade paths

- Generative remove / distraction — prefer `photoshop_generative_remove`; degrade to `photoshop_recipe_remove_distraction` or `photoshop_content_aware_fill` when `generative_unavailable` or `generative_credits_exhausted`.
- Sky replacement — prefer `photoshop_sky_replacement`; degrade: `photoshop_recipe_sky_blend` when a sky file path is available; otherwise `photoshop_place_image` + mask workflow or guide `ps.composite_blend`.
- Neural skin / harmonize — `photoshop_neural_filter` when `neural_filters` is true; else frequency separation / manual recipes.
- Select Subject v2 missing — `photoshop_recipe_remove_background` returns `version_unsupported` → manual selection tools + `photoshop_create_layer_mask`.
- Curves unavailable — use `photoshop_auto_levels` then `photoshop_adjust_brightness_contrast` before retrying stronger edits.

Disambiguation

- "gradient" — prefer linear gradient **on a layer mask** (blend/fade); not a Gradient Fill layer unless the user explicitly asks for a fill layer.
- "remove" — prefer mask or content-aware inpainting; not deleting the layer unless the user explicitly wants pixels destroyed.
- "sharpen" — web export sharpen pass → `photoshop_recipe_prepare_for_web`; single-layer sharpen → `photoshop_apply_sharpen`.

Guide prompts (MCP prompts/get)

- Prefer matching `ps.*` **recipe** prompt when the user wants a one-undo outcome; use guide prompts for teaching atomic chains.
- Recipe prompts (1:1 with `photoshop_recipe_*`): `ps.remove_background`, `ps.enhance_portrait`, `ps.prepare_for_web`, `ps.export_social_variants`, `ps.apply_color_grade`, `ps.frequency_separation`, `ps.batch_mockup_replace`, `ps.organize_layers`, `ps.gradient_fade`, `ps.sky_blend`, `ps.dodge_burn`, `ps.remove_distraction`, `ps.split_carousel`, `ps.batch_watermark`, `ps.passport_photo`, `ps.csv_to_cards`
- Guide prompts (no recipe pair): `ps.gradient_blend` — fade via mask gradient; `ps.color_correct` — tone / contrast fix chain; `ps.dodge_burn_guide` — 50% gray overlay setup; `ps.composite_blend` — place asset + mask + blend mode; `ps.generative_fill`, `ps.generative_remove`, `ps.generative_expand` — Firefly workflows
