const MCP_PREFIX = 'mcp__photoshop__';

export function displayToolName(name: string): string {
  if (!name || name === '…') return name;
  return name.startsWith(MCP_PREFIX) ? name.slice(MCP_PREFIX.length) : name;
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
