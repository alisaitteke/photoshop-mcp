---
layout: home

hero:
  name: Photoshop MCP
  text: AIでPhotoshopを操作
  tagline: Cursor、Claude Desktop、自然言語向けMCPサーバー — 102ツール、レシピワークフロー、スタンドアロンWeb UI。
  image:
    src: /images/readme-hero.png
    alt: Photoshop MCP — AI駆動のPhotoshop自動化
  actions:
    - theme: brand
      text: クイックスタート
      link: /ja/readme
    - theme: alt
      text: ドキュメント
      link: /docs/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/alisaitteke/photoshop-mcp

features:
  - icon: 🎯
    title: 状態認識エージェント
    details: get_state、get_preview、get_capabilitiesで操作前にドキュメントを把握。
  - icon: 🧩
    title: 102 MCPツール
    details: 86の原子ツール + 16レシープ（1回のUndoで元に戻せる）。
  - icon: 🖥️
    title: スタンドアロンUI
    details: IDE不要でClaude、GPT、Geminiとチャット。
  - icon: ⚡
    title: Action Plan（ベータ）
    details: 1回のLLM呼び出しで計画、一括実行。
  - icon: 🎨
    title: 生成AI
    details: Fireflyの塗りつぶし/削除/拡張；Neural Filters用UXPブリッジ（任意）。
  - icon: 🌐
    title: クロスプラットフォーム
    details: macOS（AppleScript）とWindows（COM）。

---

## クイックスタート

**MCPサーバー（stdio）：**

```bash
npx -y @alisaitteke/photoshop-mcp
```

**スタンドアロンWeb UI：**

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

**前提条件：** WindowsまたはmacOSのAdobe Photoshop、Node.js 18+。

[README全文](/ja/readme) · [全ツール](/docs/available-tools) · [アーキテクチャ](/docs/architecture)

> **注意：** 非公式コミュニティプロジェクト — Adobe Inc.とは無関係です。
