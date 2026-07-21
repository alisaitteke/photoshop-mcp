# Available Tools

Reference for all atomic `photoshop_*` MCP tools exposed by this server (parameters, examples, and return shapes).

← Back to [README](../README.md)

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
