# Available Tools

**128 tools total** — 111 atomic `photoshop_*` tools plus 17 recipe `photoshop_recipe_*` workflows (single undo step each).

Reference for all atomic `photoshop_*` MCP tools exposed by this server (parameters, examples, and return shapes).

← Back to [README](../README.md)

### Connection & Info

#### `photoshop_ping`
Run a short script in Photoshop. Success means the scripting engine is idle. While a previous script is still running, the call returns `extendscript_timeout` instead of succeeding; retry ping before `photoshop_get_state` or `photoshop_get_layers`. If the OS drive has under 10 GB free, a timeout is reported as `scratch_disk_full` instead. Does not launch Photoshop when it is not running.

```javascript
// Example: Check if Photoshop is accessible
photoshop_ping()
```

On by default. 15 minutes after the first successful ping (and again after a 7-day cooldown if unanswered), a later successful ping may append a `FEEDBACK_NUDGE` block. Host agents must ask in the user's conversation language (never default to English), in first person (as if they will improve the MCP themselves — they must not start implementing), then call `photoshop_submit_feedback`, then continue the original request. Set `PSMCP_FEEDBACK=0` (or turn off MCPB **Product feedback prompts**) to skip the question.

When a newer `@alisaitteke/photoshop-mcp` release is on npm, a successful ping may instead append an `UPDATE_AVAILABLE` block with the installed and latest versions and one update step for how this copy was installed (npx, MCPB, global npm, or a git checkout). The server looks up the latest version in the background at most once a day and caches it in `~/.photoshop-mcp/update-check.json`, so ping never waits on the network. The notice is shown at most once every 7 days. Host agents mention it in one sentence in the user's language, do not ask a question or run the update, and continue the original request. A ping carries at most one of `UPDATE_AVAILABLE` / `FEEDBACK_NUDGE`. Set `PSMCP_UPDATE_CHECK=0` (or turn off MCPB **Update notices**) to disable it; `NO_UPDATE_NOTIFIER` and `CI` also disable it.

#### `photoshop_submit_feedback`
Record the user's answer to a product-feedback nudge from `photoshop_ping`.

**Parameters:**
- `choice` (string, required): `yes`, `not_now`, or `dont_ask`
- `suggestion` (string, optional): short feature request when `choice` is `yes`

```javascript
photoshop_submit_feedback({
  choice: 'yes',
  suggestion: 'batch rename layers from a CSV'
})
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

#### `photoshop_list_documents`
List all open documents with id, name, dimensions, resolution, `saved`, `artboard_count`, and active-tab flag. Briefly activates each tab to count artboards, then restores the original active document.

**Parameters:** none

```javascript
// Example: Discover document_id values before switching tabs
photoshop_list_documents()
```

#### `photoshop_set_active_document`
Switch the active document tab. Provide exactly one identifier.

**Parameters:**
- `document_id` (number, optional): Unique id from `photoshop_list_documents` (preferred)
- `index` (number, optional): Zero-based tab order (leftmost is 0)
- `document_name` (string, optional): Document name (ambiguous if multiple tabs share the name)

```javascript
// Example: Activate by unique id
photoshop_set_active_document({ document_id: 42 })

// Example: Activate leftmost tab
photoshop_set_active_document({ index: 0 })
```

Mutating tools (and most document-scoped reads) also accept `document_id`. Pass the id from `photoshop_get_state` / `photoshop_list_documents` so a Photoshop UI tab switch cannot retarget the edit. Omitted, `null`, and `0` use the active document. A positive unknown id fails with `document_not_found` when another document is open. When nothing is open, a stale id does not block the call. `photoshop_create_document` and `photoshop_open_image` ignore `document_id`.

#### `photoshop_list_artboards`
List artboards in the active document (id, name, pixel bounds, `is_active`). Empty when the file is a regular canvas.

```javascript
photoshop_list_artboards()
```

#### `photoshop_create_artboard`
Create an artboard. First artboard converts a regular document. Additional boards are placed 32px to the right unless `left`/`top` are set.

**Parameters:**
- `width` / `height` (number, required): size in pixels
- `name` (string, optional)
- `left` / `top` (number, optional): origin in pixels

```javascript
photoshop_create_artboard({ name: "iPhone", width: 390, height: 844 })
photoshop_create_artboard({ name: "iPad", width: 768, height: 1024 })
```

#### `photoshop_set_active_artboard`
Select an artboard by `artboard_id` (preferred) or unique `name`.

```javascript
photoshop_set_active_artboard({ artboard_id: 12 })
```

#### `photoshop_export_artboards`
Export every artboard to a folder (duplicate + crop). Uses a 600s script timeout.

**Parameters:**
- `folder` (string, required): absolute output directory
- `format` (string, optional): PNG, JPEG, WEBP, AVIF
- `quality` (number, optional): 0–100

```javascript
photoshop_export_artboards({ folder: "/tmp/boards", format: "PNG" })
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
Close a document tab. Defaults to the active document; pass `document_id` from `photoshop_list_documents` to close a specific file.

