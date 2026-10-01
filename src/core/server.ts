import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listPreviewResources, readPreviewResource } from '../apps/preview-resources.js';
import { Logger } from '../utils/logger.js';
import {
  onMcpClientConnected,
  onMcpClientDisconnected,
  recordMcpPromptRequest,
  recordMcpToolCall,
} from '../analytics/index.js';
import { ToolRegistry, ToolDefinition } from './tool-registry.js';
import { PromptRegistry } from './prompt-registry.js';
import { Session } from './session.js';
import { wrapToolHandler } from '../errors/envelope.js';
import { withOptionalDocumentId, wrapDocumentIdHandler } from './document-target.js';
import { withToolAnnotations } from './tool-annotations.js';
import { buildPhotoshopInstructions } from '../prompts/instructions.js';
import { registerPhotoshopPrompts } from '../prompts/registry.js';
import { createDocumentTools } from '../tools/document-tools.js';
import { createLayerTools } from '../tools/layer-tools.js';
import { createImageTools } from '../tools/image-tools.js';
import { createImagePlacementTools } from '../tools/image-placement-tools.js';
import { createSmartObjectTools } from '../tools/smart-object-tools.js';
import { createLayerTransformTools } from '../tools/layer-transform-tools.js';
import { createLayerPropertiesTools } from '../tools/layer-properties-tools.js';
import { createFilterTools } from '../tools/filter-tools.js';
import { createAdjustmentTools } from '../tools/adjustment-tools.js';
import { createTextTools } from '../tools/text-tools.js';
import { createSelectionTools } from '../tools/selection-tools.js';
import { createMaskTools } from '../tools/mask-tools.js';
import { createActionTools } from '../tools/action-tools.js';
import { createHistoryTools } from '../tools/history-tools.js';
import { createLayerOrderingTools } from '../tools/layer-ordering-tools.js';
import { createStateTools } from '../tools/state-tools.js';
import { createRecipeTools } from '../tools/recipes/index.js';
import { createGenerativeTools } from '../tools/generative-tools.js';
import { createNeuralTools } from '../tools/neural-tools.js';
import { createStyleTools } from '../tools/style-tools.js';
import { createColorAdjustmentTools } from '../tools/color-adjustment-tools.js';
import { createDataTools } from '../tools/data-tools.js';
import { createStackTools } from '../tools/stack-tools.js';
import { createExportTools } from '../tools/export-tools.js';
import { createArtboardTools } from '../tools/artboard-tools.js';
import { createSessionTools } from '../tools/session-tools.js';
import { ensureUxpBridgeServer } from '../platform/uxp-bridge-server.js';
import { submitFeedbackFromArgs } from '../feedback/nudge.js';
import { probePhotoshopEngine } from './ping-engine.js';
import { refreshUpdateCheck } from '../update/check.js';

export interface PhotoshopMCPServerOptions {
  serverVersion: string;
}

export class PhotoshopMCPServer {
  private server: Server;
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  private promptRegistry: PromptRegistry;
  private session: Session;

  constructor(options: PhotoshopMCPServerOptions) {
    this.logger = new Logger('PhotoshopMCPServer');
    this.toolRegistry = new ToolRegistry();
    this.promptRegistry = new PromptRegistry();
    this.session = new Session();

    this.server = new Server(
      {
        name: 'photoshop-mcp',
        version: options.serverVersion,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
        instructions: buildPhotoshopInstructions(),
      }
    );

    registerPhotoshopPrompts(this.promptRegistry);
    this.registerTools();
    this.setupHandlers();
  }

  private registerToolDefinition(definition: ToolDefinition): void {
    const tool = withToolAnnotations(withOptionalDocumentId(definition.tool));
    this.toolRegistry.register(tool.name, {
      tool,
      handler: wrapToolHandler(tool.name, wrapDocumentIdHandler(definition.handler)),
    });
  }

  private registerToolDefinitions(definitions: ToolDefinition[]): void {
    definitions.forEach((def) => this.registerToolDefinition(def));
  }

