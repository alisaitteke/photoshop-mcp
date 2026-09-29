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
- If **every** tool call times out — including cheap reads like `photoshop_get_state` with zero or one document open, always after the full 30s — the scripting path itself is not responding (see the next section), not the script being slow.

```javascript
photoshop_execute_script({
  code: "/* long loop */ return { ok: true };",
  timeout_ms: 180000
})
```

### Every tool call returns `extendscript_timeout` (UXP bridge panel is loaded)

**Symptom:** `photoshop_ping` succeeds, but every script-executing tool (`photoshop_get_state`, `photoshop_list_documents`, …) fails after ~30s with `extendscript_timeout`, and debug logs show `Using ExtendScript for version … (UXP not available for external scripting)` even though the **MCP Bridge** panel in Photoshop visibly says it is polling.

**Cause:** Two different channels are involved, and only one of them runs tool scripts:

- **Tool scripts** (the 100+ document/layer/filter tools) always run through the platform scripting path — AppleScript on macOS, `cscript` + COM `DoJavaScript` on Windows. The UXP panel is not consulted for them: UXP plugins cannot execute arbitrary ExtendScript, so even a perfectly loaded bridge panel cannot carry these calls. On newer Photoshop builds this legacy scripting entry point can stop responding, and the call then blocks until the 30s budget expires.
- **The UXP bridge panel** only carries bridge commands the plugin implements (Neural Filters via `photoshop_neural_filter`). Its polling status does not change which path tool scripts take.

**Diagnosis:**

1. Call `photoshop_get_capabilities` and check `uxp_bridge_reachable`. It is `true` only when the plugin has actually polled the bridge in the last few seconds (the panel polls every 400ms) — this verifies the panel ↔ server channel independently of the scripting path.
2. Set `LOG_LEVEL=0`. The factory now logs one of:
   - `UXP bridge plugin detected and polling — neural filters available, but tool scripts still require ExtendScript` (bridge fine; timeouts mean the scripting path is the problem)
   - `UXP plugin not polling the bridge` (panel not loaded/connected — neural filters will not work either)
3. To probe the bridge channel end-to-end, force the UXP path with `PHOTOSHOP_MCP_API=uxp`: any script tool then fails immediately with a message stating whether the plugin is connected, instead of hanging for 30s. (`PHOTOSHOP_MCP_API=extendscript` forces the other path; unset/auto is the default.)

```json
{
  "env": {
    "PHOTOSHOP_MCP_API": "uxp"
  }
}
```

**Fix:** if `uxp_bridge_reachable` is `true` but tool scripts still time out, the platform scripting path is blocked on that Photoshop build — check "Failed to connect to Photoshop" above (COM/security settings on Windows), and that no modal dialog is holding Photoshop. The bridge panel cannot substitute for the scripting path.

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
