# Anonymous Usage Analytics

This project collects **anonymous, aggregated usage events** to understand how the
MCP server and standalone UI are used and to improve the product. Analytics are
**enabled by default** and can be turned off at any time.

← Back to [README](../README.md)

## What we collect

- App version, operating system (platform, type, release), CPU count, Node.js version,
  launch method, system locale/timezone, and whether optional env overrides are
  configured (flags only — never paths or values).
  **App version is attached to every server-side event** via `buildRuntimeProperties()`,
  not only `mcp_session_started`.
- **MCP-only usage** (no UI required): process lifecycle, MCP client identity
  (name/version from the initialize handshake), virtual page views, Photoshop
  connection status, **batched** tool usage summaries (tool names and counts per
  agent turn — never arguments or results), and prompt template names when requested
- **UI server** startup/shutdown and setup funnel events (provider chosen, auth method,
  validation success/failure codes — not credentials), plus **active provider/model**
  on the anonymous person profile when a chat is created or the model changes
- **Browser UI** events (app loaded, setup completed, SPA page views on route
  changes). When analytics are enabled, the browser records named UI events via
  Rybbit (see [Browser tracking](#browser-tracking))

Events use a random anonymous identifier stored locally at
`~/.photoshop-mcp/` (SQLite `kv` table and/or `analytics-store.json`). That ID
is registered with Rybbit via `identify()` so MCP, UI server, and browser
events merge under one anonymous user per install — no email, name, or other
PII.

The user profile also stores **install cohort** fields (persisted locally, then
sent as identify traits): `first_install_at`, `first_usage_surface`
(`mcp` | `server` | `web`), and `first_mcp_client_name` when an MCP client first
connects. It also stores **total installed RAM (GB)**, **memory tier (bucketed GB)**,
and the **detected Photoshop version** when available — these hardware fields are
on the person profile only, not repeated on every event.

Country/region signals come from Rybbit GeoIP on ingest and from
`system_locale_region` / `browser_locale_region` as a secondary hint.

Rybbit custom-event properties are capped at **2KB**. Long fields such as
`tool_usage_summary` and beta chat text are truncated to fit.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANALYTICS_DISABLED` | off | Set `1` or `true` to disable all analytics for that process |
| `POSTHOG_DISABLED` | — | Legacy alias for `ANALYTICS_DISABLED` |
| `RYBBIT_API_KEY` | unset | Optional Bearer token with `ingest:write` — skips bot detection on server events |
| `RYBBIT_HOST` | `https://hey.sideguard.io` | Self-hosted Rybbit origin (forks/staging) |
| `RYBBIT_SITE_ID` | embedded in `config.ts` | Rybbit site ID |

A default site ID and host are embedded so MCP and UI analytics work on every
`npx` install without user configuration. Forks or staging environments can
override `RYBBIT_HOST` / `RYBBIT_SITE_ID` (see `.env.example`).

If MCP/UI server events do not appear in the dashboard, create an organization
API key in Rybbit (**Settings → Organization**) and set `RYBBIT_API_KEY`, or
turn off bot blocking for the site.

## Browser tracking

When anonymous usage analytics are **enabled**, the standalone browser UI injects
the [Rybbit tracking script](https://rybbit.com/docs/script) and identifies the
anonymous install ID:

- Pageviews follow dashboard **SPA Navigation** / **Automatic Initial Pageview**
- Named custom events via `window.rybbit.event`
- **Session replay is not enabled** in this configuration

These features are **disabled** when you turn off anonymous usage analytics
(Settings → Privacy, or `ANALYTICS_DISABLED=1` / `POSTHOG_DISABLED=1`). Opt-out
also sets `localStorage.disable-rybbit`.

## MCP events

When you run `photoshop-mcp` directly (e.g. via Cursor MCP config), these events
are sent via `POST https://hey.sideguard.io/api/track` using the embedded site ID.
Server events use `hostname: photoshop-mcp.com` and `pathname: /mcp` so they can
be filtered apart from marketing-site traffic.

| Event | When | Key properties |
| --- | --- | --- |
| pageview (`/mcp`) | MCP session start | `usage_surface: mcp` |
| `mcp_session_started` | MCP process start (stdio server up) | `app_version`, `photoshop_detected`, `tools_registered_count` |
| `mcp_client_connected` | MCP client completed initialize handshake | `mcp_client_name`, `mcp_client_version`, `mcp_client_connect_count` |
| `mcp_client_disconnected` | MCP transport closed | `mcp_client_name?`, `mcp_client_version?` |
| `mcp_session_startup_failed` | Startup error | `ok: false`, `error_code` |
| `mcp_photoshop_connection` | Initial connect or failed reconnect | `ok`, `photoshop_connected`, `error_code?` |
| `mcp_photoshop_first_connected` | First successful Photoshop connection (once per install) | `event_source: mcp` |
| `mcp_first_tool_success` | First successful tool call (once per install) | `tool_name`, `event_source: mcp` |
| `mcp_tool_batch` | 3s after last tool, 60s max hold, client disconnect, or session end | `tools_called_count`, `tools_error_count`, `unique_tools_count`, `tool_usage_summary`, `tools_used[]`, `had_errors`, `error_codes[]?`, `error_codes_summary?`, `batch_flush_reason`, `mcp_client_name?` |
| `mcp_prompt_requested` | Prompt template fetch | `prompt_name` |
| `pageleave` | Graceful shutdown (SIGINT/SIGTERM/stdio close) | `duration_ms`, `shutdown_reason` |
| `mcp_session_ended` | Graceful shutdown | `duration_ms`, `shutdown_reason` |

Tool usage is **not** sent per call. Calls are aggregated in memory and flushed as
`mcp_tool_batch` when the MCP client pauses for 3 seconds after the last tool in a
burst (typical IDE agent turn), after 60 seconds of continuous tool activity, or
when the session ends or the MCP client disconnects.

One-time funnel milestones (`mcp_first_tool_success`, `mcp_photoshop_first_connected`)
use a persisted local flag only.

## Model tracking

| Surface | Where to see model | Notes |
| --- | --- | --- |
| **Cursor / Claude Desktop MCP** | Not available | The LLM runs inside the IDE; `photoshop-mcp` never sees the model name |
| **Standalone UI** (all users) | Person `active_provider` / `active_model`, event `ui_model_selected` | Set when a chat is created or provider/model changes — no prompt content |
| **Standalone UI** (beta opt-in) | `beta_chat_turn` event `model` property | Includes truncated prompt/response text |

## UI events (standalone server + browser)

| Event | When | Key properties |
| --- | --- | --- |
| `ui_server_started` | UI CLI process ready | `port`, `host`, `no_open`, `event_source: server` |
| `ui_server_ended` | UI CLI shutdown (SIGINT/SIGTERM) | `duration_ms`, `shutdown_reason`, `event_source: server` |
| `ui_model_selected` | Chat created or model/provider changed | `provider_id`, `model` |
| `setup_provider_selected` | Onboarding provider pick (browser) | `provider_id` |
| `setup_auth_method_selected` | Auth method saved (server API only) | `provider_id`, `auth_method`, `event_source: server` |
| `setup_validate_key` | API key validation (server) | `provider_id`, `ok`, `error_code?` |
| `setup_key_saved` | API key persisted (server) | `provider_id` |
| `setup_completed` | Onboarding finished (browser) | `provider_id`, `auth_method` |
| `app_loaded` | Browser UI ready | `has_auth` |

MCP-only installs appear in Rybbit as pageviews on `/mcp`, even when the
standalone UI is never opened. UI server events use pathname `/ui-server`;
the browser UI uses `/ui`.

## What we do **not** collect (unless you opt into beta team sharing)

- API keys or OAuth tokens
- Chat messages, prompts, or model responses **by default**
- Photoshop document or layer names, file paths, or image content
- CLI account labels, email addresses, or other account identifiers
- Tool call **arguments** or **results** (MCP logs tool **names** only)

## Beta team content sharing (opt-in)

On first launch of the standalone UI, you are asked whether you want to **join the
beta team**. This is separate from anonymous usage analytics above.

If you accept:

- Your **prompts**, **assistant responses**, **reasoning text**, and **tool names**
  (not arguments or results) may be sent to Rybbit after each chat turn via
  `getAnalytics().capture()` (`beta_chat_turn`)
- Content is truncated (Rybbit properties are limited to 2KB)
- Requires anonymous analytics to remain enabled

If you decline, no chat content is logged. You can change this later in
**Settings → General → Privacy → Beta team content sharing**.

Existing installs that have not answered yet are prompted once on the next launch.

## Processor and hosting

Analytics are processed by a self-hosted [Rybbit](https://rybbit.com/) instance
at [hey.sideguard.io](https://hey.sideguard.io).

- **Browser UI:** Rybbit tracking script (`/api/script.js`) with the embedded site ID
- **Marketing / docs site** ([photoshop-mcp.com](https://photoshop-mcp.com/)): the
  same script in the VitePress `<head>`
- **MCP stdio and UI server:** `POST /api/track` and `POST /api/identify` — works on
  every `npx` install without user env configuration
- **Dashboard:** [hey.sideguard.io](https://hey.sideguard.io)

Install-cohort fields are stored locally and sent as Rybbit identify traits.

See the [Rybbit privacy policy](https://rybbit.com/privacy) for how Rybbit
handles data on their side.

### Marketing / documentation site

The GitHub Pages site (VitePress under `site/`, [photoshop-mcp.com](https://photoshop-mcp.com/))
loads the Rybbit script in production (localhost is opted out). Pageviews are
automatic (enable **SPA Navigation** in the Rybbit site settings). Custom events
carry `event_source: site`, `usage_surface: site`, and `site_locale`.

- Visitors are **not** identified — site traffic does not merge with MCP install IDs
- Session replay is **not** enabled from this repo

Named conversion events (no command text or PII):

| Event | When | Key properties |
| --- | --- | --- |
| `site_cta_clicked` | Hero, nav, footer, or body CTA | `cta_id` (`quick_start` \| `documentation` \| `github` \| `npm` \| `mcp_registry`), `cta_location` |
| `site_code_copied` | VitePress copy button on a code block | `command` (`mcp` \| `ui` \| `other`) |
| `site_outbound_clicked` | External link that is not a named CTA | `destination`, `href_host` |
| `site_locale_changed` | Language switcher | `from`, `to` |

### Geolocation

Rybbit enriches events with country/region from the client IP on ingest (GeoIP).
Browser events also send `browser_locale_region` as a secondary hint.

## Rybbit dashboard recipes (maintainers)

Filter marketing-site traffic by pathname **not** in `/mcp`, `/ui`, `/ui-server`.

| Insight | Rybbit approach |
| --- | --- |
| MCP active users | Pageviews where pathname is `/mcp` |
| MCP client breakdown | `mcp_client_connected` segmented by `mcp_client_name` |
| Install cohorts | User traits `first_usage_surface`, `first_mcp_client_name`, `first_install_at` |
| First tool / Photoshop reach | Funnel on `mcp_first_tool_success`, `mcp_photoshop_first_connected` |
| Country breakdown | Segment `mcp_tool_batch` or `/mcp` pageviews by country |
| Tool error rate | `mcp_tool_batch` where `had_errors = true`, segment by `error_codes` or `error_codes_summary` |
| Photoshop reachability | `mcp_photoshop_connection` where `ok = false` |
| Session duration | Average `duration_ms` on `mcp_session_ended` or `ui_server_ended` |
| MCP vs UI usage | User trait `usage_surfaces` (comma-separated: `mcp`, `server`, `web`) |
| Standalone UI model | User `active_provider` / `active_model` or event `ui_model_selected` |
| Marketing site traffic | Pageviews excluding `/mcp`, `/ui`, `/ui-server` |
| Install copy conversion | `site_code_copied` segmented by `command` |
| Site CTA funnel | `site_cta_clicked` segmented by `cta_id` / `cta_location` |

## How to opt out

1. **Standalone UI:** Settings → General → Privacy → set **Anonymous usage
   analytics** to **Off** (also disables beta content sharing).
2. **Beta content only:** Settings → General → Privacy → set **Beta team content
   sharing** to **Off** (anonymous analytics can stay on).
3. **Environment variable:** set `ANALYTICS_DISABLED=1` (or the legacy alias
   `POSTHOG_DISABLED=1`) before starting `photoshop-mcp` or `photoshop-mcp-ui`
   (disables all analytics for that process and persists opt-out in local
   storage).
