# Troubleshooting

Common issues when connecting to or scripting Photoshop through the MCP server.

← Back to [README](../README.md)

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

### `photoshop_execute_script` returns `Result: undefined`

**Symptom:** The tool succeeds but the result text is `"undefined"`, or you assume the script did not run.

**Cause:** ExtendScript runs inside a server-side IIFE wrapper. Without an explicit `return`, the inner block evaluates to `undefined` — side effects (layer renames, property changes, etc.) may still have applied.

**Fix:** Add an explicit return in your script:

```javascript
photoshop_execute_script({
  code: `
    app.activeDocument.activeLayer.name = "Updated";
    return { ok: true };
  `
})
```

See also the `photoshop_execute_script` section in [`docs/available-tools.md`](available-tools.md).

### Debug Logging

Enable detailed logging by setting `LOG_LEVEL=0`:

```json
{
  "env": {
    "LOG_LEVEL": "0"
  }
}
```
