import type { PlanStepStatus } from '@/lib/api';
import type { ToolCall } from '@/stores/chat';

export type ToolStepStatus = 'pending' | 'running' | 'done' | 'error' | 'success';

/** Parse envelope `ok` from persisted result content; undefined when not an envelope. */
export function envelopeOkFromContent(content: string): boolean | undefined {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    if ('ok' in parsed && typeof (parsed as { ok: unknown }).ok === 'boolean') {
      return (parsed as { ok: boolean }).ok;
    }
  } catch {
    // not JSON envelope
  }
  return undefined;
}

/** Derive display status; re-checks result.content for persisted chats with wrong status. */
export function effectiveToolStatus(
  tc: ToolCall,
  stepStatus?: PlanStepStatus
): ToolStepStatus {
  const envelopeOk = tc.result?.content ? envelopeOkFromContent(tc.result.content) : undefined;
  if (envelopeOk === false) return 'error';
  if (tc.status === 'error' || stepStatus === 'error') return 'error';
  if (tc.status === 'success' || stepStatus === 'done') return 'done';
  if (stepStatus === 'running') return 'running';
  if (tc.status === 'pending') return 'pending';
  return tc.status;
}
