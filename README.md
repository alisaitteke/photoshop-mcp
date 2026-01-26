# Photoshop MCP Server

A Model Context Protocol (MCP) server that enables AI assistants like Claude and Cursor to control Adobe Photoshop programmatically. This allows you to create designs, manipulate images, and automate Photoshop workflows through natural language commands while working in your IDE.

## Features

- ✅ **Cross-Platform Support**: Works on both Windows and macOS
- ✅ **Multiple Photoshop Versions**: Supports Photoshop 2012-2025+
- ✅ **Dual API Support**: Automatically uses UXP for modern versions (23.5+) or ExtendScript for legacy versions
- ✅ **Auto-Detection**: Automatically finds Photoshop installation on your system
- ✅ **Document Management**: Create, open, save, and close documents
- ✅ **Layer Operations**: Create, delete, and manipulate layers
- ✅ **Text Layers**: Create and format text with various options
- ✅ **Image Manipulation**: Resize, crop, and transform images
- ✅ **Color Operations**: Fill layers with colors and gradients
- ✅ **NPX Support**: Easy execution via npx without installation

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

## Architecture

```
photoshop-mcp/
├── src/
│   ├── core/           # MCP server core
│   │   ├── server.ts
│   │   ├── session.ts
│   │   └── tool-registry.ts
│   ├── platform/       # Platform-specific detection & execution
│   │   ├── detector.ts
│   │   ├── connection.ts
│   │   ├── windows-detector.ts
│   │   ├── windows-executor.ts
│   │   ├── macos-detector.ts
│   │   └── macos-executor.ts
│   ├── api/           # Photoshop API abstractions
│   │   ├── photoshop-api.ts
│   │   ├── batch-play.ts
│   │   └── extendscript.ts
│   ├── tools/         # MCP tool implementations
│   │   ├── document-tools.ts
│   │   ├── layer-tools.ts
│   │   └── image-tools.ts
│   └── utils/         # Utilities
│       └── logger.ts
└── examples/          # Configuration examples
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Inspired by the Adobe Photoshop scripting community
