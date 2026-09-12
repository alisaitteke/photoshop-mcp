/**
 * MCP client install matrix — single source of truth for the site.
 *
 * Shape follows the open registry at https://install.apicommons.org/clients.json
 * so adding a client is a data change. Deeplinks and snippets are derived
 * from `SERVER` below at runtime; never hand-edit encoded URLs.
 */

export const PACKAGE = '@alisaitteke/photoshop-mcp';
export const SERVER_ID = 'photoshop';
export const GITHUB = 'https://github.com/alisaitteke/photoshop-mcp';
export const MCPB_URL = `${GITHUB}/releases/latest/download/photoshop-mcp.mcpb`;

export const SERVER = {
  command: 'npx',
  args: ['-y', PACKAGE],
} as const;

export const STDIO_COMMAND = `npx -y ${PACKAGE}`;
export const UI_COMMAND = `npx -p ${PACKAGE} photoshop-mcp-ui`;

export type Os = 'mac' | 'windows' | 'linux';
export type Tier = 1 | 2 | 3;
export type Mechanism = 'deeplink' | 'download' | 'cli' | 'config';

export interface ClientDef {
  id: string;
  name: string;
  maker: string;
  tier: Tier;
  /** Primary way to install. */
  mechanism: Mechanism;
  /** One-click install link (opens the app). */
  deeplink?: (cfg: DerivedConfig) => string;
  /** Terminal command. */
  cli?: string;
  /** Config snippet language + text. */
  config?: {
    format: 'json' | 'toml';
    snippet: string;
    /** Where the file lives, per OS. */
    paths?: Partial<Record<Os, string>>;
    /** How to reach it from the app when there is no stable path. */
    location?: string;
  };
  /** Extra guidance shown under the install card (English; short). */
  steps?: string[];
  docs: string;
  platforms: Os[];
  /** Shown as a small caution (e.g. deprecated). */
  caution?: string;
  /** Verified-in-app hint. */
  verifyHint?: string;
  /** Present in the logo cloud on the landing page. */
  logo?: boolean;
}

export interface DerivedConfig {
  /** { "command": "npx", "args": [...] } */
  entry: string;
  /** base64 of entry */
  entryB64: string;
  /** encodeURIComponent of entry */
  entryUrl: string;
}

const entryObj = { command: SERVER.command, args: [...SERVER.args] };

export function deriveConfig(): DerivedConfig {
  const entry = JSON.stringify(entryObj);
  const entryB64 =
    typeof btoa === 'function' ? btoa(entry) : Buffer.from(entry, 'utf8').toString('base64');
  return { entry, entryB64, entryUrl: encodeURIComponent(entry) };
}

function jsonSnippet(rootKey: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ [rootKey]: { [SERVER_ID]: { ...entryObj, ...extra } } }, null, 2);
}

export const MCP_SERVERS_JSON = jsonSnippet('mcpServers');

