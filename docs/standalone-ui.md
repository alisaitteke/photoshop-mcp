# Standalone UI

Fully local web UI that lets you chat with an AI model and drive Photoshop
through this MCP server underneath — no IDE required. Connect with a provider
API key **or**, for Anthropic and Google, reuse the OAuth session from
**Claude Code** or **Gemini CLI** — no separate API key required.

← Back to [README](../README.md)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

That's it. A local server starts on `127.0.0.1` (random free port) and your
default browser opens the chat UI automatically.

## Supported providers

Pick any of the following on first launch — use an API key **or** your existing
CLI subscription account (Anthropic and Google):

| Provider | Models | API key | CLI account |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100+ models from any provider | [openrouter.ai](https://openrouter.ai/keys) | — |

## Authentication modes

- **`api_key` (default)** — Vercel AI SDK + your provider API key. Usage is billed
  per token at API rates; the UI shows estimated cost per chat.
- **`cli_account`** — Uses your local Claude Code or Gemini CLI OAuth session.
  No API key is stored; the UI probes `claude auth status` / `gemini` headless
  to verify login. Usage counts against your **subscription quota**, not API
  billing — the status bar shows "Included in subscription".

You can switch auth method per provider in Settings without losing the other
credential (e.g. keep an API key while trying CLI account, then switch back).

## Action Plan (beta)

An optional execution mode in the standalone web UI for **API key auth only**
(`cli_account` always uses the default agentic flow). Turn it on with the
**Action Plan** toggle next to the model selector in the composer.

Instead of a per-step ReAct loop (model → tool → model → tool …), Action Plan:

1. Makes **one** planning LLM call that outputs an ordered todo list of
   Photoshop MCP tool calls with parameters.
2. Executes those tools **directly** in sequence — no extra model round-trips
   between steps.
3. On a failed step or unresolved dependency, runs a bounded **repair** loop
   (re-plans only the remaining steps, up to 3 times).

The plan appears as a live todo list above the tool-call cards, with per-step
status (`pending` → `running` → `done` / `error`). Plans are persisted in chat
history so they survive reload. The toggle is off by default; the existing
agentic flow is unchanged when Action Plan is disabled.

Good for multi-step prompts such as *"remove the background and export for web"*
where you want fewer model calls and faster end-to-end execution.

## What happens on first launch

1. Pick a provider and choose **API key** or **Uses your account**.
2. Validate the key or check the CLI connection. Config is stored locally at
   `~/.photoshop-mcp/data.db` (SQLite, `chmod 600`). API keys never leave your
   machine; CLI mode inherits OAuth from `~/.claude/` or `~/.gemini/`.
3. Type natural-language prompts. The UI streams the model's reply, runs
   Photoshop tool calls in real time, and renders each tool call as an
   inspectable card (input + result).
4. Switch provider, auth method, or model anytime from Settings / model selector
   — chats, costs and tool history are persisted across sessions.

## Switching auth method later

Open **Settings** from the sidebar at any time:

| Action | API key mode | CLI account mode |
|---|---|---|
| Set up | Paste key → **Save** | Install CLI → `auth login` → **Check connection** |
| Switch away | Choose **API key** — stored key is kept | Choose **Uses your account** — key is not deleted |
| Custom binary | — | Optional **CLI path** if `claude` / `gemini` is not on `PATH` |
| Cost display | Per-token estimate in status bar | **Included in subscription** badge |

Auth method is stored per provider in `~/.photoshop-mcp/data.db` (`authMethod`:
`api_key` or `cli_account`). Existing configs without `authMethod` default to
`api_key` and keep working unchanged.

## CLI flags

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

## Local API security

The UI server stores your provider API keys and can drive Photoshop, so `/api/*`
is not open to everything running on your machine. Each request must pass three
checks:

1. **Host** — must be the loopback address (or the `--host` you bound to) on the
   server's port. Blocks DNS rebinding.
2. **Origin** — when present, must match the UI's own origin. Blocks
   cross-origin browser callers.
3. **Session token** — a random per-start secret. Blocks other local processes,
   which can forge any header but cannot read the token.

The browser never has to deal with the token: the server injects it into the
`index.html` it serves. For scripting, read it from
`~/.photoshop-mcp/ui-session.json` (chmod 600) and send it as `x-psmcp-token` or
`Authorization: Bearer`, or pin your own with `PSMCP_UI_TOKEN` before starting
the server. Requests without a valid token get `401 unauthorized`.

## Environment variables

- `PHOTOSHOP_PATH`: (Optional) Specify custom Photoshop installation path
- `LOG_LEVEL`: Logging level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
- `PSMCP_UI_TOKEN`: Pin the standalone UI session token (see above)
- `ANALYTICS_DISABLED`: Set to `1` or `true` to disable anonymous usage analytics entirely
- `POSTHOG_DISABLED`: Legacy alias for `ANALYTICS_DISABLED`
- `RYBBIT_API_KEY`: (Optional) Rybbit ingest API key — skips bot detection for server events
- `RYBBIT_HOST`: (Optional) Rybbit origin (default: `https://hey.sideguard.io`)
- `RYBBIT_SITE_ID`: (Optional) Rybbit site ID — a default is embedded; override for forks or staging

## Troubleshooting — CLI account auth

| Symptom | Likely cause | Fix |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLI not installed | `npm i -g @anthropic-ai/claude-code` or `npm i -g @google/gemini-cli` |
| `not_authenticated` | No CLI OAuth session (API key / SDK auth does not count) | Run `claude auth login` or `gemini auth login` in Terminal, or switch to **API key** auth |
| SDK client works, UI CLI mode fails | SDK/API credentials are separate from Claude Code CLI OAuth | Use **API key** in the standalone UI, or log in with `claude auth login` for CLI account mode |
| `claude` / `gemini` not on `PATH` | Custom install location | Settings → **CLI path** → **Check connection** |
| Chat works in IDE but not UI (CLI mode) | OAuth tokens are CLI-only | Use **CLI account** in UI; API keys and CLI sessions are separate |
| Gemini multi-turn feels forgetful | Headless CLI may start a fresh session each turn | Known limitation; history is prepended to the prompt (MVP) |

General connection, scripting, and logging issues:
[`docs/troubleshooting.md`](troubleshooting.md).

## Notes

- The agent is restricted to Photoshop MCP tools only — built-in shell, file
  and web tools are disabled.
- Tech stack: Vue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/)
  on the frontend; [Hono](https://hono.dev/) on the backend. API-key mode uses
  the [Vercel AI SDK](https://sdk.vercel.ai/); CLI account mode uses the
  [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp) (Anthropic)
  or Gemini CLI headless `stream-json` (Google). All paths talk to this same
  Photoshop MCP server over STDIO.
- **CLI account limitations:** Gemini headless may open a new session each turn
  (history is prepended to the prompt). Anthropic CLI account consumes
  subscription quota. OAuth login is macOS-first (`claude auth login` /
  `gemini auth login` in Terminal); credentials live under `~/.claude/` and
  `~/.gemini/`.
