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

### Web UI: `401 unauthorized` from `/api/*`

**Symptom:** The UI shows "Session token rejected...", or a script calling `/api/*` gets `{"error":"unauthorized"}`.

**Cause:** The UI server holds your LLM provider API keys and can drive Photoshop, so every `/api/*` request must present the token generated when the server starts. The browser gets it automatically because the server injects it into `index.html`; anything else must send it explicitly.

**Fix:**

- In the browser: reload the page from the URL printed by `photoshop-mcp-ui`. An old tab kept open across a server restart carries the previous token.
- From a script: read the token from `~/.photoshop-mcp/ui-session.json` (chmod 600) and send it as a header.

```bash
TOKEN=$(node -p "require('$HOME/.photoshop-mcp/ui-session.json').token")
curl -H "x-psmcp-token: $TOKEN" http://127.0.0.1:5174/api/status
```

`Authorization: Bearer $TOKEN` works too. Set `PSMCP_UI_TOKEN` before starting the server to pin a known token instead.

### Web UI: `403 invalid_host` or `403 invalid_origin`

**Cause:** Two guards that run before the token check. `invalid_host` means the `Host` header did not resolve to the loopback address (or the `--host` you bound to) on the server's port — this is what blocks DNS rebinding. `invalid_origin` means the request came from a different origin than the UI itself.

**Fix:** Reach the UI through the exact URL the CLI printed (`http://127.0.0.1:<port>`), not through a hostname that merely points at your machine, and not from a page served on another port.

### Debug Logging

Enable detailed logging by setting `LOG_LEVEL=0`:

```json
{
  "env": {
    "LOG_LEVEL": "0"
  }
}
```
