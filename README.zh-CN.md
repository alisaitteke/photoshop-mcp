# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — AI 驱动的 Photoshop 自动化" width="100%" />
  </a>
</p>

**语言：** [English](README.md) · 简体中文 · [Español](README.es.md) · [Deutsch](README.de.md) · [日本語](README.ja.md) · [Türkçe](README.tr.md)

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

独立 Web UI 中的可选执行模式，**仅适用于 API 密钥认证**（`cli_account` 始终使用默认的代理流程）。在 composer 中的模型选择器旁边，通过 **Action Plan** 开关开启。

与逐步 ReAct 循环（模型 → 工具 → 模型 → 工具……）不同，Action Plan：

1. 发起**一次** LLM 规划调用，输出包含参数的 Photoshop MCP 工具调用有序待办清单。
2. **直接**按顺序执行这些工具——步骤之间无额外的模型往返。
3. 若某步骤失败或存在未解决的依赖项，运行有界**修复**循环（仅重新规划剩余步骤，最多 3 次）。

计划以实时待办清单的形式显示在工具调用卡片上方，附带每步状态（`pending` → `running` → `done` / `error`）。计划会持久化到聊天历史中，重载后不会丢失。开关默认关闭；禁用 Action Plan 时，现有的代理流程不受影响。

适合多步骤提示词，例如*"移除背景并导出为 Web 格式"*——可减少模型调用次数，加快端到端执行速度。

### 首次启动时的流程

1. 选择提供商，选择 **API 密钥**或 **Uses your account**。
2. 验证密钥或检查 CLI 连接。配置以 `~/.photoshop-mcp/data.db`（SQLite，`chmod 600`）的形式存储在本地。API 密钥永远不会离开您的设备；CLI 模式继承来自 `~/.claude/` 或 `~/.gemini/` 的 OAuth 凭据。
3. 输入自然语言提示词。UI 实时流式传输模型回复，实时执行 Photoshop 工具调用，并将每次工具调用渲染为可检查的卡片（输入 + 结果）。
4. 随时从设置/模型选择器切换提供商、认证方式或模型——聊天记录、费用和工具历史会跨会话持久化。

### 后续切换认证方式

随时从侧边栏打开**设置**：

