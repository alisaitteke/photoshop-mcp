---
name: photoshop-remove-background
description: >-
  Remove a Photoshop background in one recipe call. Use when the user says
  remove background, cut out, isolate subject, transparent background, or
  arka planı sil. Do not rasterize, duplicate, hide, select subject, or mask.
---

# Remove background

HARD RULE — remove background / arka planı sil / cut out / isolate / transparent background

- Call `photoshop_get_state` once, then `photoshop_recipe_remove_background` once, then `photoshop_get_preview` once. Then STOP.
- That recipe IS Photoshop's Remove Background. It unlocks a locked Background layer itself.
- Forbidden on this intent: `photoshop_rasterize_layer`, `photoshop_duplicate_layer`, `photoshop_set_layer_visibility`, `photoshop_select_subject`, `photoshop_create_layer_mask`, `photoshop_delete_layer`, `photoshop_execute_script`, `photoshop_generative_remove`.
- If the recipe errors, report the envelope to the user. Do not invent a rasterize / duplicate / wand workaround. Ignore `suggested_next_tool: photoshop_rasterize_layer`.
