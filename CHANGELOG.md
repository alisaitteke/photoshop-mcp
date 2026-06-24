# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.9] - 2026-06-24

[v1.3.8...v1.3.9](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.8...v1.3.9)

### Features

- feat(release): add GitHub Actions workflow for automated releases on version tags docs(CONTRIBUTING): update contributing guide with release process details docs(README): add GitHub release badge to README for better visibility chore(scripts): add backfill script to create GitHub Releases for existing tags without releases (`be01916`)

### Other

- Add GitHub Sponsors username to FUNDING.yml (`5f619dd`)
- Add GitHub Sponsors username to FUNDING.yml (`d4c2c66`)

### Version bumps

- 1.3.9 (`b8a3f47`)
- 1.3.5 (`7949efc`)
- 1.3.4 (`cfce75b`)

## [1.3.8] - 2026-06-18

[v1.3.7...v1.3.8](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.7...v1.3.8)

### Features

- feat(analytics): add app version retrieval from package.json for server-side events fix(docs): update anonymous usage analytics documentation to clarify app version tracking (`f767166`)

### Version bumps

- 1.3.8 (`b3c3871`)

## [1.3.7] - 2026-06-18

[v1.3.6...v1.3.7](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.6...v1.3.7)

### Features

- feat(analytics): enhance anonymous usage analytics to track MCP client connection and disconnection events feat(analytics): add support for recording active provider and model in analytics feat(analytics): implement usage surface tracking for anonymous profiles feat(analytics): create smoke tests for MCP client analytics functionality fix(analytics): update event properties to include new metrics for MCP client refactor(analytics): reorganize code for better clarity and maintainability chore(docs): update documentation to reflect changes in analytics tracking and events (`8b71106`)

### Version bumps

- 1.3.7 (`f9245c8`)

## [1.3.6] - 2026-06-18

[v1.3.5...v1.3.6](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.5...v1.3.6)

### Version bumps

- 1.3.6 (`9d84bf0`)

## [1.3.5] - 2026-06-18

[v1.3.4...v1.3.5](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.4...v1.3.5)

### Features

- feat(analytics): enhance tool batch flushing logic to improve performance and responsiveness during usage sessions fix(analytics): add flush method to analytics providers to ensure queued events are sent before shutdown docs(analytics): update documentation to reflect changes in tool batch flushing criteria and behavior (`0ce8d42`)

### Chores

- chore(images): update frame_generic_light.png to improve visual quality and consistency (`a5e8eb2`)

### Version bumps

- 1.3.5 (`4a11910`)

## [1.3.4] - 2026-06-17

[v1.3.3...v1.3.4](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.3...v1.3.4)

### Features

- feat(analytics): enhance anonymous usage analytics to collect more detailed runtime environment data including system locale, CPU count, and memory tier feat(analytics): implement MCP session tracking with tool usage summaries and error reporting fix(analytics): ensure proper identification of analytics person with additional properties for better segmentation fix(server): update tool handler registration to include tool name for accurate tracking fix(server): capture connection events and tool call metrics to improve error handling and analytics reporting docs(anonymous-usage-analytics): update documentation to reflect new data collection practices and clarify what is collected and not collected (`ec1dda2`)

### Version bumps

- 1.3.4 (`26e4849`)

## [1.3.3] - 2026-06-17

[v1.3.2...v1.3.3](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.2...v1.3.3)

### Version bumps

- 1.3.3 (`09ed18d`)

## [1.3.2] - 2026-06-17

[v1.3.1...v1.3.2](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.1...v1.3.2)

### Version bumps

- 1.3.2 (`e09cae6`)
- 1.3.1 (`17891a4`)

## [1.3.1] - 2026-06-17

