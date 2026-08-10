/**
 * Generate llms.txt, llms-full.txt for the GitHub Pages site (llmstxt.org v2).
 * Run: npx tsx scripts/generate-site-discoverability.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_PUBLIC = join(ROOT, 'site', 'public');
const SITE_URL = 'https://alisaitteke.github.io/photoshop-mcp';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function readOptional(path: string, maxChars?: number): string {
  try {
    const text = readFileSync(path, 'utf8').trim();
    if (maxChars && text.length > maxChars) {
      return `${text.slice(0, maxChars).trimEnd()}…\n`;
    }
    return text;
  } catch {
    return '';
  }
}

function llmsTxt(): string {
  const v = pkg.version;
  return `# Photoshop MCP

> MCP server for Adobe Photoshop — ${v} — 102 tools (generative AI + 16 recipe workflows), standalone web UI, and state-aware agent workflows. Control Photoshop from Cursor, Claude Desktop, Claude Code, or natural language. Unofficial; not affiliated with Adobe.

Important notes:

- Prefer \`photoshop_recipe_*\` for multi-step outcomes (single Photoshop undo step); use atomic \`photoshop_*\` tools for precise edits.
- Agent workflow: \`get_capabilities\` → \`get_state\` → act → \`get_preview\` to verify.
- Prerequisites: Adobe Photoshop running on Windows or macOS, Node.js 18+.
- MCP stdio: \`npx -y @alisaitteke/photoshop-mcp\` · Standalone UI: \`npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui\`

## Docs

- [Home](${SITE_URL}/): Marketing landing — quick start, features, links
- [Full README](${SITE_URL}/readme/): Install, MCP client config, standalone UI, tool catalog overview
- [Architecture](${SITE_URL}/docs/architecture/): System design, data flow, platform abstraction
- [Available tools](${SITE_URL}/docs/available-tools/): Complete \`photoshop_*\` tool reference
- [Prompt layer](${SITE_URL}/docs/prompt-layer/): MCP prompts, recipes, server instructions
- [Development](${SITE_URL}/docs/development/): Local build, testing, UXP bridge plugin
- [Troubleshooting](${SITE_URL}/docs/troubleshooting/): Common connection and script errors

## Translations

- [Türkçe README](${SITE_URL}/tr/readme/): Turkish full README
- [简体中文 README](${SITE_URL}/zh/readme/): Chinese full README
- [Español README](${SITE_URL}/es/readme/): Spanish full README
- [Deutsch README](${SITE_URL}/de/readme/): German full README
- [日本語 README](${SITE_URL}/ja/readme/): Japanese full README

## Distribution

- [npm package](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp): \`@alisaitteke/photoshop-mcp\`
- [MCP Registry](https://registry.modelcontextprotocol.io): \`io.github.alisaitteke/photoshop-mcp\`
- [GitHub repository](https://github.com/alisaitteke/photoshop-mcp): Source, issues, releases
- [Agent map (AGENTS.md)](https://github.com/alisaitteke/photoshop-mcp/blob/main/AGENTS.md): Navigation for coding agents

## Optional

- [Usage analytics](${SITE_URL}/docs/anonymous-usage-analytics/): Opt-out anonymous telemetry
- [Social preview assets](${SITE_URL}/docs/social-preview/): OG image and share copy
- [Sitemap](${SITE_URL}/sitemap.xml): All canonical site URLs
- [llms-full.txt](${SITE_URL}/llms-full.txt): This index plus condensed architecture and quick-start text
`;
}

function llmsFullTxt(): string {
  const architecture = readOptional(join(ROOT, 'docs', 'architecture.md'), 12000);
  const llmsRoot = readOptional(join(ROOT, 'llms.txt'), 8000);

  return [
    llmsTxt(),
    '',
    '---',
    '',
    '# Repository llms.txt (canonical npm/GitHub summary)',
    '',
    llmsRoot.replace(/\*\*Website:\*\*.*\n/, `**Website:** ${SITE_URL}/\n`),
    '',
    '---',
    '',
    '# Architecture (excerpt from docs/architecture.md)',
    '',
    architecture,
  ].join('\n');
}

function rootLlmsTxt(): string {
  const v = pkg.version;
  return `# photoshop-mcp

> MCP server for Adobe Photoshop — ${v} — 102 tools (generative AI + recipes), standalone web UI, and state-aware agent workflows. Unofficial; not affiliated with Adobe.

**Website:** ${SITE_URL}/
**llms.txt (site):** ${SITE_URL}/llms.txt
**llms-full.txt:** ${SITE_URL}/llms-full.txt

## Quick start

\`\`\`bash
# MCP server (stdio) — use with Cursor, Claude Desktop, Claude Code, VS Code
npx -y @alisaitteke/photoshop-mcp

# Standalone web UI (local chat + Photoshop, no IDE required)
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
\`\`\`

**Prerequisites:** Adobe Photoshop (Windows or macOS), Node.js 18+. Photoshop must be running. Optional UXP bridge plugin in \`uxp-plugin/\` for Neural Filters.

## Agent workflow

\`\`\`
get_capabilities → get_state → (recipe or atomic tool) → get_preview to verify
\`\`\`

Prefer \`photoshop_recipe_*\` for multi-step outcomes (single undo step). Use atomic \`photoshop_*\` tools for fine-grained edits. On failure, read structured error envelopes (\`code\`, \`suggested_next_tool\`) and call \`get_state\` before retrying.

## MCP client configuration

\`\`\`json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": { "LOG_LEVEL": "1" }
    }
  }
}
\`\`\`

Claude Code one-liner:

\`\`\`bash
claude mcp add photoshop -- npx -y @alisaitteke/photoshop-mcp
\`\`\`

## Tool surface

- **102 tools** — 86 atomic + 16 recipe (\`photoshop_recipe_*\`)
- **23 MCP prompts** — \`ps.remove_background\`, \`ps.enhance_portrait\`, \`ps.generative_fill\`, …
- **Generative AI** — fill, remove, expand, upscale, sky replacement, generate image (Adobe account)
- **State** — \`photoshop_get_state\`, \`photoshop_get_preview\`, \`photoshop_get_capabilities\`
- **Standalone UI** — Action Plan (beta): plan all steps in one LLM call, then execute

## Distribution

- npm: \`@alisaitteke/photoshop-mcp\` (https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
- MCP Registry: \`io.github.alisaitteke/photoshop-mcp\` (https://registry.modelcontextprotocol.io)
- GitHub: https://github.com/alisaitteke/photoshop-mcp

## Documentation (web)

- [Home](${SITE_URL}/)
- [Full README](${SITE_URL}/readme/)
- [Architecture](${SITE_URL}/docs/architecture/)
- [Available tools](${SITE_URL}/docs/available-tools/)
- [Prompt layer](${SITE_URL}/docs/prompt-layer/)
- [Development](${SITE_URL}/docs/development/)
- [Troubleshooting](${SITE_URL}/docs/troubleshooting/)
- [AGENTS.md](https://github.com/alisaitteke/photoshop-mcp/blob/main/AGENTS.md)
`;
}

writeFileSync(join(SITE_PUBLIC, 'llms.txt'), llmsTxt(), 'utf8');
writeFileSync(join(SITE_PUBLIC, 'llms-full.txt'), llmsFullTxt(), 'utf8');
writeFileSync(join(ROOT, 'llms.txt'), rootLlmsTxt(), 'utf8');

console.log('discoverability files written: site/public/llms.txt, llms-full.txt, llms.txt');
