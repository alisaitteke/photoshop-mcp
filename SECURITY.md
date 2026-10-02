# Security Policy

Photoshop MCP lets AI assistants drive a local Adobe Photoshop instance, and the
standalone UI stores AI provider credentials on your machine. We take reports
about either seriously and appreciate responsible disclosure.

> This is an unofficial, community-maintained project and is not affiliated with
> or endorsed by Adobe Inc.

## Supported versions

Security fixes ship as a new patch release of the latest minor version on npm
([`@alisaitteke/photoshop-mcp`](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)).
Older lines do not receive backports — please upgrade.

| Version | Supported          |
| ------- | ------------------ |
| 1.7.x   | :white_check_mark: |
| < 1.7   | :x:                |

`npx -y @alisaitteke/photoshop-mcp` always resolves to the latest release. If you
pinned a version or installed globally, update with
`npm install -g @alisaitteke/photoshop-mcp@latest`.

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for security
problems.**

1. **Preferred:** open a private report through GitHub —
   [Report a vulnerability](https://github.com/alisaitteke/photoshop-mcp/security/advisories/new)
   (Security tab → _Report a vulnerability_).
2. **Alternative:** email **[alisaitteke@gmail.com](mailto:alisaitteke@gmail.com)**
   with the subject `[photoshop-mcp security]`.

Please write the report in English if you can, and include:

- Affected component (MCP server, standalone UI, UXP bridge, Cursor plugin,
  release / CI pipeline) and version
- Operating system (Windows / macOS) and Photoshop version
- Step-by-step reproduction or a proof of concept (tool call arguments, HTTP
  requests, or a minimal script)
- The impact you were able to demonstrate
- Any suggested fix or mitigation

Never include real API keys, session tokens, or personal documents in a report.

## What to expect

| Step                                                              | Target                       |
| ----------------------------------------------------------------- | ---------------------------- |
| Acknowledgement of your report                                    | within 5 business days       |
| Initial assessment (confirmed / needs info / not a vulnerability) | within 10 business days      |
| Status updates while a fix is in progress                         | at least every 14 days       |
| Fix released and advisory published                               | within 90 days of the report |

This is a volunteer-maintained project, so timelines are best effort. Once a fix
is released we publish a
[GitHub Security Advisory](https://github.com/alisaitteke/photoshop-mcp/security/advisories),
request a CVE when appropriate, and credit you unless you prefer to stay
anonymous. Please keep details private until the advisory is published.

## Scope

### In scope

- **MCP server (stdio)** — tool arguments that escape their intended context,
  such as injecting code into the generated ExtendScript, AppleScript (macOS), or
  COM (Windows) calls through a tool _other than_ `photoshop_execute_script`;
  reading or writing files outside the paths a tool is meant to touch.
- **Standalone UI (`photoshop-mcp-ui`)** — bypassing the Host, Origin, or
  session-token checks on `/api/*` (see
  [Local API security](docs/standalone-ui.md#local-api-security)), leaking the
  session token, or exposing provider API keys stored under `~/.photoshop-mcp/`.
- **UXP bridge (`uxp-plugin/`, `127.0.0.1:38452`)** — letting a remote host or a
  web page queue commands for Photoshop or read their results.
- **Anonymous usage analytics** — sending anything beyond what
  [`docs/anonymous-usage-analytics.md`](docs/anonymous-usage-analytics.md)
  describes (for example tool arguments, file paths, prompts, or credentials),
  or ignoring `ANALYTICS_DISABLED`.
- **Supply chain** — the published npm package, the GitHub Actions release
  workflows, and the MCP Registry / Cursor plugin metadata in this repository.

### Out of scope

- **`photoshop_execute_script` running arbitrary ExtendScript.** This is the
  tool's purpose. Your MCP host (Cursor, Claude, VS Code, …) is responsible for
  asking you before tool calls run — review them, especially this one.
- **Prompt injection** from document content (layer names, text layers, CSV
  data, web pages) that convinces an AI host to call tools. Please report it to
  the host vendor, unless this server makes it worse — for example by acting
  without going through the host's tool-call flow.
- Attacks that require running code as your OS user or reading files in your
  home directory (such as `~/.photoshop-mcp/ui-session.json`).
- Exposure caused by deliberately binding the UI to a non-loopback address with
  `--host`, unless the Host / Origin / token checks can be bypassed.
- Vulnerabilities in Adobe Photoshop, UXP, or ExtendScript themselves — report
  those to Adobe PSIRT ([psirt@adobe.com](mailto:psirt@adobe.com), see
  [Notifying Adobe of Security Issues](https://helpx.adobe.com/security/alertus.html)).
- Issues in third-party AI providers, MCP hosts, Claude Code, or Gemini CLI.
- Dependency advisories without a demonstrated impact on this project — a
  regular issue or pull request that bumps the dependency is welcome.

## Hardening tips for users

- Keep the standalone UI on the default loopback address (`127.0.0.1`).
- Treat `~/.photoshop-mcp/` as sensitive: it holds provider API keys
  (`data.db`) and the UI session token (`ui-session.json`).
- Review tool calls in your MCP host before approving them, and work on copies
  of important files.
- Set `ANALYTICS_DISABLED=1` if you do not want to send anonymous usage events.
