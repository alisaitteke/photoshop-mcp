import type { ProviderId } from '@/lib/api';

const CLI_HINTS: Partial<
  Record<ProviderId, { install: string; login: string; binary: string }>
> = {
  anthropic: {
    install: 'npm install -g @anthropic-ai/claude-code',
    login: 'claude auth login',
    binary: 'claude',
  },
  google: {
    install: 'npm install -g @google/gemini-cli',
    login: 'gemini auth login',
    binary: 'gemini',
  },
};

function machineErrorCode(error: string | undefined): string {
  if (!error) return 'unknown';
  const colon = error.indexOf(':');
  return colon === -1 ? error : error.slice(0, colon);
}

/**
 * Turn server CLI validation codes into actionable onboarding/settings copy.
 */
export function formatCliAuthError(
  error: string | undefined,
  providerId?: ProviderId,
  detail?: string
): string {
  const code = machineErrorCode(error);
  const hint = providerId ? CLI_HINTS[providerId] : undefined;
  const detailLine = detail?.trim() ? `Details: ${detail.trim()}` : '';

  switch (code) {
    case 'not_authenticated':
      return [
        'CLI subscription login was not detected.',
        hint
          ? `Install: ${hint.install}. Then run: ${hint.login}`
          : 'Install the provider CLI and run its login command in Terminal.',
        'Anthropic API keys and Agent SDK sessions do not satisfy "Uses your account" mode — choose API key auth instead, or log in with the CLI.',
        'If login works in Terminal but fails here, set an optional CLI path below (custom install location).',
        detailLine,
      ]
        .filter(Boolean)
        .join('\n');

    case 'cli_not_found':
      return [
        hint
          ? `Could not find "${hint.binary}" on PATH.`
          : 'Could not find the provider CLI on PATH.',
        hint ? `Install: ${hint.install}` : 'Install the provider CLI globally.',
        hint ? `Then run: ${hint.login}` : undefined,
        'Or enter the full path to the CLI binary below.',
        detailLine,
      ]
        .filter(Boolean)
        .join('\n');

    case 'cli_probe_failed':
      return [
        'The CLI probe failed.',
        hint ? `Try ${hint.login} again, then re-check the connection.` : undefined,
        detailLine || (error && error !== code ? error : undefined),
      ]
        .filter(Boolean)
        .join('\n');

    case 'cli_account_not_supported':
      return 'This provider does not support CLI account auth. Use an API key instead.';

    default:
      return [error || 'CLI validation failed.', detailLine].filter(Boolean).join('\n');
  }
}
