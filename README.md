# Photoshop MCP Server
> **Note:** This is an unofficial, community-maintained project and is not affiliated with or endorsed by Adobe Inc.

[![npm version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

A Model Context Protocol (MCP) server that enables AI assistants like Claude and Cursor to control Adobe Photoshop programmatically. This allows you to create designs, manipulate images, and automate Photoshop workflows through natural language commands while working in your IDE.

> **🎨 50+ Tools** | **🖥️ Cross-Platform** | **📦 NPX Ready** | **🔧 ExtendScript API** | **⏮️ Undo/Redo**

## Features

- ✅ **Works on both Windows and macOS**
- ✅ **Supports Photoshop 2012-2025+**
- ✅ **ExtendScript API**: Universal compatibility via AppleScript/COM automation
- ✅ **Auto-Detection**: Automatically finds Photoshop installation on your system
- ✅ **50+ Tools**: Comprehensive Photoshop automation
- ✅ **Document Management**: Create, open, save, close, crop documents
- ✅ **Layer Operations**: Create, delete, duplicate, merge, transform layers
- ✅ **Layer Properties**: Opacity, blend modes, visibility, locking
- ✅ **Text Formatting**: Font, size, color, alignment controls
- ✅ **Image Placement**: Place images, open files, fit to document
- ✅ **Filters**: Gaussian Blur, Sharpen, Noise, Motion Blur
- ✅ **Color Adjustments**: Brightness/Contrast, Hue/Saturation, Auto Levels/Contrast
- ✅ **Selections & Masks**: Rectangular selections, layer masks
- ✅ **History Control**: Undo/Redo operations, view history states
- ✅ **Actions**: Play recorded actions, execute custom scripts
- ✅ **Auto-Rasterize**: Automatically converts layers when needed for filters
- ✅ **Context Tracking**: Returns document/layer state after each operation for AI context awareness

## Installation

### Using NPX (Recommended)

No installation required! Just configure your MCP client:

```bash
npx @alisaitteke/photoshop-mcp
```

### From Source

```bash
git clone https://github.com/yourusername/photoshop-mcp.git
cd photoshop-mcp
npm install
npm run build
```

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

## Available Tools

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

```javascript
// Example: Create a text layer
photoshop_create_text_layer({
  text: "Hello World",
  x: 200,
  y: 150,
  fontSize: 48
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

#### `photoshop_set_text_font`
Set font family and size for active text layer.

**Parameters:**
- `fontName` (string, required): Font family name
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

## Example Prompts

Below are example prompts you can use with AI assistants (Claude, Cursor, etc.) when this MCP server is configured:

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
Apply auto levels and auto contrast.
Apply unsharp mask with amount 120%, radius 1.5, threshold 0.
Increase saturation by 15.
Crop to remove 100px from each edge.
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

---

## Usage Examples

### Create a Simple Design

```javascript
// 1. Create a new document
photoshop_create_document({
  width: 800,
  height: 600,
  colorMode: "RGB"
})

// 2. Create a background layer
photoshop_create_layer({ name: "Background" })

// 3. Fill it with a color
photoshop_fill_layer({
  red: 240,
  green: 240,
  blue: 255
})

// 4. Add a text layer
photoshop_create_text_layer({
  text: "My Design",
  x: 400,
  y: 300,
  fontSize: 64
})

// 5. Save the result
photoshop_save_document({
  path: "/Users/username/Desktop/design.psd",
  format: "PSD"
})
```

### Batch Process Images

```javascript
// 1. Open existing document (manual step)
// 2. Resize image
photoshop_resize_image({ width: 1920, height: 1080 })

// 3. Save as JPEG
photoshop_save_document({
  path: "/Users/username/Desktop/resized.jpg",
  format: "JPEG",
  quality: 12
})

// 4. Close document
photoshop_close_document({ save: false })
```

### Create Design with Stock Images (using Pexels MCP)

This example shows how to combine Photoshop MCP with Pexels MCP:

```javascript
// 1. Search for images on Pexels (using Pexels MCP server)
// Note: You need to have Pexels MCP server configured
pexels_photos_search({
  query: "nature landscape",
  per_page: 5
})

// 2. Download the image you want (manually or via script)
// 3. Create a new Photoshop document
photoshop_create_document({
  width: 1920,
  height: 1080,
  colorMode: "RGB"
})

// 4. Place the downloaded image
photoshop_place_image({
  filePath: "/Users/username/Downloads/pexels-photo.jpg",
  x: 0,
  y: 0
})

// 5. Fit the image to document (NEW!)
photoshop_fit_layer_to_document({
  fillDocument: true  // Fill entire canvas
})

// 6. Add text overlay
photoshop_create_text_layer({
  text: "Beautiful Nature",
  x: 960,
  y: 100,
  fontSize: 72
})

// 7. Save the final design
photoshop_save_document({
  path: "/Users/username/Desktop/nature-design.psd",
  format: "PSD"
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

## Supported Photoshop Versions

- **All Photoshop versions** (2012-2025+): Uses ExtendScript API via AppleScript (macOS) or COM (Windows)

**Important Note**: While Photoshop 2022+ supports UXP for plugins, external automation via AppleScript/COM can only use ExtendScript. UXP is designed for internal plugins and cannot be invoked from external scripts. Therefore, this MCP server uses ExtendScript for maximum compatibility across all Photoshop versions.

## Troubleshooting

### "Photoshop not found"

1. Make sure Photoshop is installed in the default location
2. Or set `PHOTOSHOP_PATH` environment variable to custom installation path

```json
{
  "env": {
    "PHOTOSHOP_PATH": "C:\\Custom\\Path\\Adobe Photoshop 2025\\Photoshop.exe"
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

## Development

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

## Quick Start Examples

### 💡 Common Use Cases

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

---

## Architecture

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
│   ├── tools/            # MCP tool implementations (42+ tools)
│   │   ├── document-tools.ts        # Document operations
│   │   ├── layer-tools.ts           # Layer creation/deletion
│   │   ├── layer-properties-tools.ts # Opacity, blend modes, etc.
│   │   ├── layer-transform-tools.ts  # Scale, rotate, move
│   │   ├── image-tools.ts           # Resize, crop
│   │   ├── image-placement-tools.ts # Place/open images
│   │   ├── filter-tools.ts          # Blur, sharpen, noise
│   │   ├── adjustment-tools.ts      # Color adjustments
│   │   ├── text-tools.ts            # Text formatting
│   │   ├── selection-tools.ts       # Selections & masks
│   │   └── action-tools.ts          # Actions & custom scripts
│   └── utils/            # Utilities
│       └── logger.ts     # Logging system (stderr-based)
└── examples/             # Configuration examples
    ├── cursor-config.json
    └── claude-desktop-config.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Inspired by the Adobe Photoshop scripting community
