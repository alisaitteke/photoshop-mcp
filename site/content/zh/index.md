---
layout: home

hero:
  name: Photoshop MCP
  text: 用 AI 控制 Adobe Photoshop
  tagline: 适用于 Cursor、Claude Desktop 和自然语言的 MCP 服务器 — 102 个工具、配方工作流、独立 Web UI。
  image:
    src: /images/readme-hero.png
    alt: Photoshop MCP — AI 驱动的 Photoshop 自动化
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/readme
    - theme: alt
      text: 文档
      link: /docs/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/alisaitteke/photoshop-mcp

features:
  - icon: 🎯
    title: 状态感知
    details: get_state、get_preview 和 get_capabilities — AI 在操作前了解文档状态。
  - icon: 🧩
    title: 102 个 MCP 工具
    details: 86 个原子工具 + 16 个配方工作流，每个配方对应一次撤销。
  - icon: 🖥️
    title: 独立 Web UI
    details: 无需 IDE，通过 Claude、GPT 或 Gemini 聊天驱动 Photoshop。
  - icon: ⚡
    title: Action Plan（测试版）
    details: 一次 LLM 调用规划所有步骤，单次执行。
  - icon: 🎨
    title: 生成式 AI
    details: Firefly 填充/移除/扩展；可选 UXP 桥接 Neural Filters。
  - icon: 🌐
    title: 跨平台
    details: macOS（AppleScript）和 Windows（COM）。

---

## 快速开始

**MCP 服务器（stdio）：**

```bash
npx -y @alisaitteke/photoshop-mcp
```

**独立 Web UI：**

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

**前提条件：** Windows 或 macOS 上的 Adobe Photoshop、Node.js 18+。

[完整 README](/zh/readme) · [所有工具](/docs/available-tools) · [架构](/docs/architecture)

> **注意：** 非官方社区项目 — 与 Adobe Inc. 无关联。
