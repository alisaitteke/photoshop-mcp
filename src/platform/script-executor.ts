export interface ScriptExecutor {
  /**
   * Execute a script in Photoshop
   * @param script - The script code to execute
   * @param timeout - Timeout in milliseconds (default: 30000)
   * @returns The result from the script execution
   */
  execute(script: string, timeout?: number): Promise<unknown>;

  /**
   * Check if Photoshop is running
   */
  isPhotoshopRunning(): Promise<boolean>;

  /**
   * Launch Photoshop if not running
   */
  launchPhotoshop(photoshopPath: string): Promise<void>;
}

export interface ScriptResult {
  success: boolean;
  result?: unknown;
  error?: string;
}
