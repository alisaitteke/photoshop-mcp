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

- Default budget is 30 seconds (`extendscript_timeout`)
- Pass `timeout_ms` on `photoshop_execute_script` (max 600000)
- Or set env `PHOTOSHOP_SCRIPT_TIMEOUT` (milliseconds) as the new default
- Batch recipes (watermark, CSV cards, mockup replace, social variants, datasets, image stack, carousel split, artboard export) already use 600s
- Generative tools use 120s
- MCP abort does **not** stop JSX already running in Photoshop. After a timeout, ping until it succeeds before firing more tools — immediately retrying `get_state` just waits another 30s on a busy app.
- If the OS drive (Photoshop's default scratch disk) has under 10 GB free, the same timeout is `scratch_disk_full`. Free space and restart Photoshop. Ping keeps timing out while the scratch-disk dialog is up.

```javascript
photoshop_execute_script({
  code: "/* long loop */ return { ok: true };",
  timeout_ms: 180000
})
```

### Scratch disk full

Photoshop shows "Could not initialize Photoshop because the scratch disks are full", "Could not complete your request because the scratch disks are full", or "Scratch Disk Low", then freezes or refuses to launch. A script that does run reports ExtendScript error `-25010`. The MCP envelope code is `scratch_disk_full`.

1. Free at least 100 GB on the primary scratch disk. By default that is the OS drive: Macintosh HD on macOS, `C:` on Windows (delete files whose names begin with `Photoshop Temp`).
2. Restart Photoshop.
3. To use another drive, open **Photoshop > Settings > Scratch Disks** (macOS) or **Edit > Preferences > Scratch Disks** (Windows), or hold Cmd+Option (macOS) / Ctrl+Alt (Windows) while launching.

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
