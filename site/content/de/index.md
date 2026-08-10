---
layout: home

hero:
  name: Photoshop MCP
  text: Photoshop mit KI steuern
  tagline: MCP-Server für Cursor, Claude Desktop und natürliche Sprache — 102 Tools, Recipe-Workflows, eigenständige Web-UI.
  image:
    src: /images/readme-hero.png
    alt: Photoshop MCP — KI-gesteuerte Photoshop-Automatisierung
  actions:
    - theme: brand
      text: Schnellstart
      link: /de/readme
    - theme: alt
      text: Dokumentation
      link: /docs/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/alisaitteke/photoshop-mcp

features:
  - icon: 🎯
    title: Zustandsbewusste Agenten
    details: get_state, get_preview und get_capabilities vor jeder Aktion.
  - icon: 🧩
    title: 102 MCP-Tools
    details: 86 atomische Tools + 16 Recipe-Workflows mit einem Undo-Schritt.
  - icon: 🖥️
    title: Eigenständige Web-UI
    details: Chat mit Claude, GPT oder Gemini — ohne IDE.
  - icon: ⚡
    title: Action Plan (beta)
    details: Ein LLM-Aufruf plant alle Schritte, eine Ausführung.
  - icon: 🎨
    title: Generative KI
    details: Firefly Fill/Remove/Expand; optionaler UXP-Bridge für Neural Filters.
  - icon: 🌐
    title: Plattformübergreifend
    details: macOS (AppleScript) und Windows (COM).

---

## Schnellstart

**MCP-Server (stdio):**

```bash
npx -y @alisaitteke/photoshop-mcp
```

**Eigenständige Web-UI:**

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

**Voraussetzungen:** Adobe Photoshop unter Windows oder macOS, Node.js 18+.

[Vollständiges README](/de/readme) · [Alle Tools](/docs/available-tools) · [Architektur](/docs/architecture)

> **Hinweis:** Unoffizielles Community-Projekt — nicht mit Adobe Inc. verbunden.
