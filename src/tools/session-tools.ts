import type { ToolDefinition, ToolHandler } from '../core/tool-registry.js';

/**
 * Tools registered on the server before a Photoshop connection exists.
 * The intent router reads the same definitions, so Jev's choices stay in
 * lockstep with tools/list.
 */
export function createSessionTools(handlers: {
  ping: ToolHandler;
  feedback: ToolHandler;
  version: ToolHandler;
}): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_ping',
        description:
          'Verify that the Photoshop scripting engine can run a script.\n\n' +
          'Use when: once at session start, and after extendscript_timeout until this call succeeds.\n' +
          'Do NOT use when: on every tool call — after a successful ping, use photoshop_get_state. Do not call get_state or get_layers while this ping is still failing.\n\n' +
          'Returns: "Successfully connected to Photoshop" only after a short script runs inside Photoshop. While a previous script is still running, returns extendscript_timeout — retry photoshop_ping. If that timeout happens while the OS drive has under 10 GB free, returns scratch_disk_full instead: free space on the scratch disk and restart Photoshop. If Photoshop is not installed or not running, returns a failure string and does not launch the app. May append a FEEDBACK_NUDGE block 15 minutes after the first successful ping, then at most once per 7 days (disabled with PSMCP_FEEDBACK=0). May append an UPDATE_AVAILABLE block when a newer photoshop-mcp release is on npm, at most once per 7 days (disabled with PSMCP_UPDATE_CHECK=0). A single ping carries at most one of these blocks.\n' +
          'Preconditions: none. Side effects: may trigger Photoshop detection. Does not launch Photoshop.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: handlers.ping,
    },
    {
      tool: {
        name: 'photoshop_submit_feedback',
        description:
          "Record the user's answer to a Photoshop MCP product-feedback nudge.\n\n" +
          'Use when: photoshop_ping returned a FEEDBACK_NUDGE block and you already asked the user via the host question UI (Cursor AskQuestion / Claude AskUserQuestion) or chat.\n' +
          'Do NOT use when: ping had no FEEDBACK_NUDGE — never invent this question.\n' +
          'Do not start implementing the suggestion.\n\n' +
          "Returns: { ok, recorded, next }. After this call, immediately continue the user's original Photoshop request.\n" +
          'Preconditions: none. Side effects: persists a local cooldown flag and may send an anonymous analytics event.',
        inputSchema: {
          type: 'object',
          properties: {
            choice: {
              type: 'string',
              enum: ['yes', 'not_now', 'dont_ask'],
              description:
                'yes = they have a feature request; not_now = skip this week; dont_ask = never prompt again',
            },
            suggestion: {
              type: 'string',
              description: 'Short feature request. Include when choice is yes; omit otherwise.',
            },
          },
          required: ['choice'],
        },
      },
      handler: handlers.feedback,
    },
    {
      tool: {
        name: 'photoshop_get_version',
        description:
          'Return the detected Photoshop version string.\n\n' +
          'Use when: user asks about compatibility or before version-gated features.\n' +
          'Do NOT use when: you need feature flags — prefer photoshop_get_capabilities.\n\n' +
          'Returns: version string.\n' +
          'Preconditions: none. Side effects: none.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: handlers.version,
    },
  ];
}
