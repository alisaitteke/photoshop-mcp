import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** What AppleScript and pgrep need to address one installed Photoshop. */
export interface MacAppTarget {
  /** Bundle display name, e.g. "Adobe Photoshop 2026". Fallback target and log label. */
  appName: string;
  /** Full .app bundle path when known. Preferred: it names exactly one install. */
  appPath?: string;
}

export type CommandRunner = (file: string, args: string[]) => Promise<{ stdout: string }>;

const RUNNING_CHECK_TIMEOUT_MS = 10_000;

const defaultRunner: CommandRunner = async (file, args) => {
  const { stdout } = await execFileAsync(file, args, { timeout: RUNNING_CHECK_TIMEOUT_MS });
  return { stdout: String(stdout) };
};

/** Escape a string for use as a pgrep -f pattern (extended regex). */
export function escapeForPgrep(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * osascript failures meaning AppleScript could not resolve the application
 * itself: -1728 (can't get it), -2741 (its terms did not load, so the script
 * did not compile), -10814 (Launch Services found no such app). The script
 * never reached Photoshop.
 */
export const MAC_APP_NOT_RESOLVED_PATTERN = /\((?:-1728|-2741|-10814)\)/;

/** Quote a value as an AppleScript string literal. */
export function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The .app bundle that contains `path`, or undefined when `path` is not inside
 * one. PHOTOSHOP_PATH may name the bundle, the bundle with a trailing slash, or
 * the executable under Contents/MacOS.
 */
export function bundlePathOf(path: string): string | undefined {
  const match = /^(.*?\.app)(?:\/.*)?$/.exec(path.trim());
  return match ? match[1] : undefined;
}

/**
 * `application "<bundle path>"`, or by name when no path is known. A path names
 * exactly the detected install (2025, 2026 and Beta share com.adobe.Photoshop)
 * and does not depend on Launch Services resolving the display name (#72).
 */
export function appleScriptAppRef(target: MacAppTarget): string {
  return `application ${appleScriptString(target.appPath ?? target.appName)}`;
}

/**
 * pgrep -f pattern for the app's own executable. Anchored at the start of the
 * command line: AdobeIPCBroker carries the Photoshop executable path in its
 * arguments, so an unanchored match reports a closed Photoshop as running.
 */
export function executablePgrepPattern(appPath: string): string {
  return `^${escapeForPgrep(appPath)}/Contents/MacOS/`;
}

/** pgrep exit code for "no process matched" (3 means it could not read the process list). */
const PGREP_NO_MATCH = 1;

/**
 * Whether this exact install is running. An anchored pgrep comes first: it
 * matches only this bundle's executable, while AppleScript may answer for any
 * running copy because 2025, 2026 and Beta share com.adobe.Photoshop. When
 * pgrep cannot read the process list (exit 3 inside an agent sandbox),
 * AppleScript answers instead: `running` never launches the app.
 */
export async function isMacAppRunning(
  target: MacAppTarget,
  run: CommandRunner = defaultRunner
): Promise<boolean> {
  if (target.appPath) {
    try {
      const { stdout } = await run('pgrep', ['-f', executablePgrepPattern(target.appPath)]);
      return stdout.trim().length > 0;
    } catch (error) {
      if ((error as { code?: unknown }).code === PGREP_NO_MATCH) return false;
      // pgrep missing or denied; ask AppleScript.
    }
  }

  try {
    const { stdout } = await run('osascript', ['-e', `${appleScriptAppRef(target)} is running`]);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}