[v1.3.0...v1.3.1](https://github.com/alisaitteke/photoshop-mcp/compare/v1.3.0...v1.3.1)

### Features

- feat(analytics): implement anonymous usage analytics with locale support to enhance user insights docs(README): simplify anonymous usage analytics section and link to detailed documentation docs(anonymous-usage-analytics): create dedicated documentation for anonymous usage analytics details fix(db): update data directory path to use getPhotoshopMcpHomeDir function for better compatibility (`b1b58e8`)

## [1.3.0] - 2026-06-17

[v1.1.3...v1.3.0](https://github.com/alisaitteke/photoshop-mcp/compare/v1.1.3...v1.3.0)

### Features

- feat(analytics): add launch method detection to capture analytics context (`39beb6c`)
- feat(analytics): implement analytics system with PostHog integration for usage tracking and beta telemetry feat(analytics): add API endpoints for managing analytics settings and beta telemetry opt-in feat(analytics): create UI components for user interaction with analytics settings and beta team participation feat(analytics): capture relevant events for analytics during server and UI operations feat(analytics): enable environment-based configuration for analytics settings docs: update README and .env.example to include new analytics configuration options and usage instructions (`097d19f`)
- feat(ui): enhance chat functionality by adding clear all chats feature and improving tool output handling (`8cef6e7`)
- feat(PlanCard.vue): refactor PlanCard component to use ToolCallStrip for better organization and clarity feat(StreamingMessage.vue): integrate ToolCallStrip for standalone tool calls display chore: remove ToolCallCard component as its functionality is replaced by ToolCallStrip feat: add ToolCallDetailDialog and ToolCallOrb components for enhanced tool call interaction feat: implement utility functions for tool name display and icon retrieval in tool-display and tool-icons modules (`6151bfc`)
- feat(README.md): update version description to include Action Plan (beta) feature and its benefits feat(Action Plan): implement Action Plan (beta) feature for streamlined execution of Photoshop commands feat(ui): add AppLoader component for improved loading experience during app initialization refactor(ui): remove Footer component and integrate author information into Sidebar fix(ui): enhance loading state management in SettingsDialog and ChatView components fix(ui): improve message handling in MessageList and StreamingMessage components for better user experience style(ui): add custom scrollbar styles for a cleaner interface chore(api): update API interfaces to include reasoning and activity tracking for chat messages chore(store): enhance chat store to manage streaming messages and reasoning deltas effectively chore(vite): configure proxy response headers to disable buffering and caching for real-time updates (`cd7d799`)
- feat(ChatView.vue): refactor layout to improve message list and composer positioning for better user experience feat(Composer.vue): implement textarea auto-resizing for improved usability style(Composer.vue): enhance styling of the composer component for better visual appeal fix(ModelSelector.vue): adjust button hover styles for better accessibility and user feedback (`a82cd5f`)
- feat(package.json): add packageManager field to specify pnpm version for consistency across environments feat(agent.ts): implement action plan feature to generate and execute a complete ordered plan for Photoshop tool calls feat(action-plan.ts): create action plan execution logic to handle planning and executing tool calls in a single pass feat(shared.ts): define new types for plan step status and plan view to support action plan feature feat(config.ts): add actionPlanBeta configuration option to enable or disable action plan feature feat(server.ts): add API endpoint to toggle action plan feature in the server configuration feat(chats.ts): extend chat message structure to include action plan details for better state management feat(App.vue): integrate action plan toggle in the UI to allow users to enable or disable the feature feat(ChatView.vue): display action plan and tool calls inline for better user experience feat(PlanCard.vue): create a new component to visualize the action plan and its steps feat(MessageList.vue): update message list to conditionally render action plan and tool calls feat(useTextareaAutosize.ts): add composable for auto-resizing text areas to improve user input experience feat(api.ts): implement API call to set action plan feature state in the backend fix(server.ts): ensure assistant messages persist action plan state when saving chat history (`de0c500`)

### Fixes

- fix(windows-executor.ts): remove unnecessary return statement in DoJavaScript call to streamline execution of JSX script (`2e8f719`)

### Refactors

- refactor: simplify error handling by removing error parameter in catch blocks across platform detector and executor files to enhance code readability and maintainability (`4253d62`)

### Chores

- chore(release): bump version to 1.3.0 (`5e1acaf`)
- chore(images): update image assets to improve visual quality and consistency (`8751c8a`)
- chore(eslint): update ESLint configuration to include globals for Node.js and ES2021 refactor(eslint): adjust no-unused-vars rule to improve TypeScript compatibility and ignore specific patterns (`b440fa1`)

### Version bumps

- 1.2.0 (`51f1756`)

## [1.1.3] - 2026-06-11

### Features

- feat(README.md): update tool counts and descriptions to reflect new features and improvements feat(api): add font listing functionality and enhance text layer creation with font support fix(api): resolve font names for text layers to ensure correct font application fix(errors): add 'font_not_found' error code for better error handling test: add tests for font listing and text layer creation with specified fonts (`5530756`)
- feat(CONTRIBUTING.md): add command for targeted regression tests for issue #2 feat(README.md): update recorded test results to reflect issue #2 fixes and new test harness feat(package.json): add new script for targeted regression tests for issue #2 feat(spike-issue-2.ts): create a new script for targeted regression tests for issue #2 fix(test-all-mcp-tools.ts): improve document info assertion to handle errors gracefully feat(layer-tools.ts): add new tool to select layer by name, including nested groups fix(extendscript.ts): improve error handling when accessing document properties fix(photoshop-api.ts): ensure alert suppression works correctly during script execution fix(macos-executor.ts): ensure ExtendScript BOM is prefixed when writing scripts fix(windows-executor.ts): ensure ExtendScript BOM is prefixed when writing scripts chore(_shared.ts): refactor jsString function to use utility from js-string module feat(extendscript-file.ts): add utility to prefix UTF-8 BOM for ExtendScript files feat(js-string.ts): create utility for escaping JavaScript strings (`68322ce`)
- feat(docs): update README and related documentation to reflect the addition of 12 new recipe tools and 4 new atomic tools, bringing the total to 78 tools fix(docs): correct tool coverage count in test script to match updated total of 78 tools (`6502d01`)
- feat(package.json): add new test script for intent expansion features feat(test-intent-expansion): create local integration test for prompt-intent-expansion features to ensure functionality and coverage of new features (`8fe5a68`)
- feat(docs): update README to reflect new MCP prompts and tools, including 16 pre-engineered templates and 12 outcome-oriented recipe tools feat(docs): add user intent glossary and degrade paths for better user guidance feat(docs): enhance instructions for prompt-layer usage and multi-step workflows feat(docs): finalize intent taxonomy and update phase documentation for clarity feat(prompts): introduce new prompts for gradient fade, sky blend, dodge & burn, and remove distraction feat(tools): add new mask tools for gradient application and enhance existing adjustment tools feat(recipes): implement new recipes for gradient fade, sky blend, dodge & burn, and remove distraction to streamline user workflows fix(extendScript): improve error handling and add new helper functions for gradient and mask operations fix(tests): update tests to cover new prompts and recipes, ensuring all functionalities are validated (`1ce32bb`)
- feat(tests): add local and all MCP tools test scripts to improve testing coverage chore(package.json): add new test scripts for local and all MCP tools to facilitate testing process refactor(extendscript): improve layer handling and error management in ExtendScript snippets for better reliability refactor(recipes): streamline recipe functions to utilize shared helper functions for consistency and maintainability (`56f303d`)
- feat(docs): add AI/Prompt Layer documentation to README.md to explain new features and usage feat(docs): create prompt-layer.md to provide detailed reference for AI/prompt layer functionality chore(gitignore): add local maintenance scripts to .gitignore to prevent unnecessary tracking feat(scripts): add verify-photoshop-prompt-coverage script to ensure prompt and recipe parity feat(scripts): create test-mcp-local script for local smoke testing of the photoshop-mcp server feat(core): implement PromptRegistry to manage prompt definitions and handlers feat(core): integrate prompt handling into PhotoshopMCPServer for improved functionality feat(recipes): add various recipe tools for enhanced image processing capabilities feat(recipes): implement frequency separation, enhance portrait, and batch mockup replace recipes feat(recipes): create export social variants and prepare for web recipes for streamlined exports fix(api): improve error handling in getContextInfo function to prevent crashes fix(api): ensure active layer checks are robust to avoid runtime errors fix(api): enhance error classification for better user feedback on failures fix(tools): update tool descriptions to clarify usage and preconditions for better developer experience (`3e871ab`)
- feat(extendscript): implement hue, saturation, and lightness adjustment for active layer using Action Descriptor for better compatibility with Photoshop (`77a35de`)
- feat: add provider and model information to chat messages and UI components (`80050c4`)
- feat(extendscript): enhance fillLayer function to handle locked and text layers and return additional information fix(macos-executor): improve error handling in parseResult method to throw an error for specific error messages (`658cdad`)
- feat: add Google AI Studio provider support to the application (`34eef62`)
- feat(ui): enhance chat functionality with usage tracking and cost calculation (`77f0cc6`)

### Fixes

- fix(extendscript.ts): improve hasSelection logic to handle exceptions when no active selection exists (`73f94ba`)

### Documentation

- docs(README): update features list formatting for improved readability and consistency (`d8688bb`)
- docs: update contributing and development documentation for clarity and organization (`dfb6878`)
- docs: add CONTRIBUTING.md and pull request template for better contribution guidelines and process clarity (`832292c`)
- docs(README.md): update README to reflect version 1.1 features and integration test results for better clarity and user guidance docs(prompt-intent-expansion): add initial documentation for prompt intent expansion project to outline phases and confirmed decisions docs(intent-taxonomy): create intent taxonomy draft to map user phrases to corresponding tools and recipes for improved user interaction (`1ec19f0`)
- docs(README): update screenshot image for standalone UI to reflect new design feat(images): add new screenshot image for standalone UI in light frame (`1aa0e79`)
- docs(README): add screenshot of standalone UI to enhance documentation clarity feat(images): add standalone UI screenshot to provide visual reference for users (`a3833f1`)
- docs(README): update documentation to include standalone UI mode and usage instructions for better user guidance (`34149f5`)

### Chores

- chore(package.json): update build:web script to use install instead of ci for better dependency management (`1bb0075`)
- chore(.gitignore): add local planning docs directory to .gitignore to prevent tracking of unpublished files (`cc18f6c`)
- chore(.gitignore): add *.tgz to ignore list to prevent tarball files from being tracked (`b5e7097`)
- chore: update package versions to 0.1.8 for both main and web packages to reflect new changes chore: update author information in package.json for better attribution chore: add repository, homepage, and bugs fields in package.json for better project visibility chore: clean up .npmignore by removing unnecessary entries and adding defensive filters feat(cli.ts): dynamically retrieve package version from package.json for CLI output feat(server.ts): implement cache control headers for static assets to improve performance and caching behavior (`9dabea6`)
- chore(package.json): update build:web script to use npm ci for better performance and reliability chore(web/.npmignore): add .npmignore file to exclude unnecessary files from the package feat(web/package.json): add @lobehub/icons-static-svg dependency for icon support feat(main.ts): self-host only the Latin subset of Source Sans 3 Variable font to reduce bundle size (`9101fbe`)

### Version bumps

- 1.1.3 (`bcbba5c`)
- 1.1.2 (`0414f29`)
- 1.1.1 (`5cac9c1`)
- 1.1.0 (`6e1c1f0`)
- 1.0.0 (`17d8d91`)

