---
layout: home

hero:
  name: Photoshop MCP
  text: Controla Photoshop con IA
  tagline: Servidor MCP para Cursor, Claude Desktop y lenguaje natural — 102 herramientas, flujos recipe y UI web independiente.
  image:
    src: /images/readme-hero.png
    alt: Photoshop MCP — Automatización de Photoshop con IA
  actions:
    - theme: brand
      text: Inicio rápido
      link: /es/readme
    - theme: alt
      text: Documentación
      link: /docs/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/alisaitteke/photoshop-mcp

features:
  - icon: 🎯
    title: Agentes con contexto
    details: get_state, get_preview y get_capabilities antes de cada acción.
  - icon: 🧩
    title: 102 herramientas MCP
    details: 86 herramientas atómicas + 16 recipes con un solo paso de deshacer.
  - icon: 🖥️
    title: UI web independiente
    details: Chatea con Claude, GPT o Gemini sin IDE.
  - icon: ⚡
    title: Action Plan (beta)
    details: Planifica en una llamada LLM, ejecuta en un solo paso.
  - icon: 🎨
    title: IA generativa
    details: Firefly fill/remove/expand; bridge UXP opcional para Neural Filters.
  - icon: 🌐
    title: Multiplataforma
    details: macOS (AppleScript) y Windows (COM).

---

## Inicio rápido

**Servidor MCP (stdio):**

```bash
npx -y @alisaitteke/photoshop-mcp
```

**UI web independiente:**

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

**Requisitos:** Adobe Photoshop en Windows o macOS, Node.js 18+.

[README completo](/es/readme) · [Herramientas](/docs/available-tools) · [Arquitectura](/docs/architecture)

> **Nota:** Proyecto comunitario no oficial — no afiliado a Adobe Inc.
