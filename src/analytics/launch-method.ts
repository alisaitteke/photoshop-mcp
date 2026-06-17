export type LaunchMethod = 'npx' | 'npm' | 'node' | 'unknown';

let cachedLaunchMethod: LaunchMethod | null = null;

function isNpxInvocation(npmExecPath: string, npmCommand: string): boolean {
  if (npmCommand === 'exec' || npmCommand === 'exec-run') return true;

  const normalizedPath = npmExecPath.toLowerCase();
  return (
    normalizedPath.includes('/npx/') ||
    normalizedPath.includes('\\npx\\') ||
    /(?:^|[/\\])npx(?:\.cmd)?$/i.test(npmExecPath)
  );
}

function isNpmScriptInvocation(npmCommand: string): boolean {
  return (
    npmCommand === 'run-script' ||
    npmCommand === 'run' ||
    Boolean(process.env.npm_lifecycle_event?.trim())
  );
}

export function resolveLaunchMethod(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv
): LaunchMethod {
  const npmExecPath = env.npm_execpath?.trim() ?? '';
  const npmCommand = env.npm_command?.trim() ?? '';

  if (isNpxInvocation(npmExecPath, npmCommand)) return 'npx';
  if (isNpmScriptInvocation(npmCommand)) return 'npm';

  const execPath = argv[0]?.trim() ?? '';
  if (/node|tsx|bun/i.test(execPath)) return 'node';

  return 'unknown';
}

export function getLaunchMethod(): LaunchMethod {
  if (!cachedLaunchMethod) {
    cachedLaunchMethod = resolveLaunchMethod();
  }
  return cachedLaunchMethod;
}