export const CLIENTS: ClientDef[] = [
  // ── Tier 1 — hero install strip ───────────────────────────────────────
  {
    id: 'cursor',
    name: 'Cursor',
    maker: 'Anysphere',
    tier: 1,
    mechanism: 'deeplink',
    deeplink: (c) => `https://cursor.com/en/install-mcp?name=${SERVER_ID}&config=${c.entryB64}`,
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      paths: {
        mac: '~/.cursor/mcp.json',
        windows: '%USERPROFILE%\\.cursor\\mcp.json',
        linux: '~/.cursor/mcp.json',
      },
      location: 'Cursor Settings → MCP → Add new MCP server',
    },
    steps: ['Click Install in Cursor and accept the prompt.', 'If nothing opens, paste the JSON into mcp.json.'],
    docs: 'https://cursor.com/docs/mcp',
    platforms: ['mac', 'windows', 'linux'],
    verifyHint: 'Open Agent mode and ask: "Ping Photoshop and list open documents."',
    logo: true,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    maker: 'Microsoft',
    tier: 1,
    mechanism: 'deeplink',
    deeplink: (c) => `https://vscode.dev/redirect/mcp/install?name=${SERVER_ID}&config=${c.entryUrl}`,
    cli: `code --add-mcp '${JSON.stringify({ name: SERVER_ID, ...entryObj })}'`,
    config: {
      format: 'json',
      snippet: jsonSnippet('servers', { type: 'stdio' }),
      location: 'Workspace .vscode/mcp.json, or Command Palette → "MCP: Add Server"',
    },
    steps: ['Click Install in VS Code and confirm.', 'Copilot Chat in Agent mode picks up the tools.'],
    docs: 'https://code.visualstudio.com/docs/copilot/customization/mcp-servers',
    platforms: ['mac', 'windows', 'linux'],
    verifyHint: 'In Copilot Chat (Agent mode): "Ping Photoshop and list open documents."',
    logo: true,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    maker: 'Anthropic',
    tier: 1,
    mechanism: 'download',
    deeplink: () => MCPB_URL,
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      paths: {
        mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
        windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
      },
      location: 'Settings → Developer → Edit Config',
    },
    steps: [
      'Download the .mcpb bundle and double-click it — Claude Desktop shows an Install dialog.',
      'No Node.js needed for the bundle; the manual JSON route needs Node 18+.',
      'Restart Claude Desktop after installing.',
    ],
    docs: 'https://modelcontextprotocol.io/quickstart/user',
    platforms: ['mac', 'windows'],
    verifyHint: 'Start a new chat and type: "Ping Photoshop and list open documents."',
    logo: true,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    maker: 'Anthropic',
    tier: 1,
    mechanism: 'cli',
    cli: `claude mcp add ${SERVER_ID} -- ${STDIO_COMMAND}`,
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'Project .mcp.json (add --scope project) or user settings (--scope user)',
    },
    steps: ['Run the command in any terminal.', 'Add --scope user to make it available in every project.'],
    docs: 'https://docs.claude.com/en/docs/claude-code/mcp',
    platforms: ['mac', 'windows', 'linux'],
    verifyHint: 'Run claude, then: "Ping Photoshop and list open documents."',
    logo: true,
  },
  {
    id: 'web-ui',
    name: 'Web UI',
    maker: 'Photoshop MCP',
    tier: 1,
    mechanism: 'cli',
    cli: UI_COMMAND,
    steps: [
      'Runs a local chat at 127.0.0.1 and opens your browser.',
      'Sign in with an API key (Anthropic, OpenAI, Google, OpenRouter) or reuse your Claude Code account.',
    ],
    docs: '/docs/web-ui',
    platforms: ['mac', 'windows'],
    verifyHint: 'Type in the chat: "Ping Photoshop and list open documents."',
  },

  // ── Tier 2 — Getting Started tabs ─────────────────────────────────────
  {
    id: 'windsurf',
    name: 'Windsurf',
    maker: 'Windsurf (Codeium)',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      paths: {
        mac: '~/.codeium/windsurf/mcp_config.json',
        windows: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json',
        linux: '~/.codeium/windsurf/mcp_config.json',
      },
      location: 'Cascade → MCP toolbar → Configure → View raw config',
    },
    docs: 'https://docs.windsurf.com/windsurf/cascade/mcp',
    platforms: ['mac', 'windows', 'linux'],
    logo: true,
  },
  {
    id: 'zed',
    name: 'Zed',
    maker: 'Zed Industries',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: JSON.stringify(
        { context_servers: { [SERVER_ID]: { source: 'custom', ...entryObj, env: {} } } },
        null,
        2,
      ),
      location: 'Settings → AI → MCP Servers → Add Server → Add Local Server (writes settings.json)',
    },
    docs: 'https://zed.dev/docs/ai/mcp',
    platforms: ['mac', 'linux', 'windows'],
    logo: true,
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    maker: 'OpenAI',
    tier: 2,
    mechanism: 'cli',
    cli: `codex mcp add ${SERVER_ID} -- ${STDIO_COMMAND}`,
    config: {
      format: 'toml',
      snippet: `[mcp_servers.${SERVER_ID}]\ncommand = "${SERVER.command}"\nargs = ${JSON.stringify([...SERVER.args])}`,
      paths: {
        mac: '~/.codex/config.toml',
        windows: '%USERPROFILE%\\.codex\\config.toml',
        linux: '~/.codex/config.toml',
      },
    },
    docs: 'https://github.com/openai/codex/blob/main/docs/config.md',
    platforms: ['mac', 'linux', 'windows'],
    logo: true,
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    maker: 'Google',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      paths: {
        mac: '~/.gemini/config/mcp_config.json',
        windows: '%USERPROFILE%\\.gemini\\config\\mcp_config.json',
        linux: '~/.gemini/config/mcp_config.json',
      },
      location:
        'IDE: Agent panel → ⋯ → MCP Servers → Manage → View raw config. CLI (agy): ~/.gemini/antigravity-cli/mcp_config.json or .agents/mcp_config.json in a workspace.',
    },
    docs: 'https://antigravity.google/',
    platforms: ['mac', 'windows', 'linux'],
    logo: true,
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    maker: 'Google',
    tier: 2,
    mechanism: 'cli',
    cli: `gemini mcp add ${SERVER_ID} ${STDIO_COMMAND}`,
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      paths: { mac: '~/.gemini/settings.json', windows: '%USERPROFILE%\\.gemini\\settings.json', linux: '~/.gemini/settings.json' },
    },
    caution:
      'Gemini CLI stopped serving individual Google accounts on June 18, 2026. Use it only with a Gemini API key or an enterprise Gemini Code Assist license; otherwise pick Antigravity.',
    docs: 'https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html',
    platforms: ['mac', 'windows', 'linux'],
  },
  {
    id: 'cline',
    name: 'Cline',
    maker: 'Cline',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'VS Code → Cline → MCP Servers → Installed → Configure MCP Servers (cline_mcp_settings.json)',
    },
    docs: 'https://docs.cline.bot/mcp/configuring-mcp-servers',
    platforms: ['mac', 'windows', 'linux'],
    logo: true,
  },
  {
    id: 'kiro',
    name: 'Kiro',
    maker: 'AWS',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: jsonSnippet('mcpServers', { disabled: false, autoApprove: [] }),
      paths: {
        mac: '~/.kiro/settings/mcp.json',
        windows: '%USERPROFILE%\\.kiro\\settings\\mcp.json',
        linux: '~/.kiro/settings/mcp.json',
      },
    },
    docs: 'https://kiro.dev/docs/mcp/',
    platforms: ['mac', 'windows', 'linux'],
  },
  {
    id: 'jetbrains',
    name: 'JetBrains AI Assistant',
    maker: 'JetBrains',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add → As JSON',
    },
    docs: 'https://www.jetbrains.com/help/ai-assistant/mcp.html',
    platforms: ['mac', 'windows', 'linux'],
    logo: true,
  },
  {
    id: 'warp',
    name: 'Warp',
    maker: 'Warp',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'Warp → Settings → AI → Manage MCP servers → + Add → paste JSON',
    },
    docs: 'https://docs.warp.dev/knowledge-and-collaboration/mcp',
    platforms: ['mac', 'windows', 'linux'],
  },
  {
    id: 'goose',
    name: 'Goose',
    maker: 'Block',
    tier: 2,
    mechanism: 'deeplink',
    deeplink: () =>
      `goose://extension?cmd=${SERVER.command}&arg=${encodeURIComponent(SERVER.args[0])}&arg=${encodeURIComponent(SERVER.args[1])}&id=${SERVER_ID}&name=${encodeURIComponent('Photoshop MCP')}&description=${encodeURIComponent('Control Adobe Photoshop from chat')}`,
    steps: ['Opens Goose Desktop with an install prompt.', 'Goose CLI: goose configure → Add Extension → Command-line Extension.'],
    docs: 'https://block.github.io/goose/docs/getting-started/using-extensions',
    platforms: ['mac', 'windows', 'linux'],
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    maker: 'LM Studio',
    tier: 2,
    mechanism: 'deeplink',
    deeplink: (c) => `lmstudio://add_mcp?name=${SERVER_ID}&config=${encodeURIComponent(c.entryB64)}`,
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'Program tab → Install → Edit mcp.json',
    },
    steps: ['Needs LM Studio 0.3.17 or later and a local model with tool calling (Qwen, Llama 3.1+, Mistral).'],
    docs: 'https://lmstudio.ai/docs/app/mcp/deeplink',
    platforms: ['mac', 'windows', 'linux'],
  },
  {
    id: 'raycast',
    name: 'Raycast',
    maker: 'Raycast',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'Raycast → "Manage MCP Servers" → Install from JSON',
    },
    docs: 'https://manual.raycast.com/model-context-protocol',
    platforms: ['mac', 'windows'],
  },
  {
    id: 'opencode',
    name: 'opencode',
    maker: 'SST',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: JSON.stringify(
        {
          mcp: {
            [SERVER_ID]: { type: 'local', command: [SERVER.command, ...SERVER.args], enabled: true },
          },
        },
        null,
        2,
      ),
      location: 'opencode.json in the project root, or ~/.config/opencode/opencode.json',
    },
    docs: 'https://opencode.ai/docs/mcp-servers/',
    platforms: ['mac', 'linux', 'windows'],
  },
  {
    id: 'trae',
    name: 'Trae',
    maker: 'ByteDance',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'AI side panel → Settings → MCP → Add → Manual configuration',
    },
    docs: 'https://docs.trae.ai/ide/model-context-protocol',
    platforms: ['mac', 'windows'],
  },
  {
    id: 'visual-studio',
    name: 'Visual Studio',
    maker: 'Microsoft',
    tier: 2,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: jsonSnippet('servers', { type: 'stdio' }),
      paths: { windows: '%USERPROFILE%\\.mcp.json' },
      location: 'Solution-level .mcp.json, or %USERPROFILE%\\.mcp.json for every solution',
    },
    docs: 'https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers',
    platforms: ['windows'],
  },

  // ── Tier 3 — anything else ────────────────────────────────────────────
  {
    id: 'other',
    name: 'Other clients',
    maker: '',
    tier: 3,
    mechanism: 'config',
    config: {
      format: 'json',
      snippet: MCP_SERVERS_JSON,
      location: 'Any client that runs local (stdio) MCP servers — paste this into its MCP config',
    },
    cli: `npx @modelcontextprotocol/inspector ${STDIO_COMMAND}`,
    steps: [
      'The Inspector command opens a debugging UI so you can call tools without any client.',
      'ChatGPT and claude.ai in the browser only accept remote connectors and cannot reach a local Photoshop — use the Web UI instead.',
    ],
    docs: 'https://modelcontextprotocol.io/clients',
    platforms: ['mac', 'windows', 'linux'],
  },
];

export const TIER1 = CLIENTS.filter((c) => c.tier === 1);
export const TIER2 = CLIENTS.filter((c) => c.tier === 2);
export const LOGO_CLIENTS = CLIENTS.filter((c) => c.logo);

export function clientById(id: string): ClientDef | undefined {
  return CLIENTS.find((c) => c.id === id);
}
