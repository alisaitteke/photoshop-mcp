# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — KI-gesteuerte Photoshop-Automatisierung" width="100%" />
  </a>
</p>

**Sprachen:** [English](README.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · Deutsch · [日本語](README.ja.md) · [Türkçe](README.tr.md)

*v1.1+ — Rezept-Workflows, weniger Round-Trips, flinkere Sitzungen. Die eigenständige UI liefert **Action Plan (Beta)** für Plan-dann-Ausführen-Abläufe.*

> **Hinweis:** Dies ist ein inoffizielles, von der Community gepflegtes Projekt und steht in keiner Verbindung zu Adobe Inc. und wird von Adobe Inc. nicht unterstützt.

[![npm-Version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![GitHub-Release](https://img.shields.io/github/v/release/alisaitteke/photoshop-mcp?include_prereleases)](https://github.com/alisaitteke/photoshop-mcp/releases)
[![Action Plan](https://img.shields.io/badge/Action%20Plan-beta-amber.svg)](#action-plan-beta)
[![Lizenz: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Plattform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

Ein Model Context Protocol (MCP)-Server, der KI-Assistenten wie Claude und Cursor ermöglicht, Adobe Photoshop programmatisch zu steuern. Damit lassen sich Designs erstellen, Bilder bearbeiten und Photoshop-Workflows mit natürlicher Sprache automatisieren – direkt aus der IDE heraus oder über die mitgelieferte **eigenständige Web-UI**, die sowohl API-Schlüssel als auch CLI-Abonnementkonten (Claude Code / Gemini CLI) unterstützt. Die UI bietet außerdem einen opt-in **Action Plan (Beta)**-Modus, der alle Photoshop-Schritte in einem einzigen LLM-Aufruf plant und dann in einem einzigen Durchgang ausführt.

## Warum dieses Projekt existiert

Designerinnen, Designer und Entwicklerinnen und Entwickler möchten Photoshop über KI-Assistenten steuern, aber rohe ExtendScript-Aufrufe sind fehleranfällig: Agenten verschwenden Token durch Trial-and-Error, Ebenentypen brechen Filter, und ein fehlgeschlagener Befehl hinterlässt das Dokument in einem unbekannten Zustand.

Photoshop MCP ergänzt **State-Awareness** (`get_state`, `get_preview`, `get_capabilities`), **Rezept-Werkzeuge**, die mehrstufige Ergebnisse in einem einzigen Undo-Schritt kapseln, sowie **strukturierte Fehler-Envelopes**, sodass Agenten wissen, was als Nächstes zu versuchen ist. Die optionale eigenständige UI und der Action-Plan-Modus reduzieren Round-Trips bei längeren Workflows – sodass natürliche Sprache tatsächlich Pixel erzeugt, anstatt sie nur vorzuschlagen.

Technische Vertiefung: [`docs/architecture.md`](docs/architecture.md).

## 🖥️ Eigenständige UI (kein IDE erforderlich)

Keine Lust, dies in Claude Desktop oder Cursor einzubinden? Dasselbe Paket enthält eine vollständig lokale Web-UI, mit der sich ein KI-Modell anschreiben und Photoshop über diesen MCP-Server steuern lässt. Verbindung per Anbieter-API-Schlüssel **oder**, für Anthropic und Google, Wiederverwendung der OAuth-Sitzung von **Claude Code** oder **Gemini
CLI** – kein separater API-Schlüssel erforderlich.

![Screenshot der eigenständigen UI](./images/frame_generic_light.png)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

Das war's. Ein lokaler Server startet auf `127.0.0.1` (zufälliger freier Port) und der Standard-Browser öffnet die Chat-UI automatisch.

### Unterstützte Anbieter

Beim ersten Start einen der folgenden Anbieter auswählen – per API-Schlüssel **oder** bestehendem CLI-Abonnementkonto (Anthropic und Google):

| Anbieter | Modelle | API-Schlüssel | CLI-Konto |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100+ Modelle von beliebigen Anbietern | [openrouter.ai](https://openrouter.ai/keys) | — |

### Authentifizierungsmodi

- **`api_key` (Standard)** — Vercel AI SDK + eigener Anbieter-API-Schlüssel. Die Nutzung wird pro Token zu API-Tarifen abgerechnet; die UI zeigt die geschätzten Kosten pro Chat.
- **`cli_account`** — Verwendet die lokale OAuth-Sitzung von Claude Code oder Gemini CLI.
  Es wird kein API-Schlüssel gespeichert; die UI prüft `claude auth status` / `gemini` headless,
  um die Anmeldung zu verifizieren. Die Nutzung wird dem **Abonnementkontingent** angerechnet, nicht der API-Abrechnung — die Statusleiste zeigt "Included in subscription".

Die Authentifizierungsmethode kann pro Anbieter in den Einstellungen gewechselt werden, ohne das andere Credential zu verlieren (z. B. API-Schlüssel behalten, während das CLI-Konto ausprobiert wird, und dann zurückwechseln).

### Action Plan (Beta)

Ein optionaler Ausführungsmodus in der eigenständigen Web-UI **nur für API-Schlüssel-Authentifizierung**
(`cli_account` verwendet immer den Standard-Agenten-Fluss). Aktivieren über den
**Action Plan**-Schalter neben der Modellauswahl im composer.

Statt einer schrittweisen ReAct-Schleife (Modell → Werkzeug → Modell → Werkzeug …) führt Action Plan Folgendes durch:

1. **Einen** Planungs-LLM-Aufruf, der eine geordnete Aufgabenliste mit
   Photoshop-MCP-Tool-Aufrufen und Parametern ausgibt.
2. Führt diese Werkzeuge **direkt** nacheinander aus – keine zusätzlichen Modell-Round-Trips
   zwischen den Schritten.
3. Bei einem fehlgeschlagenen Schritt oder einer ungelösten Abhängigkeit läuft eine begrenzte **Reparatur**-Schleife
   (plant nur die verbleibenden Schritte neu, bis zu 3 Mal).

Der Plan erscheint als Live-Aufgabenliste über den Tool-Aufruf-Karten mit schrittweisem
Status (`pending` → `running` → `done` / `error`). Pläne werden im Chatverlauf gespeichert und überleben Seitenneuladungen. Der Schalter ist standardmäßig deaktiviert; der bestehende
Agenten-Fluss bleibt unverändert, wenn Action Plan deaktiviert ist.

Geeignet für mehrstufige Prompts wie *„Hintergrund entfernen und für Web exportieren"*,
bei denen weniger Modellaufrufe und eine schnellere End-to-End-Ausführung erwünscht sind.

### Was beim ersten Start passiert

1. Anbieter wählen und **API key** oder **Uses your account** auswählen.
2. Schlüssel validieren oder CLI-Verbindung prüfen. Die Konfiguration wird lokal unter
   `~/.photoshop-mcp/data.db` gespeichert (SQLite, `chmod 600`). API-Schlüssel verlassen die eigene Maschine nie; der CLI-Modus erbt OAuth von `~/.claude/` oder `~/.gemini/`.
3. Prompts in natürlicher Sprache eingeben. Die UI streamt die Modellantwort, führt
   Photoshop-Tool-Aufrufe in Echtzeit aus und rendert jeden Tool-Aufruf als überprüfbare Karte (Eingabe + Ergebnis).
4. Anbieter, Authentifizierungsmethode oder Modell jederzeit über Einstellungen / Modellauswahl wechseln
   — Chats, Kosten und Werkzeugverlauf werden sitzungsübergreifend gespeichert.

### Authentifizierungsmethode später wechseln

**Einstellungen** jederzeit über die Seitenleiste öffnen:

| Aktion | API-Schlüssel-Modus | CLI-Konto-Modus |
|---|---|---|
| Einrichten | Schlüssel einfügen → **Save** | CLI installieren → `auth login` → **Check connection** |
| Wechseln | **API key** wählen — gespeicherter Schlüssel bleibt erhalten | **Uses your account** wählen — Schlüssel wird nicht gelöscht |
| Benutzerdefinierter Pfad | — | Optionaler **CLI path**, falls `claude` / `gemini` nicht im `PATH` |
| Kostenanzeige | Schätzung pro Token in der Statusleiste | **Included in subscription**-Badge |

Die Authentifizierungsmethode wird pro Anbieter in `~/.photoshop-mcp/data.db` gespeichert (`authMethod`:
`api_key` oder `cli_account`). Bestehende Konfigurationen ohne `authMethod` verwenden standardmäßig
`api_key` und funktionieren unverändert weiter.

### CLI-Optionen

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

### Hinweise

- Der Agent ist auf Photoshop-MCP-Werkzeuge beschränkt – integrierte Shell-, Datei-
  und Web-Werkzeuge sind deaktiviert.
- Tech-Stack: Vue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/)
  im Frontend; [Hono](https://hono.dev/) im Backend. Der API-Schlüssel-Modus verwendet
  das [Vercel AI SDK](https://sdk.vercel.ai/); der CLI-Konto-Modus verwendet das
  [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp) (Anthropic)
  oder Gemini CLI headless `stream-json` (Google). Alle Pfade kommunizieren mit diesem
  Photoshop-MCP-Server über STDIO.
- **CLI-Konto-Einschränkungen:** Gemini headless öffnet möglicherweise bei jedem Schritt eine neue Sitzung
  (der Verlauf wird dem Prompt vorangestellt). Das Anthropic-CLI-Konto verbraucht
  Abonnementkontingent. OAuth-Login ist vorrangig für macOS (`claude auth login` /
  `gemini auth login` im Terminal).

---

## KI/Prompt-Schicht für Photoshop

Über die atomaren `photoshop_*`-Werkzeuge hinaus liefert der Server eine KI/Prompt-Schicht,
die Host-LLMs (Cursor, Claude Desktop usw.) dabei unterstützt, vage Benutzeranfragen in
zuverlässige Photoshop-Aktionen zu übersetzen:

- **Server-`instructions`** — Workflow-Vertrag, der beim MCP-`initialize` bekannt gegeben wird
  (einmalig pingen, Zustand vor Aktion, Rezepte bevorzugen, Fehlerbehandlung). Siehe
  [`src/prompts/instructions.ts`](src/prompts/instructions.ts).
- **MCP-`prompts`-Primitiv** — 19 vorgefertigte Templates (12 Rezept + 7 Leitfaden:
  `ps.enhance_portrait`, `ps.remove_background`, `ps.generative_fill`, …)
  über `prompts/list` und `prompts/get`.
- **Rezept-Werkzeuge** — 12 ergebnisorientierte `photoshop_recipe_*`-Werkzeuge (Hintergrund entfernen,
  Porträt aufwerten, für Web vorbereiten, Social-Varianten exportieren, Farbkorrektur,
  Frequenztrennung, Batch-Mockup, Ebenen organisieren, Verlaufsüberblendung,
  Himmelaustausch, Dodge & Burn, Störobjekt entfernen). Jedes fasst Schritte in einem einzigen
  Photoshop-Verlaufsstatus zusammen (ein Rückgängig macht alles rückgängig). **86 Werkzeuge insgesamt** (74 atomar + 12 Rezept).
- **Generative KI** — `photoshop_generative_fill`, `photoshop_generative_remove`,
  `photoshop_generative_expand`, `photoshop_generative_upscale`, `photoshop_sky_replacement`,
  `photoshop_generate_image` (Firefly über ExtendScript; Adobe-Konto + Credits erforderlich).
- **Neuronale Filter** — `photoshop_neural_filter` über optionales UXP-Bridge-Plugin (`uxp-plugin/`).
- **Status & Vorschau** — `photoshop_get_state` (günstige Momentaufnahme),
  `photoshop_get_preview` (Base64-JPEG zur visuellen Überprüfung),
  `photoshop_get_capabilities` (versionsabhängige Feature-Flags).
- **Strukturierte Fehler** — Fehler geben JSON-Envelopes mit `code` und
  `suggested_next_tool` zur Selbstkorrektur zurück.

Vollständige Referenz: [`docs/prompt-layer.md`](docs/prompt-layer.md).

Parität prüfen: `npm run verify:photoshop-prompts`. Aktuelle Ergebnisse:
[`docs/development.md#integration-test-results`](docs/development.md#integration-test-results).

## Beispiel-Prompts

Nachfolgend finden sich Beispiel-Prompts zur Verwendung mit KI-Assistenten (Claude, Cursor usw.),
wenn dieser MCP-Server konfiguriert ist. Für mehrstufige Ergebnisse **Rezept-Werkzeuge** (`photoshop_recipe_*`)
bevorzugen — jedes Rezept ist ein einziger Undo-Schritt. Atomare `photoshop_*`-Werkzeuge
nur für feinkörnige Bearbeitungen verwenden, die kein Rezept abdeckt.

<details>
<summary>🧠 Zustandsbewusstes Arbeiten (empfohlener erster Schritt)</summary>

```
Photoshop anpingen und die Fähigkeiten für die installierte Version auslesen.
Den aktuellen Dokumentzustand abrufen, bevor Änderungen vorgenommen werden.
portrait.jpg öffnen und eine verkleinerte Vorschau abrufen, um das Motiv zu prüfen.
Nach jedem wichtigen Rezept eine weitere Vorschau abrufen, um das Ergebnis zu bestätigen.
```

</details>

<details>
<summary>👤 Porträt-Retusche (Rezept)</summary>

```
Das Porträt auf der aktiven Ebene mit mittlerer Intensität und Hautglättung aufwerten.
Das enhance-portrait recipe verwenden — ich möchte Frequenztrennung + Auto-Tonwerte in einem einzigen rückgängig machbaren Schritt.
Wenn die aktive Ebene Text oder ein Smart Object ist, zuerst rastern oder eine Rasterebene auswählen.
Nach Abschluss eine Vorschau zeigen.
```

Entsprechendes MCP-Prompt-Template: `ps.enhance_portrait` mit `{ intensity: "medium", skin_smoothing: "true" }`.

</details>

<details>
<summary>✂️ Hintergrundentfernung (Rezept)</summary>

```
Den Hintergrund von der aktiven Porträtebene für einen E-Commerce-Packshot entfernen.
Select Subject + eine Ebenenmaske mit 2 Pixel Weichzeichnung verwenden. Die Originalpixel hinter der Maske beibehalten.
Falls der Briefing reinweiß RGB(255,255,255) verlangt, Produkt zentrieren und mindestens 70 % der Bildfläche einnehmen lassen.
Das Motiv muss auf der aktiven Ebene liegen — keine einfarbige Füllfläche.
```

Entsprechendes MCP-Prompt-Template: `ps.remove_background` mit `{ feather_px: "2", keep_shadow: "false" }`.

</details>

<details>
<summary>🎨 Farbkorrektur (Rezept)</summary>

```
Eine warme Film-Farbkorrektur auf das geöffnete Dokument als nicht-destruktive Einstellungsebenen anwenden.
Das apply-color-grade recipe mit dem Preset warm_film verwenden.
Das Ergebnis nach Abschluss in der Vorschau anzeigen.
```

</details>

<details>
<summary>🔬 Frequenztrennung einrichten (Rezept)</summary>

```
Frequenztrennung auf der aktiven Rasterebene mit einem Weichzeichnungsradius von 6 Pixeln einrichten.
Ich werde selbst auf den Low- und High-Ebenen malen — keine zusätzliche Glättung anwenden.
Mir mitteilen, welche Ebenen bearbeitet werden sollen, wenn der Ebenen-Stack bereit ist.
```

Entsprechendes MCP-Prompt-Template: `ps.frequency_separation` mit `{ radius_px: "6" }`.

</details>

<details>
<summary>🌐 Für Web vorbereiten + Social-Export (Rezepte)</summary>

```
Das aktive Dokument für das Web vorbereiten: sRGB, verkleinern, schärfen, ein optimiertes JPEG nach ~/.photoshop-mcp/exports exportieren.
Dann Instagram-Feed (1080×1350), Story/Reels (1080×1920), LinkedIn (1200×627) und XING-Anzeige (1200×628) als separate JPEGs exportieren.
Die Ausgabepfade in einer Tabelle auflisten.
```

Entsprechende Templates: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>📦 Batch-Mockup-Ersetzung (Rezept)</summary>

```
Ich habe ein Mockup-PSD geöffnet mit einer Smart Object-Ebene namens „Screen".
Jedes PNG/JPG aus ~/assets/mockups/ ersetzen und ein JPEG pro Asset exportieren.
Keine flachen Ebenen platzieren — das Smart Object tauschen, damit die Perspektive erhalten bleibt.
```

Entsprechendes MCP-Prompt-Template: `ps.batch_mockup_replace`.

</details>

<details>
<summary>🗂️ Ebenen organisieren (Rezept)</summary>

```
Den Ebenen-Stack organisieren: nach Typ umbenennen, verwandte Ebenen automatisch gruppieren, Originale beibehalten.
Das organize-layers recipe ausführen, dann die Ebenen auflisten, damit ich die neue Struktur überprüfen kann.
```

</details>

<details>
<summary>🎨 Einfaches Design erstellen</summary>

```
Ein 1920×1080-Photoshop-Dokument im RGB-Farbmodus erstellen.
Eine hellblaue Hintergrundebene hinzufügen und mit RGB(240, 248, 255) füllen.
Zentrierten Text „Welcome" in 64pt Schriftgröße hinzufügen.
Als welcome.psd auf dem Schreibtisch speichern.
```

</details>

<details>
<summary>🖼️ Stock-Bild-Design (mit Pexels MCP)</summary>

```
Bei Pexels nach „mountain sunset"-Bildern suchen.
Ein 1920×1080-Photoshop-Dokument erstellen.
Das heruntergeladene Bild platzieren und so anpassen, dass es die gesamte Leinwand ausfüllt.
Einen subtilen Gaußschen Weichzeichner von 3 Pixeln anwenden.
Helligkeit um 15 und Kontrast um 10 erhöhen.
Weißen Text „Adventure Awaits" in 72pt oben mittig hinzufügen.
Textdeckkraft auf 90 % und Mischmodus auf OVERLAY setzen.
Als adventure.jpg mit Qualität 10 speichern.
```

</details>

<details>
<summary>✨ Fotobearbeitung</summary>

```
photo.jpg vom Schreibtisch in Photoshop öffnen.
Zustand abrufen, dann das enhance-portrait recipe mit niedriger Intensität ausführen.
Falls nur schnelle Tonwertkorrekturen benötigt werden, stattdessen Auto-Tonwerte, Auto-Kontrast und Unschärfemaske (120 %, 1,5, 0) auf die aktive Ebene anwenden.
Farbton um +15 und Sättigung um +15 anpassen, oder prepare-for-web verwenden, wenn der Export bereit ist.
Als enhanced-photo.jpg mit Qualität 12 speichern.
```

</details>

<details>
<summary>🎭 Ebeneneffekte & Blending</summary>

```
Ein 1200×800-Dokument erstellen.
Eine neue Ebene namens „Background" hinzufügen und mit RGB(50, 50, 50) füllen.
logo.png an Position (100, 100) platzieren.
Die Logo-Ebene auf 50 % ihrer aktuellen Größe skalieren.
Mischmodus auf SCREEN und Deckkraft auf 85 % setzen.
Eine weitere Ebene hinzufügen und mit RGB(255, 100, 50) füllen.
Den Mischmodus dieser Ebene auf MULTIPLY und die Deckkraft auf 60 % setzen.
Alle sichtbaren Ebenen zusammenführen.
Als composite.psd speichern.
```

</details>

<details>
<summary>📝 Textplakat-Design</summary>

```
Ein 1080×1350-Hochformatdokument erstellen (Instagram-Story-Größe).
Eine Ebene hinzufügen und mit der verlaufsähnlichen Farbe RGB(120, 40, 200) füllen.
Text „SUMMER" an Position (540, 300) in 96pt hinzufügen.
Textfarbe auf Weiß RGB(255, 255, 255) ändern.
Textausrichtung auf CENTER setzen.
Einen weiteren Text „2026" an Position (540, 450) in 128pt, weiße Farbe, hinzufügen.
Gaußschen Weichzeichner 2px auf die Hintergrundebene anwenden.
Als summer-poster.png speichern.
```

</details>

<details>
<summary>🎬 Stapelverarbeitung</summary>

```
image1.jpg öffnen.
Auf 1920×1080 skalieren.
Auto-Kontrast anwenden.
Subtiles Schärfen anwenden (Stärke 80 %, Radius 1,0).
Als processed-1.jpg mit Qualität 10 speichern.
Ohne das Original zu speichern schließen.

Dasselbe für image2.jpg und image3.jpg wiederholen.
```

</details>

<details>
<summary>🖌️ Kreative Bildbearbeitung</summary>

```
Ein 2000×2000-Quadratdokument erstellen.
abstract-pattern.jpg platzieren und an das Dokument anpassen.
Die Ebene duplizieren.
Auf der Duplikat-Ebene Bewegungsunschärfe bei 45 Grad, Radius 50 Pixel anwenden.
Mischmodus auf OVERLAY und Deckkraft auf 70 % setzen.
Zentrierten Text „MOTION" in 120pt Weiß hinzufügen.
Eine rechteckige Auswahl von (200, 200) bis (1800, 1800) erstellen.
Die Auswahl umkehren und löschen (um einen Rahmeneffekt zu erzeugen).
Das Bild reduzieren.
Als motion-art.jpg speichern.
```

</details>

<details>
<summary>🎯 Erweiterter Workflow</summary>

```
Ein 3000×2000-Dokument mit 300 DPI für den Druck erstellen.
hero-image.jpg platzieren und an die Leinwand anpassen.
Die Bildebene duplizieren.
Die Duplikat-Ebene vollständig entsättigen.
Mischmodus auf LUMINOSITY und Deckkraft auf 50 % setzen.
Eine neue Ebene namens „Overlay" erstellen.
Mit RGB(255, 150, 0) füllen und Mischmodus auf SOFTLIGHT bei 30 % Deckkraft setzen.
Text „PORTFOLIO" oben mittig bei (1500, 200) in 96pt hinzufügen.
Textfarbe auf Weiß setzen.
Untertext „2026 Collection" bei (1500, 320) in 36pt hinzufügen.
Eine rechteckige Auswahl um den Textbereich erstellen.
Eine Ebenenmaske auf der Overlay-Ebene erstellen.
Sichtbare Ebenen zusammenführen.
Als portfolio-cover.psd speichern.
Als portfolio-cover.jpg mit Qualität 12 exportieren.
```

</details>

<details>
<summary>🔄 Aktionen verwenden</summary>

```
my-photo.jpg öffnen.
Die Aktion „Vintage Look" aus dem Set „My Actions" ausführen.
Helligkeit um -10 anpassen, um leicht abzudunkeln.
Als vintage-photo.jpg speichern.
```

</details>

<details>
<summary>⚡ Benutzerdefinierte Skript-Ausführung</summary>

```
Diesen benutzerdefinierten ExtendScript-Code ausführen:
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ Rückgängig/Wiederholen-Operationen</summary>

```
Gaußschen Weichzeichner 15px auf die aktive Ebene anwenden.
[Auf Ergebnis warten]
Das ist eigentlich zu viel Weichzeichnung. Das rückgängig machen.
Stattdessen Gaußschen Weichzeichner 5px anwenden.
```

Oder:

```
Die Verlaufszustände abrufen, um zu sehen, welche Operationen durchgeführt wurden.
Die letzten 3 Operationen rückgängig machen.
1 Schritt wiederholen, um eine Operation zurückzubringen.
```

</details>

<details>
<summary>🔁 Fehlerbehandlung (strukturierte Envelopes)</summary>

```
Falls ein Rezept version_unsupported oder generative_unavailable zurückgibt, get_capabilities aufrufen und mitteilen, welche Photoshop-Funktion fehlt.
Falls ein Werkzeug mit suggested_next_tool fehlschlägt, diesen Hinweis befolgen (z. B. rasterize_layer vor einem nur für Rasterebenen geeigneten Rezept).
Niemals raten — nach einem Fehler get_state auslesen und den nächsten einzelnen Schritt vorschlagen.
```

</details>

<details>
<summary>📱 Social-Media-Kampagnenpaket (Agentur)</summary>

```
Ich habe ein Key-Visual-Master im Quadratformat für eine deutsche Mittelstandskampagne.
Bereite das aktive Dokument mit dem prepare-for-web recipe für sRGB vor und exportiere optimierte JPEGs nach ~/.photoshop-mcp/exports.
Exportiere zusätzlich Instagram-Feed (1080×1350), Story/Reels (1080×1920, obere und untere 250 px als sichere Zone freihalten), LinkedIn Sponsored Content (1200×627) und XING-Anzeige (1200×628).
Nutze photoshop_generative_expand nur, wenn das Motiv im 9:16-Format sonst abgeschnitten würde.
Produkt mindestens 60 % der Bildfläche; Logo oben rechts mit 20 px Abstand.
Gib alle Ausgabepfade in einer Tabelle aus.
```

Entsprechende Templates: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>🖨️ Druckdatenaufbereitung (CMYK / PDF/X-4)</summary>

```
Bereite das aktive Dokument für den Offsetdruck in Deutschland vor:
RGB nach CMYK konvertieren mit Zielprofil ISO Coated v2 (ECI), 3 mm Beschnitt an allen Seiten, Auflösung 300 dpi im Endformat prüfen.
Softproof für ISO Coated v2 einrichten und auf Farbverschiebungen hinweisen.
Tiefschwarze Flächen auf C50 M20 Y20 K100 setzen; schwarzen Text nur mit K100.
Als PDF/X-4 mit eingebettetem Profil exportieren und eine Vorschau anzeigen.
```

</details>

<details>
<summary>📸 E-Commerce-Freisteller-Serie (Packshot)</summary>

```
Ich habe einen Ordner mit Produktfotos für Amazon.de und Zalando.
Für jedes Bild: Hintergrund entfernen mit Select Subject, 2 px Kante weichzeichnen, auf reinweiß RGB(255,255,255) legen, auf 2000×2000 px zentrieren.
Staub und Kratzer auf einer separaten Retusche-Ebene entfernen, sRGB einbetten, als JPEG Qualität 90 nach ~/.photoshop-mcp/exports/packshots/ speichern.
Starte mit einem Testbild, zeige eine Vorschau, und fahre dann mit dem restlichen Ordner fort.
```

</details>

<details>
<summary>👗 Ghost Mannequin / Hollowman (Mode-E-Commerce)</summary>

```
Ich habe front.jpg (Kleid auf Mannequin) und inner.jpg (Innenkragen) geöffnet.
Stelle den Mannequin auf front.jpg frei, setze inner.jpg darunter, kaschiere den Übergang am Kragen mit einer weichen Ebenenmaske.
Hintergrund auf RGB(255,255,255), dezente Faltenretusche ohne unnatürliche Glättung.
Exportiere transparentes PNG und JPEG 2000×2000 px nach ~/.photoshop-mcp/exports/fashion/.
Zeige eine Vorschau, bevor der Batch exportiert wird.
```

</details>

<details>
<summary>🤖 KI-Key-Visual mit Harmonisierung</summary>

```
Ich habe ein Produktfreisteller-PNG und ein Lifestyle-Hintergrundbild im aktiven Dokument.
Platziere das Produkt unten rechts auf 85 % der ursprünglichen Größe.
Wende photoshop_generative_fill oder Harmonize an, damit Licht, Schatten und Farbtemperatur zur Szene passen.
Füge einen natürlichen Schlagschatten hinzu (Multiplizieren, ca. 35 % Deckkraft).
Speichere als Master-PSD und exportiere 1200×627 px JPEG für LinkedIn nach ~/.photoshop-mcp/exports/kv/.
```

</details>

<details>
<summary>📦 Verpackungs-Mockup & POS-Visualisierung</summary>

```
Ich habe ein Verpackungs-Mockup-PSD mit einer Smart-Object-Ebene namens "Screen" geöffnet.
Ersetze sie mit jedem PNG/JPG aus ~/assets/verpackung/ und exportiere ein JPEG pro Variante — keine flachen Ebenen, Smart Object tauschen, damit Perspektive erhalten bleibt.
Nutze das batch_mockup_replace recipe und liste alle Ausgabepfade in einer Tabelle für die Kundenfreigabe.
```

Entsprechendes Template: `ps.batch_mockup_replace`.

</details>

## Funktionen

- **Eigenständige Web-UI** — lokale Chat-Oberfläche (`photoshop-mcp-ui`); API-Schlüssel oder CLI-Abonnement-Authentifizierung pro Anbieter (Anthropic, Google)
- **Action Plan (Beta)** — opt-in Plan-dann-Ausführen-Modus in der Web-UI (nur API-Schlüssel): ein Planungsaufruf, direkte Werkzeugausführung, begrenzte Reparatur bei Fehler
- **Funktioniert auf Windows und macOS**
- **Unterstützt Photoshop 2012–2025+**
- **ExtendScript-API**: Universelle Kompatibilität über AppleScript/COM-Automatisierung
- **Automatische Erkennung**: Findet die Photoshop-Installation automatisch
- **78 Werkzeuge**: 66 atomare `photoshop_*` + 12 Rezept `photoshop_recipe_*`
- **KI/Prompt-Schicht**: 16 MCP-Prompt-Templates (12 Rezept + 4 Leitfaden), Server-Instructions, Zustand-/Vorschau-/Fähigkeits-Werkzeuge
- **Dokumentenverwaltung**: Dokumente erstellen, öffnen, speichern, schließen, beschneiden
- **Ebenenoperationen**: Ebenen erstellen, löschen, duplizieren, zusammenführen, transformieren
- **Ebeneneigenschaften**: Deckkraft, Mischmodi, Sichtbarkeit, Sperren
- **Textformatierung**: Schrift, Größe, Farbe, Ausrichtung
- **Bildplatzierung**: Bilder platzieren, Dateien öffnen, an Dokument anpassen
- **Filter**: Gaußsche Unschärfe, Schärfen, Rauschen, Bewegungsunschärfe
- **Farbanpassungen**: Helligkeit/Kontrast, Farbton/Sättigung, Kurven, Automatische Tonwerte/Kontrast
- **Auswahlen & Masken**: Rechteckige Auswahlen, Motiv auswählen, inhaltsbewusstes Füllen, Verlaufsmaske, Ebenenmasken
- **Verlaufssteuerung**: Rückgängig/Wiederholen-Operationen, Verlaufszustände anzeigen
- **Aktionen**: Aufgezeichnete Aktionen ausführen, benutzerdefinierte Skripte ausführen
- **Automatisches Rastern**: Konvertiert Ebenen automatisch, wenn für Filter erforderlich
- **Kontext-Tracking**: Gibt nach jeder Operation den Dokument-/Ebenenstatus zurück, damit KI-Assistenten den Überblick behalten

## Installation

### Mit NPX (Empfohlen)

Keine Installation erforderlich! Einfach den MCP-Client konfigurieren:

```bash
npx @alisaitteke/photoshop-mcp
```

Für die lokale Entwicklung am Repository: [Aus dem Quellcode](docs/development.md#from-source) im Entwicklungshandbuch.

## Konfiguration

### Für Cursor

Zu den Cursor-Einstellungen (`.cursor/config.json` oder Workspace-Einstellungen) hinzufügen:

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

### Für Claude Desktop

Zur Claude Desktop-Konfiguration hinzufügen (`~/Library/Application Support/Claude/claude_desktop_config.json` unter macOS oder `%APPDATA%\Claude\claude_desktop_config.json` unter Windows):

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

### Umgebungsvariablen

- `PHOTOSHOP_PATH`: (Optional) Benutzerdefinierten Photoshop-Installationspfad angeben
- `LOG_LEVEL`: Protokollierungsstufe (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
- `ANALYTICS_DISABLED`: Auf `1` oder `true` setzen, um anonyme Nutzungsanalysen vollständig zu deaktivieren
- `POSTHOG_DISABLED`: Veralteter Alias für `ANALYTICS_DISABLED`
- `ANALYTICS_PROVIDER`: Analytics-Backend — `mixpanel` (Standard) oder `posthog` (rollback)
- `MIXPANEL_TOKEN`: (Optional) Mixpanel-Projekt-Token überschreiben
- `MIXPANEL_API_HOST`: (Optional) Mixpanel-Ingest-Host (Standard: `https://api-eu.mixpanel.com`)
- `POSTHOG_KEY`: (Optional, veraltet) PostHog-Projekt-Schlüssel — nur verwendet, wenn `ANALYTICS_PROVIDER=posthog`
- `POSTHOG_API_HOST`: (Optional, veraltet) PostHog-Ingest-Host (Standard: `https://a.alisait.com`)
- `POSTHOG_UI_HOST`: (Optional, veraltet) PostHog-UI-Host (Standard: `https://eu.posthog.com`)

## Verfügbare Werkzeuge

Vollständige Referenz aller atomaren `photoshop_*`-Werkzeuge (Parameter, Beispiele und Verwendung):
[`docs/available-tools.md`](docs/available-tools.md).


## Kontext-Tracking

Jedes Werkzeug gibt umfassende Kontextinformationen über den aktuellen Photoshop-Zustand zurück, darunter:

- **Dokumentinfo**: Name, Abmessungen, Auflösung, Farbmodus, Ebenenanzahl
- **Aktive Ebene**: Name, Typ, Deckkraft, Mischmodus, Sichtbarkeit, Sperrzustand
- **Auswahlstatus**: Ob eine Auswahl aktiv ist
- **Operationsergebnis**: Details zu den vorgenommenen Änderungen

Dadurch können KI-Assistenten den Überblick behalten über:
- Welches Dokument aktiv ist
- An welcher Ebene gearbeitet wird
- Aktuelle Ebeneneigenschaften (Deckkraft, Mischmodus usw.)
- Dokumentabmessungen und -einstellungen

**Beispielantwort:**
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

Dieser Kontext hilft KI-Assistenten, sich über mehrere Befehle hinweg zu merken, mit welchem Dokument und welcher Ebene sie arbeiten.

---

## Plattformspezifische Hinweise

### Windows

- Verwendet COM-Automatisierung zur Kommunikation mit Photoshop
- Registrierungsbasierte automatische Erkennung von Installationspfaden
- Unterstützt sowohl 32-Bit- als auch 64-Bit-Versionen

### macOS

- Verwendet AppleScript/OSA für die Photoshop-Kommunikation
- Spotlight-basierte automatische Erkennung
- Unterstützt mehrere gleichzeitig installierte Photoshop-Versionen
- **CLI-Konto-Authentifizierung** (eigenständige UI) ist vorrangig für macOS: `claude auth login` /
  `gemini auth login` im Terminal ausführen; Zugangsdaten werden unter `~/.claude/` und
  `~/.gemini/` gespeichert

## Unterstützte Photoshop-Versionen

- **Alle Photoshop-Versionen** (2012–2025+): Verwendet die ExtendScript-API über AppleScript (macOS) oder COM (Windows)

**Wichtiger Hinweis**: Obwohl Photoshop 2022+ UXP für Plugins unterstützt, kann externe Automatisierung über AppleScript/COM nur ExtendScript verwenden. UXP ist für interne Plugins ausgelegt und kann nicht von externen Skripten aufgerufen werden. Daher verwendet dieser MCP-Server ExtendScript für maximale Kompatibilität mit allen Photoshop-Versionen.

## Fehlerbehebung

Häufige Verbindungs-, Skripting- und Protokollierungsprobleme:
[`docs/troubleshooting.md`](docs/troubleshooting.md).

### Eigenständige UI — CLI-Konto-Authentifizierung

| Symptom | Wahrscheinliche Ursache | Lösung |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLI nicht installiert | `npm i -g @anthropic-ai/claude-code` oder `npm i -g @google/gemini-cli` |
| `not_authenticated` | Keine OAuth-Sitzung | `claude auth login` oder `gemini auth login` im Terminal ausführen |
| `claude` / `gemini` nicht im `PATH` | Benutzerdefinierter Installationsort | Einstellungen → **CLI path** → **Check connection** |
| Chat funktioniert in IDE, nicht aber in UI (CLI-Modus) | OAuth-Token sind CLI-exklusiv | **CLI-Konto** in der UI verwenden; API-Schlüssel und CLI-Sitzungen sind getrennt |
| Gemini Multi-Turn wirkt vergesslich | Headless-CLI öffnet möglicherweise bei jedem Schritt eine neue Sitzung | Bekannte Einschränkung; Verlauf wird dem Prompt vorangestellt (MVP) |

## Entwicklung

Einrichtung aus dem Quellcode, Build, Lint, Integrationstests (mit aktuellen Ergebnissen) und Nutzungsbeispiele:
[`docs/development.md`](docs/development.md).

## Architektur

Systemdesign, Datenfluss, Plattformabstraktion und UI-Agent-Modi:
[`docs/architecture.md`](docs/architecture.md).

Teilen auf LinkedIn oder in sozialen Medien? [`images/og-social.png`](images/og-social.png) und
[`docs/social-preview.md`](docs/social-preview.md) für OG-Einrichtung und Post-Text verwenden.

## Mitwirken

Beiträge sind willkommen! Bitte [CONTRIBUTING.md](CONTRIBUTING.md) lesen, bevor eine PR geöffnet wird.

## Über den Maintainer

**[Ali Sait Teke](https://alisait.com)** — Full-Stack-Ingenieur & Softwarearchitekt des KI-Zeitalters
(Python, Go, Node.js, React, Next.js, Vue).

Dieses Projekt entstand aus einer praktischen Frage: *Wie lässt sich Photoshop zuverlässig durch LLMs steuern, ohne fragile Einzelskripte?* Es wuchs zu einem MCP-Server mit 80 Werkzeugen, einer Rezept-/Prompt-Schicht für zuverlässige Mehrschritt-Workflows und einer lokalen Web-UI heran, damit kreative Arbeit kein IDE erfordert.

**Was dieser Quellcode demonstriert:** TypeScript-Systemdesign, MCP-Protokollintegration,
plattformübergreifende Desktop-Automatisierung (macOS AppleScript / Windows COM),
strukturierte Fehlerwiederherstellung für agentische Schleifen und eine produktionsorientierte local-first-UI
(Vue 3 + Hono + SQLite).

- [Portfolio](https://alisait.com) · [GitHub](https://github.com/alisaitteke) · [LinkedIn](https://www.linkedin.com/in/alisait/)

## Lizenz

MIT

## Anonyme Nutzungsanalyse

Standardmäßig werden anonymisierte, aggregierte Nutzungsereignisse erfasst, um das Produkt zu verbessern. Eine opt-out-Option steht jederzeit zur Verfügung. Vollständige Details:
[`docs/anonymous-usage-analytics.md`](docs/anonymous-usage-analytics.md).

## Danksagungen

- Entwickelt mit dem [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Inspiriert von der Adobe-Photoshop-Scripting-Community