| 操作 | API 密钥模式 | CLI 账户模式 |
|---|---|---|
| 设置 | 粘贴密钥 → **保存** | 安装 CLI → `auth login` → **检查连接** |
| 切换 | 选择 **API 密钥** — 已存储的密钥保留 | 选择 **Uses your account** — 密钥不会被删除 |
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
- **配方工具** — 12 个面向结果的 `photoshop_recipe_*` 工具（移除背景、增强人像、准备网络发布、导出社交媒体变体、色彩分级、频率分离、批量样机替换、整理图层、渐变淡出、天空混合、减淡与加深、移除干扰物）。每个工具将步骤包装在单一 Photoshop 历史状态中（一次撤销可还原全部）。**共 86 个工具**（74 个原子工具 + 12 个配方工具）。
- **生成式 AI** — `photoshop_generative_fill`、`photoshop_generative_remove`、`photoshop_generative_expand`、`photoshop_generative_upscale`、`photoshop_sky_replacement`、`photoshop_generate_image`（通过 ExtendScript 调用 Firefly；需要 Adobe 账户和积分）。
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
连接 Photoshop 并读取我当前安装版本的功能信息。
在做任何更改之前，先获取当前文档状态。
打开 portrait.jpg，获取缩小的预览图，以便确认主体对象。
每执行完一个主要配方后，再次获取预览图以确认效果。
```

</details>

<details>
<summary>👤 人像修饰（配方）</summary>

```
以中等强度对活动图层上的人像进行增强，并开启皮肤磨皮。
使用 enhance-portrait recipe——我希望在一个可撤销的步骤内同时完成频率分离和自动色调调整。
如果活动图层是文字或 Smart Object，请先栅格化，或选择一个栅格图层。
完成后给我看一下预览效果。
```

等效 MCP 提示词模板：`ps.enhance_portrait`，参数为 `{ intensity: "medium", skin_smoothing: "true" }`。

</details>

<details>
<summary>✂️ 背景移除（配方）</summary>

```
移除活动人像图层的背景，用于电商白底图交付。
使用 Select Subject 配合 2px 羽化的图层蒙版，保留蒙版后面的原始像素。
如果 brief 要求纯白底，填充 RGB(255,255,255)，商品居中并占画面至少 70%。
主体必须在活动图层上——不能是纯色填充图层。
```

等效 MCP 提示词模板：`ps.remove_background`，参数为 `{ feather_px: "2", keep_shadow: "false" }`。

</details>

<details>
<summary>🎨 色彩分级（配方）</summary>

```
以非破坏性调整图层的方式，对打开的文档应用暖色电影色调分级。
使用 apply-color-grade recipe，预设选择 warm_film。
完成后预览效果。
```

</details>

<details>
<summary>🔬 频率分离设置（配方）</summary>

```
在活动栅格图层上设置频率分离，模糊半径为 6px。
我会自己在低频层和高频层上绘制——不要额外添加磨皮处理。
图层堆栈准备好后，告诉我应该编辑哪些图层。
```

等效 MCP 提示词模板：`ps.frequency_separation`，参数为 `{ radius_px: "6" }`。

</details>

<details>
<summary>🌐 网络准备 + 社交媒体导出（配方）</summary>

```
将活动文档准备好用于网络发布：转换为 sRGB，缩小尺寸，锐化，并将一张优化后的 JPEG 导出到 ~/.photoshop-mcp/exports。
然后从同一文档导出淘宝主图 800×800、小红书封面 1080×1440、抖音竖图 1080×1920 和公众号头图 900×383。
将输出路径以表格形式列出。
```

等效模板：`ps.prepare_for_web`、`ps.export_social_variants`。

</details>

<details>
<summary>📦 批量样机替换（配方）</summary>

```
我有一个样机 PSD 文件已打开，其中有一个名为"Screen"的 Smart Object 图层。
将其替换为 ~/assets/mockups/ 中的每个 PNG/JPG 文件，并为每个素材导出一张 JPEG。
不要放置普通图层——替换 Smart Object 以保留透视效果。
```

等效 MCP 提示词模板：`ps.batch_mockup_replace`。

</details>

<details>
<summary>🗂️ 整理图层（配方）</summary>

```
整理图层堆栈：按类型重命名，自动将相关图层分组，保留原始内容。
执行 organize-layers recipe，然后列出图层，以便我查看新的结构。
```

</details>

<details>
<summary>🎨 基础设计创建</summary>

```
创建一个 1920x1080 的 Photoshop 文档，使用 RGB 颜色模式。
添加一个浅蓝色背景图层，填充 RGB(240, 248, 255)。
添加居中文字"Welcome"，字号 64pt。
保存为 welcome.psd 到桌面。
```

</details>

<details>
<summary>🖼️ 素材图片设计（配合 Pexels MCP）</summary>

```
在 Pexels 上搜索"mountain sunset"图片。
创建一个 1920x1080 的 Photoshop 文档。
将下载的图片放置进来，并适配填满整个画布。
应用 3px 的轻微高斯模糊。
增加亮度 15，对比度 10。
在顶部居中添加白色文字"Adventure Awaits"，字号 72pt。
将文字不透明度设为 90%，混合模式设为 OVERLAY。
保存为 adventure.jpg，质量 10。
```

</details>

<details>
<summary>✨ 照片增强</summary>

```
在 Photoshop 中打开桌面上的 photo.jpg。
获取状态，然后以低强度运行 enhance-portrait recipe。
如果只需要快速调整色调，改为对活动图层应用自动色阶、自动对比度和 USM 锐化（120%, 1.5, 0）。
调整色相 +15、饱和度 +15，或在准备好导出时使用 prepare-for-web。
保存为 enhanced-photo.jpg，质量 12。
```

</details>

<details>
<summary>🎭 图层效果与混合</summary>

```
创建一个 1200x800 的文档。
添加一个名为"Background"的新图层，填充 RGB(50, 50, 50)。
将 logo.png 放置在 (100, 100) 位置。
将 logo 图层缩放至当前尺寸的 50%。
将混合模式设为 SCREEN，不透明度设为 85%。
再添加一个图层，填充 RGB(255, 100, 50)。
将该图层的混合模式设为 MULTIPLY，不透明度设为 60%。
合并所有可见图层。
保存为 composite.psd。
```

</details>

<details>
<summary>📝 文字海报设计</summary>

```
创建一个 1080x1350 的竖版文档（Instagram 故事尺寸）。
添加一个图层，填充渐变感颜色 RGB(120, 40, 200)。
在 (540, 300) 处添加文字"SUMMER"，字号 96pt。
将文字颜色更改为白色 RGB(255, 255, 255)。
将文字对齐方式设为 CENTER。
在 (540, 450) 处再添加文字"2026"，字号 128pt，白色。
对背景图层应用 2px 高斯模糊。
保存为 summer-poster.png。
```

</details>

<details>
<summary>🎬 批处理</summary>

```
打开 image1.jpg。
调整尺寸为 1920x1080。
应用自动对比度。
应用轻微锐化（强度 80%，半径 1.0）。
保存为 processed-1.jpg，质量 10。
关闭文件，不保存对原文件的修改。

