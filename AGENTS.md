# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **Photoshop MCP server** (TypeScript, `@modelcontextprotocol/sdk`)
plus a bundled **standalone web UI** (Vue 3 + Vite frontend, Hono backend, SQLite
via `better-sqlite3`). See `README.md`, `docs/development.md`, and
`docs/architecture.md` for the canonical docs.

### Platform limitation (important)

The MCP server controls Adobe Photoshop and **only supports macOS and Windows**.
`PhotoshopConnection` (`src/platform/connection.ts`) throws
`Unsupported platform: linux` on the Linux cloud VM. Consequences on this VM:

- The MCP server itself (`npm start` / `dist/index.js`) cannot run.
- Integration/verification scripts that construct a Photoshop `Session` cannot
  run here: `verify:photoshop-prompts`, `test:mcp-local`, `test:mcp-all`,
  `test:intent-expansion`, `spike:issue-2`, `spike:photoshop-actions`. These
  require a live Photoshop on macOS/Windows (see `docs/development.md`).

### What IS runnable on the cloud VM

The **standalone web UI is platform-independent** and is the thing to develop/
demo here.

- Run both backend + frontend: `npm run dev:ui`
  - Hono backend (hot reload via `tsx watch`) on `http://127.0.0.1:5174`
  - Vite frontend on `http://localhost:5173` (proxies `/api` → 5174, rewriting
    the `Origin` header so Hono's loopback-origin guard accepts it)
- The backend enforces a loopback-origin guard on `/api/*`; browser requests
  must come from `localhost`/`127.0.0.1`. Direct `curl` (no `Origin` header)
  works for quick API checks (e.g. `GET /api/status`, `GET /api/providers`,
  `POST /api/chats`).
- UI config + chat history persist to SQLite at `~/.photoshop-mcp/data.db`.
- Actually chatting (and driving Photoshop) needs a provider API key (or a
  Claude Code / Gemini CLI account) **and** a running Photoshop — neither is
  available on this VM. The onboarding, provider config, and chat CRUD work
  without them.

### Build / lint notes

- `npm install` triggers the `prepare` hook → full `npm run build` (builds the
  server with `tsc` **and** installs + builds `web/`). So a single root install
  bootstraps everything; no separate `web/` install step is needed.
- `npm run build:server` (tsc) works on Linux. `npm run build:web` works on Linux.
- `npm run lint` currently fails (~105 `no-undef`/`no-unused-vars` errors): the
  flat ESLint config (`eslint.config.js`) does not declare Node globals
  (`process`, `crypto`, `URL`, `Response`, `AbortController`) for `src/**/*.ts`.
  This is a pre-existing repo config issue, not an environment problem.
