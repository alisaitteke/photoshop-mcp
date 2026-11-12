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
          'Returns: "Successfully connected to Photoshop" only after a short script runs inside Photoshop. While a previous script is still running, returns extendscript_timeout — retry photoshop_ping. If that timeout happens while the OS drive has under 10 GB free, returns scratch_disk_full instead: free space on the scratch disk and restart Photoshop. If Photoshop is not installed or not running, returns "Failed to connect to Photoshop" plus a second text block saying which, and does not launch the app. On macOS, Apple-event failures return photoshop_unreachable, automation_permission_denied or photoshop_app_not_resolved with the osascript error and a fix. May append a FEEDBACK_NUDGE block 15 minutes after the first successful ping, then at most once per 7 days (30 days after the user shared feedback), but not while another tool ran in the last 3 minutes (disabled with PSMCP_FEEDBACK=0). May append an UPDATE_AVAILABLE block when a newer photoshop-mcp release is on npm, at most once per 7 days (disabled with PSMCP_UPDATE_CHECK=0). A single ping carries at most one of these blocks.\n' +
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
          'Use when: photoshop_ping returned a FEEDBACK_NUDGE block, you asked the question, and the user answered (in the host question UI such as Cursor AskQuestion / Claude AskUserQuestion, or in their next chat message).\n' +
          'Do NOT use when: ping had no FEEDBACK_NUDGE — never invent this question. Do NOT use when the user has not answered yet — never submit a placeholder, a guess or your own summary.\n' +
          'Do not start implementing the suggestion.\n\n' +
          'Returns: { ok, recorded, next }. choice "yes" without a suggestion returns invalid_arguments and records nothing. After this call, continue the user\'s Photoshop request if it is not finished.\n' +
          'Preconditions: none. Side effects: persists a local cooldown flag and may send an anonymous analytics event.',
        inputSchema: {
          type: 'object',
          properties: {
            choice: {
              type: 'string',
              enum: ['yes', 'not_now', 'dont_ask'],
              description:
                'yes = the user named a problem or a missing feature (suggestion required); not_now = skip for now; dont_ask = never prompt again',
            },
            suggestion: {
              type: 'string',
              description:
                "Required when choice is yes: the user's own words in their own language, lightly trimmed (up to 500 characters are kept). Never a placeholder, a guess or your own summary or ideas. Omit otherwise.",
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
