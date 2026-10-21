# Troubleshooting

Common issues when connecting to or scripting Photoshop through the MCP server.

← Back to [README](../README.md)

### "Photoshop not found" (`photoshop_not_detected`)

Every tool detects Photoshop on its first call, so no `photoshop_ping` is needed first. Detection never launches Photoshop. When no install is found, tools return `photoshop_not_detected`.

1. Start Photoshop, then call `photoshop_ping`. On Windows a running Photoshop is found on any drive.
2. Without `PHOTOSHOP_PATH`, the server looks in:
   - macOS: Spotlight, then `/Applications/Adobe Photoshop <year>` from next year's release back to 2012.
   - Windows: the running `Photoshop.exe`, then every Photoshop version in the registry (newest first), then `Program Files\Adobe\Adobe Photoshop <year>` from next year's release back to 2012.
3. For any other location, set `PHOTOSHOP_PATH` to the app (macOS: the `.app` bundle; Windows: `Photoshop.exe`) and restart the MCP server. A `PHOTOSHOP_PATH` that does not point at Photoshop is logged as a warning, and detection falls back to the locations above.

```json
{
  "env": {
    "PHOTOSHOP_PATH": "D:\\Apps\\Adobe Photoshop 2026\\Photoshop.exe"
  }
}
```

A successful detect is cached for 24 hours in `~/.photoshop-mcp/photoshop-detect-cache.json` (`PHOTOSHOP_PATH` bypasses the cache). If the cached app can no longer be resolved or launched, the server forgets it, detects again and retries the call once.

### "Failed to connect to Photoshop"

The second line of the ping result says why:

1. **Photoshop is not running** — open it and ping again. Ping never launches Photoshop.
2. **Photoshop was not found** — set `PHOTOSHOP_PATH` (macOS: the `.app` bundle; Windows: `Photoshop.exe`).
3. On Windows, verify COM automation is not blocked by security settings.

### macOS: Apple-event errors

| Envelope code | osascript code | What to do |
|---|---|---|
| `automation_permission_denied` | `-1743` | System Settings > Privacy & Security > Automation: allow the app running the MCP server to control Adobe Photoshop. |
| `photoshop_unreachable` | `-600`, `-609`, `-10810`, `-10822`, `-10827` | Open Photoshop in the same user session. If the MCP server runs in a sandbox (agent sandbox, Seatbelt, container), allow Apple events or run it outside. |
| `photoshop_app_not_resolved` | `-1728`, `-2741`, `-10814` | Set `PHOTOSHOP_PATH` to the full `.app` path and restart the MCP server. |

### "Script execution timeout"

- Default budget is 30 seconds (`extendscript_timeout`)
- Pass `timeout_ms` on `photoshop_execute_script` (max 600000)
- Or set env `PHOTOSHOP_SCRIPT_TIMEOUT` (milliseconds) as the new default
- Batch recipes (watermark, CSV cards, mockup replace, social variants, datasets, image stack, carousel split, artboard export) already use 600s
- Generative tools use 120s
- MCP abort does **not** stop JSX already running in Photoshop. After a timeout, ping until it succeeds before firing more tools — immediately retrying `get_state` just waits another 30s on a busy app.
- If the OS drive (Photoshop's default scratch disk) has under 10 GB free, the same timeout is `scratch_disk_full`. Free space and restart Photoshop. Ping keeps timing out while the scratch-disk dialog is up.
- If **every** tool call times out — including cheap reads like `photoshop_get_state` with zero or one document open, always after the full 30s — the scripting path itself is not responding (see "Every tool call returns `extendscript_timeout`" below), not the script being slow.

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

### Font is not in the list

Photoshop's `app.fonts` list is the fonts installed for the current user. Copying a file into the user font folder does not update an already-open session. `Application.refreshFonts()` does, without quitting.

1. Install the font file with `photoshop_install_font` (absolute path to a `.ttf`, `.otf`, `.ttc`, or `.otc`). On macOS this copies it to `~/Library/Fonts`. On Windows it installs for the current user only. When Photoshop is open, the tool calls `app.refreshFonts()`.
2. `photoshop_list_fonts`, then set the `postScriptName` from the install result.

Fredoka Bold is the named instance `Fredoka-Bold` inside the variable font `Fredoka[wdth,wght].ttf` (SIL Open Font License). Google Fonts does not ship a separate Bold file for the current Fredoka release.

### Every tool call returns `extendscript_timeout` (UXP bridge panel is loaded)

**Symptom:** every script-executing tool, including `photoshop_ping`, fails after ~30s with `extendscript_timeout`, even though the **MCP Bridge** panel in Photoshop visibly says it is polling. Before 1.7.36 the debug log also said `Using ExtendScript for version … (UXP not available for external scripting)`.

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
