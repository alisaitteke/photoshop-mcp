---
layout: home

hero:
  name: Photoshop MCP
  text: Photoshop'u yapay zeka ile yönetin
  tagline: Cursor, Claude Desktop ve doğal dil için MCP sunucusu — 102 araç, tarif iş akışları, bağımsız web UI.
  image:
    src: /images/readme-hero.png
    alt: Photoshop MCP — Yapay zeka destekli Photoshop otomasyonu
  actions:
    - theme: brand
      text: Hızlı Başlangıç
      link: /tr/readme
    - theme: alt
      text: Dokümantasyon
      link: /docs/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/alisaitteke/photoshop-mcp

features:
  - icon: 🎯
    title: Durum farkındalığı
    details: get_state, get_preview ve get_capabilities — ajanlar hareket etmeden önce belgeyi bilir.
  - icon: 🧩
    title: 102 MCP aracı
    details: 86 atomik araç ve 16 tarif iş akışı; her tarif tek geri alma adımı.
  - icon: 🖥️
    title: Bağımsız web UI
    details: IDE olmadan Claude, GPT veya Gemini ile sohbet edin; Photoshop'u doğal dille yönetin.
  - icon: ⚡
    title: Action Plan (beta)
    details: Tüm adımları tek LLM çağrısında planlayın, tek geçişte yürütün.
  - icon: 🎨
    title: Generative AI
    details: Firefly doldurma/kaldırma/genişletme; isteğe bağlı UXP köprüsü ile Neural Filters.
  - icon: 🌐
    title: Çapraz platform
    details: macOS (AppleScript) ve Windows (COM). Photoshop 2012–2025 uyumluluğu.

---

## Hızlı başlangıç

**MCP sunucusu (stdio):**

```bash
npx -y @alisaitteke/photoshop-mcp
```

**Bağımsız web UI:**

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

**Gereksinimler:** Windows veya macOS'ta çalışan Adobe Photoshop, Node.js 18+.

[Tam README](/tr/readme) · [Tüm araçlar](/docs/available-tools) · [Mimari](/docs/architecture)

> **Not:** Resmi olmayan topluluk projesi — Adobe Inc. ile bağlantılı değildir.
