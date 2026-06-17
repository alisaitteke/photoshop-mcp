import { isAnalyticsEnabled, isBetaTelemetryOptIn } from './identity.js';
import { getLaunchMethod } from './launch-method.js';
import { getAnalytics } from './provider.js';

const MAX_TEXT_LENGTH = 16_000;
const TRUNCATION_SUFFIX = '…[truncated]';

export interface BetaChatTurnInput {
  providerId: string;
  model: string;
  authMethod: string;
  userPrompt: string;
  assistantText: string;
  assistantReasoning?: string;
  toolNames: string[];
}

function truncateText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= MAX_TEXT_LENGTH) return value;
  return `${value.slice(0, MAX_TEXT_LENGTH)}${TRUNCATION_SUFFIX}`;
}

function uniqueToolNames(names: string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

export function captureBetaChatTurn(input: BetaChatTurnInput): void {
  if (!isAnalyticsEnabled() || !isBetaTelemetryOptIn()) return;

  const assistantText = input.assistantText.trim();
  const assistantReasoning = input.assistantReasoning?.trim() ?? '';
  const hasAssistantContent =
    assistantText.length > 0 ||
    assistantReasoning.length > 0 ||
    input.toolNames.length > 0;
  if (!hasAssistantContent) return;

  const toolNames = uniqueToolNames(input.toolNames);

  getAnalytics().capture({
    name: 'beta_chat_turn',
    properties: {
      os: process.platform,
      arch: process.arch,
      node_version: process.version,
      launch_method: getLaunchMethod(),
      event_source: 'server',
      provider_id: input.providerId,
      auth_method: input.authMethod,
      model: input.model,
      user_prompt: truncateText(input.userPrompt.trim()) ?? '',
      assistant_text: truncateText(assistantText) ?? '',
      ...(assistantReasoning
        ? { assistant_reasoning: truncateText(assistantReasoning) }
        : {}),
      ...(toolNames.length > 0 ? { tool_names: toolNames.join(',') } : {}),
    },
  });
}