对 image2.jpg 和 image3.jpg 重复以上步骤。
```

</details>

<details>
<summary>🖌️ 创意操控</summary>

```
创建一个 2000x2000 的正方形文档。
放入 abstract-pattern.jpg 并适配填满文档。
复制该图层。
在副本图层上，应用 45 度方向、半径 50px 的动态模糊。
将混合模式设为 OVERLAY，不透明度设为 70%。
居中添加白色文字"MOTION"，字号 120pt。
创建从 (200, 200) 到 (1800, 1800) 的矩形选区。
反选并删除（制造边框效果）。
拼合图像。
保存为 motion-art.jpg。
```

</details>

<details>
<summary>🎯 高级工作流</summary>

```
创建一个用于印刷的 3000x2000、300 DPI 文档。
放入 hero-image.jpg 并适配填满画布。
复制图像图层。
在副本图层上，将其完全去饱和。
将混合模式设为 LUMINOSITY，不透明度设为 50%。
创建一个名为"Overlay"的新图层。
填充 RGB(255, 150, 0)，将混合模式设为 SOFTLIGHT，不透明度 30%。
在顶部居中 (1500, 200) 处添加文字"PORTFOLIO"，字号 96pt。
将文字颜色设为白色。
在 (1500, 320) 处添加副标题"2026 Collection"，字号 36pt。
在文字区域周围创建矩形选区。
在叠加图层上创建图层蒙版。
合并可见图层。
保存为 portfolio-cover.psd。
导出为 portfolio-cover.jpg，质量 12。
```

</details>

<details>
<summary>🔄 使用动作</summary>

```
打开 my-photo.jpg。
播放"My Actions"动作组中的"Vintage Look"动作。
将亮度调低 -10，使其略微变暗。
保存为 vintage-photo.jpg。
```

</details>

<details>
<summary>⚡ 自定义脚本执行</summary>

```
执行以下自定义 ExtendScript 代码：
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ 撤销/重做操作</summary>

```
对活动图层应用 15px 的高斯模糊。
[等待结果]
这个模糊效果太强了，撤销这步操作。
改为应用 5px 的高斯模糊。
```

或：

```
获取历史状态，查看已执行了哪些操作。
撤销最后 3 步操作。
重做 1 步，恢复其中一个操作。
```

</details>

<details>
<summary>🔁 错误恢复（结构化信封）</summary>