  private registerTools() {
    this.registerToolDefinitions(
      createSessionTools({
        ping: async () => this.pingPhotoshop(),
        feedback: async (args) => submitFeedbackFromArgs(args),
        version: async () => this.getVersion(),
      })
    );

    const connection = this.session.getConnection();

    void ensureUxpBridgeServer().catch((err) => {
      this.logger.debug('UXP bridge server not started:', err);
    });

    this.registerToolDefinitions(createDocumentTools(connection));
    this.registerToolDefinitions(createLayerTools(connection));
    this.registerToolDefinitions(createImageTools(connection));
    this.registerToolDefinitions(createImagePlacementTools(connection));
    this.registerToolDefinitions(createSmartObjectTools(connection));
    this.registerToolDefinitions(createLayerTransformTools(connection));
    this.registerToolDefinitions(createLayerPropertiesTools(connection));
    this.registerToolDefinitions(createFilterTools(connection));
    this.registerToolDefinitions(createAdjustmentTools(connection));
    this.registerToolDefinitions(createTextTools(connection));
    this.registerToolDefinitions(createSelectionTools(connection));
    this.registerToolDefinitions(createMaskTools(connection));
    this.registerToolDefinitions(createActionTools(connection));
    this.registerToolDefinitions(createHistoryTools(connection));
    this.registerToolDefinitions(createLayerOrderingTools(connection));
    this.registerToolDefinitions(createStateTools(connection));
    this.registerToolDefinitions(createGenerativeTools(connection));
    this.registerToolDefinitions(createNeuralTools(connection));
    this.registerToolDefinitions(createStyleTools(connection));
    this.registerToolDefinitions(createColorAdjustmentTools(connection));
    this.registerToolDefinitions(createDataTools(connection));
    this.registerToolDefinitions(createStackTools(connection));
    this.registerToolDefinitions(createExportTools(connection));
    this.registerToolDefinitions(createArtboardTools(connection));
    this.registerToolDefinitions(createRecipeTools(connection));

    this.logger.info(
      `Registered ${this.toolRegistry.count()} tools and ${this.promptRegistry.count()} prompts`
    );
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Listing available tools');
      return { tools: this.toolRegistry.list() };
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      this.logger.debug('Listing available prompts');
      return { prompts: this.promptRegistry.list() };
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return listPreviewResources();
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return readPreviewResource(request.params.uri);
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const name = request.params.name;
      const args = (request.params.arguments as Record<string, string>) || {};
      this.logger.debug(`Prompt requested: ${name}`);
      recordMcpPromptRequest(name, this.promptRegistry.count());
      return await this.promptRegistry.get(name, args);
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const started = Date.now();
      this.logger.debug(`Tool called: ${toolName}`);

      try {
        const args = (request.params.arguments as Record<string, unknown>) || {};
        const result = await this.toolRegistry.execute(toolName, args);
        this.session.updateActivity();
        return result;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Tool not found:')) {
          recordMcpToolCall({
            toolName,
            ok: false,
            errorCode: 'tool_not_found',
            durationMs: Date.now() - started,
          });
        }
        throw error;
      }
    });
  }

  private async pingPhotoshop() {
    // Long-lived hosts (Claude Desktop) keep one server across chats; refresh the cached
    // release here too (at most once per 24h), racing the probe so this ping can use it.
    void refreshUpdateCheck();
    return probePhotoshopEngine(this.session.getConnection());
  }

  private async getVersion() {
    const connection = this.session.getConnection();
    const version = await connection.getVersion();
    return {
      content: [
        {
          type: 'text' as const,
          text: `Photoshop version: ${version}`,
        },
      ],
    };
  }

  isPhotoshopConnected(): boolean {
    return this.session.getConnectionStatus();
  }

  getToolCount(): number {
    return this.toolRegistry.count();
  }

  async getPhotoshopVersion(): Promise<string | undefined> {
    if (!this.session.getConnectionStatus()) return undefined;

    try {
      const version = await this.session.getConnection().getVersion();
      if (!version || version === 'Unknown') return undefined;
      return version;
    } catch {
      return undefined;
    }
  }

  async start() {
    await this.session.initialize();

    this.server.oninitialized = () => {
      onMcpClientConnected(this.server.getClientVersion());
    };
    this.server.onclose = () => {
      onMcpClientDisconnected();
    };

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('MCP Server connected via stdio');
  }

  async stop() {
    await this.session.disconnect();
    this.logger.info('MCP Server stopped');
  }
}
