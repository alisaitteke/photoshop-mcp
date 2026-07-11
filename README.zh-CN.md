# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — AI 驱动的 Photoshop 自动化" width="100%" />
  </a>
</p>

**语言：** [English](README.md) · 简体中文 · [Español](README.es.md)

*v1.1+ — 配方工作流、更少的往返调用、更流畅的会话。独立 UI 附带 **Action Plan（测试版）**，支持先规划后执行的运行模式。*

> **注意：** 这是一个非官方的社区维护项目，与 Adobe Inc. 无任何关联，亦未获其背书。

[![npm version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![GitHub release](https://img.shields.io/github/v/release/alisaitteke/photoshop-mcp?include_prereleases)](https://github.com/alisaitteke/photoshop-mcp/releases)
[![Action Plan](https://img.shields.io/badge/Action%20Plan-beta-amber.svg)](#action-plan-beta)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

一个模型上下文协议（MCP）服务器，使 Claude 和 Cursor 等 AI 助手能够以编程方式控制 Adobe Photoshop。通过这个工具，您可以在 IDE 中使用自然语言命令创建设计、处理图像并自动化 Photoshop 工作流——或者通过捆绑的**独立 Web UI** 进行操作，后者同时支持 API 密钥和 CLI 订阅账户（Claude Code / Gemini CLI）。该 UI 还提供可选的 **Action Plan（测试版）** 模式，可在一次 LLM 调用中规划所有 Photoshop 步骤，然后一次性执行。

## 为何创建此项目

设计师和开发者希望通过 AI 助手驱动 Photoshop，但原始的 ExtendScript 调用十分脆弱：代理会在试错过程中浪费大量 token，图层类型会破坏滤镜，一个失败的命令便会让文档陷入未知状态。

Photoshop MCP 添加了**状态感知**（`get_state`、`get_preview`、`get_capabilities`）、**配方工具**（将多步骤操作包装为单一撤销步骤），以及**结构化错误信封**，让代理知道下一步应该尝试什么。可选的独立 UI 和 Action Plan 模式可减少较长工作流中的往返次数——让自然语言真正能够产出像素，而不仅仅是给出建议。

工程深度解析：[`docs/architecture.md`](docs/architecture.md)。

## 🖥️ 独立 UI（无需 IDE）

不想将其接入 Claude Desktop 或 Cursor？同一个软件包附带了一个完全本地化的 Web UI，让您可以与 AI 模型聊天，并通过底层的 MCP 服务器驱动 Photoshop。使用提供商 API 密钥进行连接，**或者**对于 Anthropic 和 Google，复用 **Claude Code** 或 **Gemini CLI** 的 OAuth 会话——无需单独的 API 密钥。

![独立 UI 截图](./images/frame_generic_light.png)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

就这样。本地服务器在 `127.0.0.1`（随机空闲端口）上启动，您的默认浏览器会自动打开聊天 UI。

### 支持的提供商

首次启动时选择以下任意一个——使用 API 密钥**或**您现有的 CLI 订阅账户（Anthropic 和 Google）：

| 提供商 | 模型 | API 密钥 | CLI 账户 |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100+ 来自任意提供商的模型 | [openrouter.ai](https://openrouter.ai/keys) | — |

### 认证模式

- **`api_key`（默认）** — 使用 Vercel AI SDK 和您的提供商 API 密钥。按 API 费率按 token 计费；UI 显示每次聊天的预估费用。
- **`cli_account`** — 使用您本地的 Claude Code 或 Gemini CLI OAuth 会话。不存储 API 密钥；UI 通过无头模式的 `claude auth status` / `gemini` 探测验证登录状态。使用量计入您的**订阅配额**，而非 API 账单——状态栏显示"订阅已包含"。

您可以在"设置"中按提供商切换认证方式，不会丢失另一种凭据（例如，保留 API 密钥的同时尝试 CLI 账户，之后再切换回来）。

### Action Plan（测试版）

独立 Web UI 中的可选执行模式，**仅适用于 API 密钥认证**（`cli_account` 始终使用默认的代理流程）。在作曲器中的模型选择器旁边，通过 **Action Plan** 开关开启。

与逐步 ReAct 循环（模型 → 工具 → 模型 → 工具……）不同，Action Plan：

1. 发起**一次** LLM 规划调用，输出包含参数的 Photoshop MCP 工具调用有序待办清单。
2. **直接**按顺序执行这些工具——步骤之间无额外的模型往返。
3. 若某步骤失败或存在未解决的依赖项，运行有界**修复**循环（仅重新规划剩余步骤，最多 3 次）。

计划以实时待办清单的形式显示在工具调用卡片上方，附带每步状态（`pending` → `running` → `done` / `error`）。计划会持久化到聊天历史中，重载后不会丢失。开关默认关闭；禁用 Action Plan 时，现有的代理流程不受影响。

适合多步骤提示词，例如*"移除背景并导出为网络格式"*——可减少模型调用次数，加快端到端执行速度。

### 首次启动时的流程

1. 选择提供商，选择 **API 密钥**或**使用您的账户**。
2. 验证密钥或检查 CLI 连接。配置以 `~/.photoshop-mcp/data.db`（SQLite，`chmod 600`）的形式存储在本地。API 密钥永远不会离开您的设备；CLI 模式继承来自 `~/.claude/` 或 `~/.gemini/` 的 OAuth 凭据。
3. 输入自然语言提示词。UI 实时流式传输模型回复，实时执行 Photoshop 工具调用，并将每次工具调用渲染为可检查的卡片（输入 + 结果）。
4. 随时从设置/模型选择器切换提供商、认证方式或模型——聊天记录、费用和工具历史会跨会话持久化。

### 后续切换认证方式

随时从侧边栏打开**设置**：

| 操作 | API 密钥模式 | CLI 账户模式 |
|---|---|---|
| 设置 | 粘贴密钥 → **保存** | 安装 CLI → `auth login` → **检查连接** |
| 切换 | 选择 **API 密钥** — 已存储的密钥保留 | 选择**使用您的账户** — 密钥不会被删除 |
| 自定义二进制路径 | — | 若 `claude` / `gemini` 不在 `PATH` 上，可填写可选的 **CLI 路径** |
| 费用显示 | 状态栏中的按 token 预估 | **订阅已包含**徽章 |

认证方式以每提供商为单位存储在 `~/.photoshop-mcp/data.db` 中（`authMethod`：`api_key` 或 `cli_account`）。不含 `authMethod` 的现有配置默认为 `api_key`，保持正常工作。

### CLI 参数

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

### 注意事项

- 代理仅限于使用 Photoshop MCP 工具——内置的 shell、文件和网络工具已禁用。
- 技术栈：前端使用 Vue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/)；后端使用 [Hono](https://hono.dev/)。API 密钥模式使用 [Vercel AI SDK](https://sdk.vercel.ai/)；CLI 账户模式使用 [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp)（Anthropic）或 Gemini CLI 无头 `stream-json`（Google）。所有路径均通过 STDIO 与同一个 Photoshop MCP 服务器通信。
- **CLI 账户限制：** Gemini 无头模式每次对话可能开启新会话（历史记录会预置到提示词中）。Anthropic CLI 账户消耗订阅配额。OAuth 登录以 macOS 优先（在终端中运行 `claude auth login` / `gemini auth login`）。

---

## Photoshop 的 AI/提示词层

在原子化 `photoshop_*` 工具之上，服务器附带了一个有主见的 AI/提示词层，帮助宿主 LLM（Cursor、Claude Desktop 等）将模糊的用户请求转化为可靠的 Photoshop 操作：

- **服务器 `instructions`** — 在 MCP `initialize` 时广播的工作流契约（ping 一次、操作前获取状态、优先使用配方、错误恢复）。参见 [`src/prompts/instructions.ts`](src/prompts/instructions.ts)。
- **MCP `prompts` 原语** — 19 个预先设计的模板（12 个配方 + 7 个指南：`ps.enhance_portrait`、`ps.remove_background`、`ps.generative_fill`……），通过 `prompts/list` 和 `prompts/get` 获取。
- **配方工具** — 12 个面向结果的 `photoshop_recipe_*` 工具（移除背景、增强人像、准备网络发布、导出社交媒体变体、色彩分级、频率分离、批量贴图替换、整理图层、渐变淡出、天空混合、减淡与加深、移除干扰物）。每个工具将步骤包装在单一 Photoshop 历史状态中（一次撤销可还原全部）。**共 86 个工具**（74 个原子工具 + 12 个配方工具）。
- **生成式 AI** — `photoshop_generative_fill`、`photoshop_generative_remove`、`photoshop_generative_expand`、`photoshop_generative_upscale`、`photoshop_sky_replacement`、`photoshop_generate_image`（通过 ExtendScript 调用 Firefly；需要 Adobe 账户和点数）。
- **Neural Filters** — 通过可选的 UXP 桥接插件（`uxp-plugin/`）使用 `photoshop_neural_filter`。
- **状态与预览** — `photoshop_get_state`（轻量快照）、`photoshop_get_preview`（用于视觉验证的 base64 JPEG）、`photoshop_get_capabilities`（版本感知功能标志）。
- **结构化错误** — 失败时返回包含 `code` 和 `suggested_next_tool` 的 JSON 信封，用于自我纠错。

完整参考：[`docs/prompt-layer.md`](docs/prompt-layer.md)。

验证一致性：`npm run verify:photoshop-prompts`。最新结果：[`docs/development.md#integration-test-results`](docs/development.md#integration-test-results)。

## 示例提示词

以下是您在配置此 MCP 服务器后可与 AI 助手（Claude、Cursor 等）一起使用的示例提示词。对于多步骤结果，优先使用**配方工具**（`photoshop_recipe_*`）——每个配方是单一撤销步骤。仅对配方未覆盖的精细编辑使用原子 `photoshop_*` 工具。

<details>
<summary>🧠 状态感知会话（推荐的第一步）</summary>

```
Ping Photoshop and read capabilities for my installed version.
Get the current document state before changing anything.
Open portrait.jpg, get a downscaled preview so you can verify the subject.
After each major recipe, get another preview to confirm the result.
```

</details>

<details>
<summary>👤 人像修饰（配方）</summary>

```
Enhance the portrait on the active layer at medium intensity with skin smoothing.
Use the enhance-portrait recipe — I want frequency separation + auto-tone in one undoable step.
If the active layer is text or a Smart Object, rasterize first or pick a raster layer.
Show me a preview when done.
```

等效 MCP 提示词模板：`ps.enhance_portrait`，参数为 `{ intensity: "medium", skin_smoothing: "true" }`。

</details>

<details>
<summary>✂️ 背景移除（配方）</summary>

```
Remove the background from the active portrait layer.
Use Select Subject + a layer mask with a 2px feather. Keep the original pixels behind the mask.
The subject must be on the active layer — not a flat color fill.
```

等效 MCP 提示词模板：`ps.remove_background`，参数为 `{ feather_px: "2", keep_shadow: "false" }`。

</details>

<details>
<summary>🎨 色彩分级（配方）</summary>

```
Apply a warm film color grade to the open document as non-destructive adjustment layers.
Use the apply-color-grade recipe with preset warm_film.
Preview the result when finished.
```

</details>

<details>
<summary>🔬 频率分离设置（配方）</summary>

```
Set up frequency separation on the active raster layer with a 6px blur radius.
I will paint on the Low and High layers myself — do not apply extra smoothing.
Tell me which layers to edit when the stack is ready.
```

等效 MCP 提示词模板：`ps.frequency_separation`，参数为 `{ radius_px: "6" }`。

</details>

<details>
<summary>🌐 网络准备 + 社交媒体导出（配方）</summary>

```
Prepare the active document for web: sRGB, downscale, sharpen, export one optimized JPEG to ~/.photoshop-mcp/exports.
Then export Instagram post and X post variants as separate JPEGs from the same document.
List the output paths in a table.
```

等效模板：`ps.prepare_for_web`、`ps.export_social_variants`。

</details>

<details>
<summary>📦 批量贴图替换（配方）</summary>

```
I have a mockup PSD open with a Smart Object layer named "Screen".
Replace it with every PNG/JPG in ~/assets/mockups/ and export one JPEG per asset.
Do not place flat layers — swap the Smart Object so perspective is preserved.
```

等效 MCP 提示词模板：`ps.batch_mockup_replace`。

</details>

<details>
<summary>🗂️ 整理图层（配方）</summary>

```
Organize the layer stack: rename by kind, auto-group related layers, preserve originals.
Run the organize-layers recipe, then list layers so I can review the new structure.
```

</details>

<details>
<summary>🎨 基础设计创建</summary>

```
Create a 1920x1080 Photoshop document with RGB color mode.
Add a light blue background layer and fill it with RGB(240, 248, 255).
Add centered text "Welcome" in 64pt font.
Save as welcome.psd to my Desktop.
```

</details>

<details>
<summary>🖼️ 素材图片设计（配合 Pexels MCP）</summary>

```
Search Pexels for "mountain sunset" images.
Create a 1920x1080 Photoshop document.
Place the downloaded image and fit it to fill the entire canvas.
Apply a subtle Gaussian blur of 3px.
Increase brightness by 15 and contrast by 10.
Add white text "Adventure Awaits" centered at the top in 72pt.
Set the text opacity to 90% and blend mode to OVERLAY.
Save as adventure.jpg with quality 10.
```

</details>

<details>
<summary>✨ 照片增强</summary>

```
Open photo.jpg from my Desktop in Photoshop.
Get state, then run the enhance-portrait recipe at low intensity.
If I only need quick tone fixes, apply auto levels, auto contrast, and unsharp mask (120%, 1.5, 0) on the active layer instead.
Adjust hue +15 and saturation +15, or use prepare-for-web when I'm ready to export.
Save as enhanced-photo.jpg with quality 12.
```

</details>

<details>
<summary>🎭 图层效果与混合</summary>

```
Create a 1200x800 document.
Add a new layer named "Background" and fill with RGB(50, 50, 50).
Place logo.png at position (100, 100).
Fit the logo layer to 50% of its current size.
Set blend mode to SCREEN and opacity to 85%.
Add another layer, fill with RGB(255, 100, 50).
Set this layer's blend mode to MULTIPLY and opacity to 60%.
Merge all visible layers.
Save as composite.psd.
```

</details>

<details>
<summary>📝 文字海报设计</summary>

```
Create a 1080x1350 portrait document (Instagram story size).
Add a layer and fill with gradient-like color RGB(120, 40, 200).
Add text "SUMMER" at (540, 300) in 96pt.
Change text color to white RGB(255, 255, 255).
Set text alignment to CENTER.
Add another text "2026" at (540, 450) in 128pt, white color.
Apply Gaussian blur 2px to the background layer.
Save as summer-poster.png.
```

</details>

<details>
<summary>🎬 批处理</summary>

```
Open image1.jpg.
Resize to 1920x1080.
Apply auto contrast.
Apply subtle sharpen (amount 80%, radius 1.0).
Save as processed-1.jpg with quality 10.
Close without saving changes to original.

Repeat for image2.jpg and image3.jpg.
```

</details>

<details>
<summary>🖌️ 创意操控</summary>

```
Create a 2000x2000 square document.
Place abstract-pattern.jpg and fit to fill document.
Duplicate the layer.
On the duplicate, apply motion blur at 45 degrees, radius 50px.
Set blend mode to OVERLAY and opacity to 70%.
Add centered text "MOTION" in 120pt white.
Apply a rectangular selection from (200, 200) to (1800, 1800).
Invert the selection and delete (to create a border effect).
Flatten the image.
Save as motion-art.jpg.
```

</details>

<details>
<summary>🎯 高级工作流</summary>

```
Create a 3000x2000 document at 300 DPI for print.
Place hero-image.jpg and fit to fill the canvas.
Duplicate the image layer.
On the duplicate, desaturate it completely.
Set blend mode to LUMINOSITY and opacity to 50%.
Create a new layer named "Overlay".
Fill with RGB(255, 150, 0) and set blend mode to SOFTLIGHT at 30% opacity.
Add text "PORTFOLIO" at top center (1500, 200) in 96pt.
Set text color to white.
Add subtext "2026 Collection" at (1500, 320) in 36pt.
Create a rectangular selection around the text area.
Create a layer mask on the overlay layer.
Merge visible layers.
Save as portfolio-cover.psd.
Export as portfolio-cover.jpg at quality 12.
```

</details>

<details>
<summary>🔄 使用动作</summary>

```
Open my-photo.jpg.
Play the "Vintage Look" action from "My Actions" set.
Adjust brightness by -10 to darken slightly.
Save as vintage-photo.jpg.
```

</details>

<details>
<summary>⚡ 自定义脚本执行</summary>

```
Execute this custom ExtendScript code:
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ 撤销/重做操作</summary>

```
Apply Gaussian blur 15px to the active layer.
[Wait for result]
Actually, that's too much blur. Undo that.
Apply Gaussian blur 5px instead.
```

或：

```
Get the history states to see what operations were performed.
Undo the last 3 operations.
Redo 1 step to bring back one operation.
```

</details>

<details>
<summary>🔁 错误恢复（结构化信封）</summary>

```
If a recipe returns version_unsupported or generative_unavailable, call get_capabilities and tell me which Photoshop feature is missing.
If a tool fails with suggested_next_tool, follow that hint (e.g. rasterize_layer before a raster-only recipe).
Never guess — read get_state after a failure and propose the next single step.
```

</details>

## 功能特性

- **独立 Web UI** — 本地聊天界面（`photoshop-mcp-ui`）；每个提供商支持 API 密钥或 CLI 订阅认证（Anthropic、Google）
- **Action Plan（测试版）** — Web UI 中可选的先规划后执行模式（仅 API 密钥）：一次规划调用、直接工具执行、失败时有界修复
- **同时支持 Windows 和 macOS**
- **支持 Photoshop 2012-2025+**
- **ExtendScript API**：通过 AppleScript/COM 自动化实现通用兼容性
- **自动检测**：自动在系统上找到 Photoshop 安装路径
- **78 个工具**：66 个原子 `photoshop_*` + 12 个配方 `photoshop_recipe_*`
- **AI/提示词层**：16 个 MCP 提示词模板（12 个配方 + 4 个指南）、服务器指令、状态/预览/能力工具
- **文档管理**：创建、打开、保存、关闭、裁剪文档
- **图层操作**：创建、删除、复制、合并、变换图层
- **图层属性**：不透明度、混合模式、可见性、锁定
- **文字格式化**：字体、大小、颜色、对齐控制
- **图片放置**：放置图片、打开文件、适应文档
- **滤镜**：高斯模糊、锐化、噪点、动态模糊
- **色彩调整**：亮度/对比度、色相/饱和度、曲线、自动色阶/对比度
- **选区与蒙版**：矩形选区、选择主体、内容感知填充、渐变蒙版、图层蒙版
- **历史控制**：撤销/重做操作、查看历史状态
- **动作**：播放录制的动作、执行自定义脚本
- **自动栅格化**：在需要时自动转换图层以用于滤镜
- **上下文追踪**：每次操作后返回文档/图层状态，以便 AI 保持上下文感知

## 安装

### 使用 NPX（推荐）

无需安装！只需配置您的 MCP 客户端：

```bash
npx @alisaitteke/photoshop-mcp
```

如需在本地对仓库进行开发，请参阅开发指南中的[从源码安装](docs/development.md#from-source)。

## 配置

### 适用于 Cursor

在您的 Cursor 设置（`.cursor/config.json` 或工作区设置）中添加：

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": {
        "LOG_LEVEL": "1"
      }
    }
  }
}
```

### 适用于 Claude Desktop

在您的 Claude Desktop 配置（macOS 上为 `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows 上为 `%APPDATA%\Claude\claude_desktop_config.json`）中添加：

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": {
        "LOG_LEVEL": "1"
      }
    }
  }
}
```

### 环境变量

- `PHOTOSHOP_PATH`：（可选）指定自定义 Photoshop 安装路径
- `LOG_LEVEL`：日志级别（0=DEBUG，1=INFO，2=WARN，3=ERROR）
- `ANALYTICS_DISABLED`：设置为 `1` 或 `true` 可完全禁用匿名使用分析
- `POSTHOG_DISABLED`：`ANALYTICS_DISABLED` 的旧版别名
- `ANALYTICS_PROVIDER`：分析后端 — `mixpanel`（默认）或 `posthog`（回滚）
- `MIXPANEL_TOKEN`：（可选）覆盖 Mixpanel 项目令牌
- `MIXPANEL_API_HOST`：（可选）Mixpanel 数据采集主机（默认：`https://api-eu.mixpanel.com`）
- `POSTHOG_KEY`：（可选，旧版）PostHog 项目密钥 — 仅在 `ANALYTICS_PROVIDER=posthog` 时使用
- `POSTHOG_API_HOST`：（可选，旧版）PostHog 数据采集主机（默认：`https://a.alisait.com`）
- `POSTHOG_UI_HOST`：（可选，旧版）PostHog UI 主机（默认：`https://eu.posthog.com`）

## 可用工具

所有原子 `photoshop_*` 工具的完整参考（参数、示例和用法）：[`docs/available-tools.md`](docs/available-tools.md)。


## 上下文追踪

每个工具都会返回关于 Photoshop 当前状态的全面上下文信息，包括：

- **文档信息**：名称、尺寸、分辨率、色彩模式、图层数量
- **活动图层信息**：名称、类型、不透明度、混合模式、可见性、锁定状态
- **选区状态**：是否有活动选区
- **操作结果**：关于所做更改的具体详情

这使 AI 助手能够保持对以下内容的感知：
- 当前活动文档
- 正在处理的图层
- 当前图层属性（不透明度、混合模式等）
- 文档尺寸与设置

**响应示例：**
```javascript
{
  "applied": true,
  "filter": "Gaussian Blur",
  "radius": 10,
  "wasRasterized": true,
  "context": {
    "hasDocument": true,
    "document": {
      "name": "design.psd",
      "width": 1920,
      "height": 1080,
      "resolution": 72,
      "colorMode": "RGBColorMode",
      "layerCount": 3,
      "hasSelection": false
    },
    "activeLayer": {
      "name": "Background",
      "kind": "NORMAL",
      "opacity": 100,
      "blendMode": "NORMAL",
      "visible": true,
      "locked": false,
      "isBackground": false
    }
  }
}
```

此上下文帮助 AI 助手在多条命令中记住正在处理的文档和图层。

---

## 平台特定说明

### Windows

- 使用 COM 自动化与 Photoshop 通信
- 基于注册表的安装路径自动检测
- 支持 32 位和 64 位版本

### macOS

- 使用 AppleScript/OSA 与 Photoshop 通信
- 基于 Spotlight 的自动检测
- 支持同时安装多个 Photoshop 版本
- **CLI 账户认证**（独立 UI）以 macOS 优先：在终端中运行 `claude auth login` / `gemini auth login`；凭据存储在 `~/.claude/` 和 `~/.gemini/` 下

## 支持的 Photoshop 版本

- **所有 Photoshop 版本**（2012-2025+）：通过 AppleScript（macOS）或 COM（Windows）使用 ExtendScript API

**重要说明**：虽然 Photoshop 2022+ 支持用于插件的 UXP，但通过 AppleScript/COM 的外部自动化只能使用 ExtendScript。UXP 专为内部插件设计，无法从外部脚本调用。因此，此 MCP 服务器使用 ExtendScript 以实现跨所有 Photoshop 版本的最大兼容性。

## 故障排除

常见的连接、脚本和日志问题：[`docs/troubleshooting.md`](docs/troubleshooting.md)。

### 独立 UI — CLI 账户认证

| 症状 | 可能原因 | 修复方法 |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLI 未安装 | `npm i -g @anthropic-ai/claude-code` 或 `npm i -g @google/gemini-cli` |
| `not_authenticated` | 无 OAuth 会话 | 在终端中运行 `claude auth login` 或 `gemini auth login` |
| `claude` / `gemini` 不在 `PATH` 上 | 自定义安装位置 | 设置 → **CLI 路径** → **检查连接** |
| 在 IDE 中聊天正常但 UI 中无法使用（CLI 模式） | OAuth 令牌仅限 CLI | 在 UI 中使用 **CLI 账户**；API 密钥和 CLI 会话是分开的 |
| Gemini 多轮对话感觉健忘 | 无头 CLI 每次对话可能开启新会话 | 已知限制；历史记录会预置到提示词中（MVP） |

## 开发

从源码设置、构建、lint、集成测试（含最新结果）和使用示例：[`docs/development.md`](docs/development.md)。

## 架构

系统设计、数据流、平台抽象和 UI 代理模式：[`docs/architecture.md`](docs/architecture.md)。

在 LinkedIn 或社交媒体上分享？使用 [`images/og-social.png`](images/og-social.png) 和 [`docs/social-preview.md`](docs/social-preview.md) 进行 OG 设置和帖子文案。

## 贡献

欢迎贡献！开 PR 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 关于维护者

**[Ali Sait Teke](https://alisait.com)** — 全栈工程师及 AI 时代软件架构师（Python、Go、Node.js、React、Next.js、Vue）。

这个项目起源于一个实际问题：*如何在不依赖脆弱的一次性脚本的情况下，让 Photoshop 被 LLM 可靠地控制？* 它逐渐演变为一个拥有 80 个工具的 MCP 服务器、用于可靠多步骤工作流的配方/提示词层，以及一个无需 IDE 即可进行创意工作的本地 Web UI。

**此代码库展示了：** TypeScript 系统设计、MCP 协议集成、跨平台桌面自动化（macOS AppleScript / Windows COM）、代理循环的结构化错误恢复，以及一个以生产为导向的本地优先 UI（Vue 3 + Hono + SQLite）。

- [个人网站](https://alisait.com) · [GitHub](https://github.com/alisaitteke) · [LinkedIn](https://www.linkedin.com/in/alisait/)

## 许可证

MIT

## 匿名使用分析

默认情况下会收集匿名的聚合使用事件，以改进产品。您可以随时选择退出。完整详情：[`docs/anonymous-usage-analytics.md`](docs/anonymous-usage-analytics.md)。

## 致谢

- 基于 [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) 构建
- 受 Adobe Photoshop 脚本社区的启发