**Parameters:**
- `save` (boolean, optional): Save before closing (default: false)
- `document_id` (number, optional): Close that open document instead of the front tab

```javascript
// Example: Close without saving
photoshop_close_document({ save: false })
photoshop_close_document({ save: false, document_id: 42 })
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
Create a text layer. Optional typography fields avoid a follow-up `execute_script`.

**Parameters:**
- `text` (string, required): Text content
- `x` (number, optional): X position in pixels (default: 100)
- `y` (number, optional): Y position in pixels (default: 100)
- `fontSize` (number, optional): Font size in points (default: 24)
- `fontName` (string, optional): Font display or PostScript name (see `photoshop_list_fonts`)
- `tracking` (number, optional): Character spacing in 1/1000 em (−1000 to 10000)
- `leading` (number, optional): Line height in points
- `auto_leading` (boolean, optional): Photoshop auto leading
- `kind` (string, optional): `point` or `paragraph`
- `box_width` / `box_height` (number, optional): Paragraph text box size in pixels (implies `kind=paragraph`)
- `alignment` (string, optional): LEFT, CENTER, RIGHT, LEFTJUSTIFIED, CENTERJUSTIFIED, RIGHTJUSTIFIED, FULLYJUSTIFIED
- `red` / `green` / `blue` (number, optional): Text color 0–255

```javascript
// Example: Paragraph title with tracking
photoshop_create_text_layer({
  text: "Hello World",
  x: 200,
  y: 150,
  fontSize: 48,
  fontName: "Arial",
  tracking: 80,
  leading: 56,
  kind: "paragraph",
  box_width: 600,
  box_height: 160,
  alignment: "CENTER"
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
- `blendMode` (string, required): Photoshop UI blend-mode name (NORMAL, MULTIPLY, SCREEN, OVERLAY, COLOR, …)

```javascript
// Example: Set blend mode to multiply
photoshop_set_layer_blend_mode({ blendMode: "MULTIPLY" })
```

Available blend modes: NORMAL, DISSOLVE, DARKEN, MULTIPLY, COLORBURN, LINEARBURN, DARKERCOLOR, LIGHTEN, SCREEN, COLORDODGE, LINEARDODGE, LIGHTERCOLOR, OVERLAY, SOFTLIGHT, HARDLIGHT, VIVIDLIGHT, LINEARLIGHT, PINLIGHT, HARDMIX, DIFFERENCE, EXCLUSION, SUBTRACT, DIVIDE, HUE, SATURATION, COLOR, LUMINOSITY

`COLOR` is the UI name for Color blend (colorize). The server maps it to ExtendScript `BlendMode.COLORBLEND`. `LUMINOSITY` is already the DOM name. `DARKERCOLOR` / `LIGHTERCOLOR` use Action Manager when the classic `BlendMode` enum does not expose them.

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

#### `photoshop_apply_high_pass`
Apply High Pass filter to the active raster layer (edge/detail extraction).

**Parameters:**
- `radius` (number, required): Edge retention radius in pixels (0.1-250)

```javascript
// Example: Apply 5px high pass for sharpening workflow
photoshop_apply_high_pass({ radius: 5 })
```

**Returns:** JSON `{ ok, summary, details: { filter, radius, context } }`. Fails on text, Smart Object, or Background layers — rasterize first.

#### `photoshop_apply_smart_blur`
Apply Smart Blur filter (edge-preserving blur) to the active raster layer.

**Parameters:**
- `radius` (number, required): Blur radius (0.1-100)
- `threshold` (number, required): Blur threshold (0.1-100)
- `mode` (string, optional): NORMAL, EDGEONLY, or OVERLAYEDGE (default: NORMAL)
- `quality` (string, optional): LOW, MEDIUM, or HIGH (default: MEDIUM)

```javascript
// Example: Subtle edge-preserving blur
photoshop_apply_smart_blur({
  radius: 10,
  threshold: 25,
  mode: "NORMAL",
  quality: "MEDIUM"
})
```

**Returns:** JSON `{ ok, summary, details: { filter, radius, threshold, mode, quality, context } }`.

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

Use `postScriptName` when setting fonts manually via `execute_script`; `photoshop_set_text_font` and `photoshop_create_text_layer` resolve display names automatically. A font that is not installed can be added with `photoshop_install_font`, which reloads the open app's font list.

```javascript
// Example: Find Arial variants
photoshop_list_fonts({ query: "Arial", limit: 20 })
```

#### `photoshop_install_font`
Install a `.ttf`, `.otf`, `.ttc`, or `.otc` for the current user. Does not download the file.

- macOS: copies it to `~/Library/Fonts` (Font Book, Current User).
- Windows: installs it for the current user only.

If Photoshop is open, the tool calls `app.refreshFonts()` (`Application.refreshFonts` in the Photoshop JavaScript Reference) so `photoshop_list_fonts` sees the new names without quitting. The result includes `post_script_names` to pass to `photoshop_set_text_font`.

Fredoka Bold is the named instance `Fredoka-Bold` inside Google Fonts' variable file `Fredoka[wdth,wght].ttf` (SIL Open Font License). It is not a separate Bold file.

**Parameters:**
- `file_path` (string, required): Absolute path to the font file

```javascript
photoshop_install_font({ file_path: "/Users/me/Fonts/Fredoka[wdth,wght].ttf" })
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

#### `photoshop_set_text_style`
Layer-wide typography on the active text layer (tracking, leading, paragraph box, alignment, font, size, color).

**Parameters:** all optional, at least one required — same names as `photoshop_create_text_layer` style fields (`tracking`, `leading`, `auto_leading`, `kind`, `box_width`, `box_height`, `alignment`, `fontName`, `fontSize`, `red`/`green`/`blue`).

```javascript
photoshop_set_text_style({
  tracking: 120,
  leading: 40,
  kind: "paragraph",
  box_width: 500,
  box_height: 180,
  alignment: "CENTER"
})
```

#### `photoshop_set_text_ranges`
Mixed fonts/sizes/colors inside one text layer (`textStyleRange`). `from` inclusive, `to` exclusive.

**Parameters:**
- `ranges` (array, required): `{ from, to, fontName?, fontSize?, red?, green?, blue? }[]` (max 64, no overlaps)

```javascript
photoshop_set_text_ranges({
  ranges: [
    { from: 0, to: 5, red: 220, green: 40, blue: 40, fontName: "Arial" },
    { from: 6, to: 11, red: 30, green: 80, blue: 200, fontName: "Times New Roman" }
  ]
})
```

### Selections & Masks

#### `photoshop_get_selection_bounds`
Read the active pixel selection bounds in document pixels (read-only). Does not create or modify selections.

**Returns:** JSON `{ ok, summary, details: { has_selection, bounds?, context } }` where `bounds` is `{ left, top, right, bottom, width, height }` in pixels when `has_selection` is true.

```javascript
// Example: Verify selection before creating a mask
photoshop_get_selection_bounds()
```

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

#### `photoshop_select_ellipse`
Create an elliptical pixel selection from a bounding box (anti-aliased).

**Parameters:**
- `left`, `top`, `right`, `bottom` (number, required): Bounding box in pixels (`right` > `left`, `bottom` > `top`)

**Returns:** JSON `{ ok, summary, details: { shape, bounds?, context } }`

```javascript
// Example: Oval selection for vignette
photoshop_select_ellipse({
  left: 50,
  top: 50,
  right: 200,
  bottom: 200
})
```

#### `photoshop_expand_selection`
Expand the active pixel selection outward by pixels.

**Parameters:**
- `pixels` (number, required): Amount to expand (minimum 1)

**Returns:** JSON `{ ok, summary, details: { pixels, bounds?, context } }`

```javascript
// Example: Grow a tight subject selection
photoshop_expand_selection({ pixels: 5 })
```

#### `photoshop_contract_selection`
Shrink the active pixel selection inward by pixels.

**Parameters:**
- `pixels` (number, required): Amount to contract (minimum 1)

**Returns:** JSON `{ ok, summary, details: { pixels, bounds?, context } }`

```javascript
// Example: Tighten a loose selection
photoshop_contract_selection({ pixels: 3 })
```

#### `photoshop_feather_selection`
Feather (soften) the edges of the active pixel selection.

**Parameters:**
- `pixels` (number, required): Feather radius in pixels (minimum 1)

**Returns:** JSON `{ ok, summary, details: { pixels, bounds?, context } }`

```javascript
// Example: Soften edges before fill
photoshop_feather_selection({ pixels: 2 })
```

#### `photoshop_save_selection`
Save the active pixel selection to a new alpha channel.

**Parameters:**
- `channel_name` (string, optional): Name for the new channel (auto-generated if omitted)

**Returns:** JSON `{ ok, summary, details: { channel_name, context } }`

```javascript
// Example: Preserve selection for later
photoshop_save_selection({ channel_name: 'MCP_Test_Sel' })
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

#### `photoshop_create_clipping_mask`
Create a clipping mask on the active layer (or a named layer). The target layer must sit directly above the base layer it clips into.

**Parameters:**
- `layer_name` (string, optional): Exact layer name (recursive search). Default: active layer.

```javascript
// Example: Clip the active layer to the one below
photoshop_create_clipping_mask()

// Example: Clip a named layer
photoshop_create_clipping_mask({ layer_name: 'Texture' })
```

#### `photoshop_release_clipping_mask`
Release (remove) the clipping mask from the active layer (or a named layer).

**Parameters:**
- `layer_name` (string, optional): Exact layer name (recursive search). Default: active layer.

```javascript
// Example: Unclip the active layer
photoshop_release_clipping_mask()
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
- `timeout_ms` (number, optional): 1000–600000 (default 30000, or `PHOTOSHOP_SCRIPT_TIMEOUT`)

Your code runs inside a wrapping IIFE on the server side. Use an explicit `return` to pass data back — a bare trailing expression or assignment (e.g. `layer.name = "X"`) evaluates to `undefined`, so the tool result shows `"undefined"` even when the mutation succeeded.

Long loops should pass `timeout_ms`. Batch recipes (`batch_watermark`, `csv_to_cards`, …) already use 600s.

```javascript
// Example: Rename the active layer and return confirmation
photoshop_execute_script({
  code: `
    var layer = app.activeDocument.activeLayer;
    layer.name = "Renamed";
    return { ok: true, name: layer.name };
  `
})

// Example: Read-only query (always return a value you can inspect)
photoshop_execute_script({
  code: "return app.documents.length;"
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
- `x` (number, optional): Absolute canvas X of the placed layer **top-left**, in pixels (default: 0 = document left edge)
- `y` (number, optional): Absolute canvas Y of the placed layer **top-left**, in pixels (default: 0 = document top edge)

`x`/`y` are **not** an offset from Photoshop's default centered Place. After Place, the server translates the layer so `layer.bounds` top-left matches `(x, y)`.

```javascript
// Example: Place so the layer's top-left sits at (100, 200)
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

### Generative AI (Firefly)

Requires Photoshop 24+ and signed-in Adobe generative credits. Call `photoshop_get_capabilities` first.

#### `photoshop_generative_fill`
Fill the current selection with Generative Fill. **Parameters:** `prompt` (required)

#### `photoshop_generative_remove`
AI Remove on the current selection. **Parameters:** `feather_px`, `auto_select_subject`

#### `photoshop_generative_expand`
Extend canvas with Generative Expand. **Parameters:** `prompt`, `direction`

#### `photoshop_generative_upscale`
Generative Upscale (PS 27+). **Parameters:** `target_scale` (2 or 4)

#### `photoshop_sky_replacement`
Native Sky Replacement. **Parameters:** `sky_image_path` (optional)

#### `photoshop_generate_image`
Text-to-image. **Parameters:** `prompt`, `width`, `height`

### Neural Filters (UXP bridge)

Requires `uxp-plugin/` — see [development.md](development.md).

#### `photoshop_neural_filter`
**Parameters:** `filter` (skin_smoothing|harmonize|depth_blur|super_zoom|colorize), `smoothness`, `blur`

### Layer Styles

#### `photoshop_apply_layer_style`
Apply a layer effect (Action Manager `layerEffects`) to the active layer.

**Parameters:**
- `style` (string, required): `drop_shadow` | `outer_glow` | `stroke` | `bevel_emboss`
- `red`, `green`, `blue` (number, optional): Effect color (default 0/0/0)
- `opacity` (number, optional): 0-100 (default 60)
- `size` (number, optional): Blur/size in px — stroke width for stroke (default 10)
- `distance` (number, optional): Offset in px, drop shadow only (default 8)
- `angle` (number, optional): Light angle in degrees (default 120). Drop shadow uses this local angle (`Use Global Light` is off).

```javascript
// Example: soft drop shadow on the active layer
photoshop_apply_layer_style({ style: "drop_shadow", opacity: 55, size: 14, distance: 10 })
```

#### `photoshop_recipe_sticker_outline`
One-click sticker / white-border outline. In `single` mode it applies a solid stroke **and** an optional soft drop shadow as one layer style (use this instead of calling `photoshop_apply_layer_style` twice — the atomic tool applies one effect at a time and overwrites the previous one). In `die_cut` mode it builds the classic double outline — a white border plus a thin dark outer line — by adding two stroked copies of the active layer. Both run in a single undoable step. Other layer effects already on the layer (outer glow, bevel, color/gradient/pattern overlays) are preserved; only the stroke and the drop shadow are set or replaced.

**Parameters:**
- `outline_style` (string, optional): `single` (default) or `die_cut`
- `red`, `green`, `blue` (number, optional): Stroke (white border) color (default 255/255/255 = white)
- `stroke_width` (number, optional): Stroke width in px (default 12)
- `stroke_opacity` (number, optional): Stroke opacity 0-100 (default 100)
- `stroke_position` (string, optional): `outside` | `inside` | `center` (default `outside`; forced to `outside` for `die_cut`)
- `shadow` (boolean, optional): Add a soft drop shadow (default `true`)
- `shadow_opacity`, `shadow_size`, `shadow_distance`, `shadow_angle` (number, optional): Shadow tuning (defaults 40 / 12 / 6 / 120)
- `line_width` (number, optional): `die_cut` only — thickness of the dark outer line in px (default 3)
- `line_red`, `line_green`, `line_blue` (number, optional): `die_cut` only — dark line color (default 0/0/0 = black)
- `document_id` (number, optional): Target a specific open document

```javascript
// Single white sticker border + shadow
photoshop_recipe_sticker_outline({ stroke_width: 14 })

// Die-cut double outline: 16px white border + 4px black outer line
photoshop_recipe_sticker_outline({ outline_style: "die_cut", stroke_width: 16, line_width: 4 })
```

### Color Grading

#### `photoshop_apply_lut`
Color Lookup (3D LUT) adjustment layer — cinematic grades in one step.

**Parameters:**
- `lut` (string, required): Built-in LUT name (e.g. `"Crisp_Warm.3dl"`, `"Kodak 5218 Fuji 3510.3dl"`, `"Moonlight.3dl"`) or absolute path to a `.cube`/`.3dl`/`.look` file

```javascript
photoshop_apply_lut({ lut: "Crisp_Warm.3dl" })
```

#### `photoshop_adjust_vibrance`
Vibrance adjustment layer. **Parameters:** `vibrance` (-100..100, default 40), `saturation` (-100..100, default 0)

#### `photoshop_adjust_exposure`
Exposure adjustment layer. **Parameters:** `exposure` (stops, default 0.5), `offset` (default 0), `gamma` (default 1)

#### `photoshop_apply_photo_filter`
Photo Filter adjustment layer (warming/cooling/tint). **Parameters:** `red`, `green`, `blue` (default 236/138/0 ≈ warming 85), `density` (0-100, default 25), `preserve_luminosity` (default true)

#### `photoshop_apply_gradient_map`
Gradient Map adjustment layer (black→white). **Parameters:** `reverse` (boolean, default false)

### Data-Driven Graphics

Photoshop's hidden "mail merge for images": template PSD with variable-bound layers (Image > Variables > Define) + data sets → one image per row.

#### `photoshop_list_datasets`
List data sets on the active document. **Returns:** `{ datasets, active, count }`

#### `photoshop_import_datasets`
Import a variables/data-sets XML file. **Parameters:** `xml_path` (required)

#### `photoshop_generate_from_datasets`
Batch-export the document once per data set.

**Parameters:**
- `output_dir` (string, required)
- `format` (string, optional): `JPEG` | `PNG` | `PSD` (default JPEG)
- `dataset_names` (string[], optional): subset to export (default all)

```javascript
photoshop_generate_from_datasets({ output_dir: "/Users/me/cards", format: "PNG" })
```

**One-shot alternative:** `photoshop_recipe_csv_to_cards` converts a CSV straight into data sets and exports every row (prompt template `ps.csv_to_cards`).

### Smart Objects

#### `photoshop_convert_to_smart_object`
Convert the active or named layer to an embedded Smart Object (`newPlacedLayer`). Background layers are rejected.

**Parameters:**
- `layer_name` (string, optional): exact layer name (recursive search)

```javascript
photoshop_convert_to_smart_object({ layer_name: "Logo" })
```

#### `photoshop_replace_smart_object_contents`
Replace embedded Smart Object pixels from a file (`placedLayerReplaceContents`). Preserves transforms and Smart Filters on the layer.

**Parameters:**
- `file_path` (string, required): absolute path to replacement image
- `layer_name` (string, optional): Smart Object layer name

```javascript
photoshop_replace_smart_object_contents({
  layer_name: "Screen",
  file_path: "/Users/me/designs/hero.png"
})
```

#### `photoshop_edit_smart_object_contents`
Open Smart Object embedded contents for editing (`placedLayerEditContents`). **Active document becomes the embedded .psb** until you save and close it.

**Parameters:**
- `layer_name` (string, optional): Smart Object layer name

**Returns:** `parent_document`, `embedded_document`, `layer_name`

```javascript
photoshop_edit_smart_object_contents({ layer_name: "Product" })
// ... edit embedded doc, then save/close to return to parent
```

#### `photoshop_create_smart_object_via_copy`
Create an independent Smart Object duplicate (`placedLayerMakeCopy`) — unlinked from the original embedded data.

**Parameters:**
- `layer_name` (string, optional): source Smart Object layer name

```javascript
photoshop_create_smart_object_via_copy({ layer_name: "Logo" })
```

### Image Stacking

#### `photoshop_image_stack`
Load 2+ images into one document, convert to a smart object, apply a stack mode — classic tourist removal / noise reduction without generative AI.

**Parameters:**
- `files` (string[], required): 2+ absolute image paths
- `mode` (string, optional): `mean` | `median` | `maximum` | `minimum` | `summation` | `stddev` (default `median`)

```javascript
// Example: remove tourists from 3 aligned shots
photoshop_image_stack({
  files: ["/shots/a.jpg", "/shots/b.jpg", "/shots/c.jpg"],
  mode: "median"
})
```

### Modern Export

#### `photoshop_export_as`
Export a copy as PNG/JPEG (Save for Web) or WebP/AVIF (native, PS 23.2+). Returns `version_unsupported` when the build lacks WebP/AVIF.

**Parameters:**
- `path` (string, required): Absolute output path
- `format` (string, optional): `PNG` | `JPEG` | `WEBP` | `AVIF` (default PNG)
- `quality` (number, optional): 0-100 (default 80)
- `artboard_id` (number, optional): export only that artboard (from `photoshop_list_artboards`)