```
如果某个配方返回 version_unsupported 或 generative_unavailable，调用 get_capabilities 并告诉我缺少哪个 Photoshop 功能。
如果某个工具失败并返回 suggested_next_tool，按照提示操作（例如，在执行仅限栅格的配方之前先执行 rasterize_layer）。
不要猜测——在失败后读取 get_state，然后提出下一个单一操作步骤。
```

</details>

<details>
<summary>🛒 中国电商白底主图工作流（淘宝/天猫）</summary>

```
打开这张商品原图，先获取当前文档状态。
用 Select Subject 抠出主体，边缘羽化 1.5px，输出为带蒙版的新图层。
新建 800×800 画布，背景填充纯白色 RGB(255,255,255)，商品居中并占画面至少 70%。
检查边缘白边和杂色，必要时用蒙版画笔修复。
导出 JPG 质量 90 到 ~/.photoshop-mcp/exports/白底图/，不要添加文字、水印或阴影。
完成后给我预览确认效果。
```

等效 MCP 提示词模板：`ps.remove_background`，参数为 `{ feather_px: "2", keep_shadow: "false" }`。

</details>

<details>
<summary>📱 小红书种草封面批量制作</summary>

```
我有一套 5 张产品实拍图，要做成小红书笔记封面。
画布尺寸 1242×1656px（3:4），顶部 15% 留空作为安全区。
主标题用自然口语化文案（9–13 个字），放在画面中上部；整体色调清新、有生活感，避免过度商业化。
每张封面替换不同标题，产品构图保持一致。
导出 JPG 到 ~/.photoshop-mcp/exports/xiaohongshu/，单张不超过 5MB。
```

</details>

<details>
<summary>🎉 双11 / 618 大促主视觉海报</summary>

```
制作一张双11大促主视觉 KV，尺寸 1920×800px。
主标题「双11狂欢节」用立体发光字效果，配色深红到正红，点缀金色光晕。
右侧放三款主推产品透明 PNG，左下角加「全场5折起」促销信息。
再导出 1080×1920（抖音竖屏）和 1080×1440（小红书）两个衍生版本，关键信息不要被裁切。
所有文件保存到 ~/.photoshop-mcp/exports/1111/ 并列表输出路径。
```

</details>

<details>
<summary>🎥 抖音直播电商素材包</summary>

```
为美妆品牌做一套抖音直播视觉素材：
1. 直播背景贴片 1080×1920px，主播区域保持干净，关键信息集中在 880×1300 安全区内，主文字不小于 60px。
2. 商品价格牌 400×200px，显示「今日到手价」和直播专属角标。
3. 预热海报 1080×1920px，包含直播时间和本场爆款产品缩略图。
导出到 ~/.photoshop-mcp/exports/douyin-live/ 并列出文件清单。
```

</details>

<details>
<summary>📐 多平台 SKU 批量适配导出</summary>

```
基于当前主视觉 PSD，批量适配并导出以下平台版本：
淘宝主图 800×800、天猫长图 800×1200、小红书封面 1080×1440、抖音方图 1080×1080、抖音竖图 1080×1920、公众号头图 900×383、PC Banner 1920×600。
文件夹按平台命名（taobao/、xiaohongshu/、douyin/、wechat/、pc/），文件名格式：品牌名_平台_尺寸。
每个版本重新构图，确保 logo 和核心卖点完整可见，不要简单缩放。
完成后用表格列出所有输出路径和文件大小。
```

等效模板：`ps.prepare_for_web`、`ps.export_social_variants`。

</details>

<details>
<summary>🤖 AIGC 生图 + PS 精修流水线</summary>

```
这张 AI 生成的产品场景图整体不错，但商品边缘有白边，右下角光影穿帮。
先 get_state，再精细调整蒙版去掉白边，用图章工具修复光影接缝。
用曲线统一色调，让商品和背景融合自然。
如果只需要快速交付，用 prepare-for-web recipe 导出 sRGB 优化 JPEG 到 ~/.photoshop-mcp/exports/aigc/.
完成后给我预览图确认。
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
