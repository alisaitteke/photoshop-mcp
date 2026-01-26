import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../utils/logger.js';

export interface ToolHandler {
  (args: Record<string, unknown>): Promise<CallToolResult>;
}

export type ToolResult = CallToolResult;

export interface ToolDefinition {
  tool: Tool;
  handler: ToolHandler;
}

export class ToolRegistry {
  private logger: Logger;
  private tools: Map<string, ToolDefinition>;

  constructor() {
    this.logger = new Logger('ToolRegistry');
    this.tools = new Map();
  }

  register(name: string, definition: ToolDefinition): void {
    if (this.tools.has(name)) {
      this.logger.warn(`Tool '${name}' already registered, overwriting`);
    }

    this.tools.set(name, definition);
    this.logger.debug(`Registered tool: ${name}`);
  }

  unregister(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      this.logger.debug(`Unregistered tool: ${name}`);
    }
    return result;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values()).map((def) => def.tool);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const definition = this.tools.get(name);
    
    if (!definition) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      this.logger.debug(`Executing tool: ${name}`);
      const result = await definition.handler(args);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${name}`, error);
      throw error;
    }
  }

  clear(): void {
    this.tools.clear();
    this.logger.debug('All tools cleared');
  }

  count(): number {
    return this.tools.size;
  }
}
