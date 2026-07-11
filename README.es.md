# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — Automatización de Photoshop impulsada por IA" width="100%" />
  </a>
</p>

**Idiomas:** [English](README.md) · [简体中文](README.zh-CN.md) · Español · [Deutsch](README.de.md)

*v1.1+ — flujos de trabajo con recetas, menos intercambios, sesiones más ágiles. La UI independiente incluye **Action Plan (beta)** para ejecuciones de planificar-y-ejecutar.*

> **Nota:** Este es un proyecto no oficial mantenido por la comunidad y no está afiliado ni respaldado por Adobe Inc.

[![npm version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![GitHub release](https://img.shields.io/github/v/release/alisaitteke/photoshop-mcp?include_prereleases)](https://github.com/alisaitteke/photoshop-mcp/releases)
[![Action Plan](https://img.shields.io/badge/Action%20Plan-beta-amber.svg)](#action-plan-beta)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

Un servidor Model Context Protocol (MCP) que permite a asistentes de IA como Claude y Cursor controlar Adobe Photoshop de forma programática. Esto permite crear diseños, manipular imágenes y automatizar flujos de trabajo de Photoshop mediante comandos en lenguaje natural mientras se trabaja en el IDE — o a través de la **interfaz web independiente** incluida, que admite tanto claves de API como cuentas de suscripción CLI (Claude Code / Gemini CLI). La UI también ofrece un modo **Action Plan (beta)** opt-in que planifica cada paso de Photoshop en una sola llamada al LLM y los ejecuta en un único paso.

## Por qué existe esto

Los diseñadores y desarrolladores quieren controlar Photoshop desde asistentes de IA, pero las llamadas a ExtendScript sin procesar son frágiles: los agentes desperdician tokens en prueba y error, los tipos de capa rompen los filtros y un comando fallido deja el documento en un estado desconocido.

Photoshop MCP añade **conciencia del estado** (`get_state`, `get_preview`, `get_capabilities`), **herramientas de recetas** que encapsulan resultados de varios pasos en un único paso de deshacer, y **envelopes de errores estructurados** para que los agentes sepan qué probar a continuación. La UI independiente opcional y el modo Action Plan reducen los intercambios en flujos de trabajo más extensos — para que el lenguaje natural pueda realmente producir píxeles, no solo sugerirlos.

Análisis técnico detallado: [`docs/architecture.md`](docs/architecture.md).

## 🖥️ UI Independiente (sin IDE requerido)

¿No desea integrarlo con Claude Desktop o Cursor? El mismo paquete incluye una UI web completamente local que permite chatear con un modelo de IA y controlar Photoshop a través de este servidor MCP. Conéctese con una clave de API del proveedor **o**, para Anthropic y Google, reutilice la sesión OAuth de **Claude Code** o **Gemini CLI** — no se requiere una clave de API separada.

![Captura de pantalla de la UI independiente](./images/frame_generic_light.png)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

Eso es todo. Se inicia un servidor local en `127.0.0.1` (puerto libre aleatorio) y el navegador predeterminado abre la UI de chat automáticamente.

### Proveedores admitidos

Elija cualquiera de los siguientes en el primer inicio — use una clave de API **o** su cuenta de suscripción CLI existente (Anthropic y Google):

| Proveedor | Modelos | Clave de API | Cuenta CLI |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100+ modelos de cualquier proveedor | [openrouter.ai](https://openrouter.ai/keys) | — |

### Modos de autenticación

- **`api_key` (predeterminado)** — Vercel AI SDK + su clave de API del proveedor. El uso se factura por token a las tarifas de API; la UI muestra el costo estimado por chat.
- **`cli_account`** — Usa su sesión OAuth local de Claude Code o Gemini CLI. No se almacena ninguna clave de API; la UI verifica `claude auth status` / `gemini` en modo headless para confirmar el inicio de sesión. El uso se descuenta de su **cuota de suscripción**, no de la facturación de API — la barra de estado muestra "Incluido en la suscripción".

Es posible cambiar el método de autenticación por proveedor en Configuración sin perder las demás credenciales (por ejemplo, conservar una clave de API mientras se prueba la cuenta CLI y luego volver a cambiar).

### Action Plan (beta)

Un modo de ejecución opcional en la UI web independiente solo para **autenticación con clave de API** (`cli_account` siempre usa el flujo agéntico predeterminado). Actívelo con el interruptor **Action Plan** junto al selector de modelos en el composer.

En lugar de un bucle ReAct por paso (modelo → herramienta → modelo → herramienta …), Action Plan:

1. Realiza **una** llamada de planificación al LLM que genera una lista de tareas ordenada de llamadas a herramientas de Photoshop MCP con parámetros.
2. Ejecuta esas herramientas **directamente** en secuencia — sin intercambios de modelos adicionales entre pasos.
3. Si un paso falla o hay una dependencia no resuelta, ejecuta un bucle de **reparación** acotado (replanifica solo los pasos restantes, hasta 3 veces).

El plan aparece como una lista de tareas en tiempo real sobre las tarjetas de llamadas a herramientas, con estado por paso (`pending` → `running` → `done` / `error`). Los planes se persisten en el historial de chat para que sobrevivan a la recarga. El interruptor está desactivado de forma predeterminada; el flujo agéntico existente no cambia cuando Action Plan está desactivado.

Ideal para prompts de varios pasos como *"eliminar el fondo y exportar para web"*, donde se desean menos llamadas al modelo y una ejecución de principio a fin más rápida.

### Qué sucede en el primer inicio

1. Elija un proveedor y seleccione **Clave de API** o **Uses your account**.
2. Valide la clave o verifique la conexión CLI. La configuración se almacena localmente en `~/.photoshop-mcp/data.db` (SQLite, `chmod 600`). Las claves de API nunca abandonan el equipo; el modo CLI hereda OAuth de `~/.claude/` o `~/.gemini/`.
3. Escriba prompts en lenguaje natural. La UI transmite la respuesta del modelo, ejecuta llamadas a herramientas de Photoshop en tiempo real y muestra cada llamada a herramienta como una tarjeta inspeccionable (entrada + resultado).
4. Cambie de proveedor, método de autenticación o modelo en cualquier momento desde Configuración / selector de modelos — los chats, costos e historial de herramientas se persisten entre sesiones.

### Cambio del método de autenticación posteriormente

Abra **Configuración** desde la barra lateral en cualquier momento:

| Acción | Modo clave de API | Modo cuenta CLI |
|---|---|---|
| Configurar | Pegue la clave → **Guardar** | Instale CLI → `auth login` → **Verificar conexión** |
| Cambiar de modo | Elija **Clave de API** — la clave almacenada se conserva | Elija **Uses your account** — la clave no se elimina |
| Binario personalizado | — | **Ruta de CLI** opcional si `claude` / `gemini` no está en `PATH` |
| Visualización de costos | Estimación por token en la barra de estado | Insignia **Incluido en la suscripción** |

El método de autenticación se almacena por proveedor en `~/.photoshop-mcp/data.db` (`authMethod`: `api_key` o `cli_account`). Las configuraciones existentes sin `authMethod` toman `api_key` de forma predeterminada y siguen funcionando sin cambios.

### Opciones de CLI

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

### Notas

- El agente está restringido únicamente a las herramientas de Photoshop MCP — las herramientas integradas de shell, archivos y web están deshabilitadas.
- Stack tecnológico: Vue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/) en el frontend; [Hono](https://hono.dev/) en el backend. El modo con clave de API utiliza el [Vercel AI SDK](https://sdk.vercel.ai/); el modo de cuenta CLI usa el [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp) (Anthropic) o Gemini CLI headless `stream-json` (Google). Todos los caminos se comunican con este mismo servidor Photoshop MCP a través de STDIO.
- **Limitaciones de la cuenta CLI:** Gemini en modo headless puede abrir una nueva sesión en cada turno (el historial se antepone al prompt). La cuenta CLI de Anthropic consume cuota de suscripción. El inicio de sesión OAuth es prioritariamente para macOS (`claude auth login` / `gemini auth login` en Terminal).

---

## Capa de IA/Prompt para Photoshop

Además de las herramientas atómicas `photoshop_*`, el servidor incluye una capa de IA/prompt con criterio propio que ayuda a los LLM anfitriones (Cursor, Claude Desktop, etc.) a traducir solicitudes vagas del usuario en acciones de Photoshop confiables:

- **`instructions` del servidor** — contrato de flujo de trabajo anunciado en `initialize` de MCP (ping inicial, estado antes de la acción, preferir recetas, recuperación de errores). Ver [`src/prompts/instructions.ts`](src/prompts/instructions.ts).
- **Primitiva `prompts` de MCP** — 19 plantillas prediseñadas (12 de recetas + 7 de guía: `ps.enhance_portrait`, `ps.remove_background`, `ps.generative_fill`, …) a través de `prompts/list` y `prompts/get`.
- **Herramientas de recetas** — 12 herramientas `photoshop_recipe_*` orientadas a resultados (eliminar fondo, mejorar retrato, preparar para web, exportar variantes sociales, gradación de color, separación de frecuencias, mockup por lotes, organizar capas, desvanecimiento con degradado, mezcla de cielo, dodge y burn, eliminar distracción). Cada una encapsula los pasos en un único estado de historial de Photoshop (un Deshacer revierte todo). **86 herramientas en total** (74 atómicas + 12 de recetas).
- **IA Generativa** — `photoshop_generative_fill`, `photoshop_generative_remove`, `photoshop_generative_expand`, `photoshop_generative_upscale`, `photoshop_sky_replacement`, `photoshop_generate_image` (Firefly mediante ExtendScript; se requiere cuenta de Adobe + créditos).
- **Filtros neuronales** — `photoshop_neural_filter` mediante el complemento puente UXP opcional (`uxp-plugin/`).
- **Estado y vista previa** — `photoshop_get_state` (instantánea ligera), `photoshop_get_preview` (JPEG en base64 para verificación visual), `photoshop_get_capabilities` (indicadores de funciones según versión).
- **Errores estructurados** — los fallos devuelven envelopes JSON con `code` y `suggested_next_tool` para autocorrección.

Referencia completa: [`docs/prompt-layer.md`](docs/prompt-layer.md).

Verifique la paridad: `npm run verify:photoshop-prompts`. Resultados más recientes: [`docs/development.md#integration-test-results`](docs/development.md#integration-test-results).

## Ejemplos de Prompts

A continuación se muestran ejemplos de prompts que puede usar con asistentes de IA (Claude, Cursor, etc.) cuando este servidor MCP esté configurado. Prefiera las **herramientas de recetas** (`photoshop_recipe_*`) para resultados de varios pasos — cada receta es un único paso de deshacer. Use herramientas atómicas `photoshop_*` solo para ediciones precisas que ninguna receta cubra.

<details>
<summary>🧠 Sesión con conciencia del estado (primer paso recomendado)</summary>

```
Ping Photoshop and read capabilities for my installed version.
Get the current document state before changing anything.
Open portrait.jpg, get a downscaled preview so you can verify the subject.
After each major recipe, get another preview to confirm the result.
```

</details>

<details>
<summary>👤 Retoque de retrato (receta)</summary>

```
Enhance the portrait on the active layer at medium intensity with skin smoothing.
Use the enhance-portrait recipe — I want frequency separation + auto-tone in one undoable step.
If the active layer is text or a Smart Object, rasterize first or pick a raster layer.
Show me a preview when done.
```

Plantilla de prompt MCP equivalente: `ps.enhance_portrait` con `{ intensity: "medium", skin_smoothing: "true" }`.

</details>

<details>
<summary>✂️ Eliminación de fondo (receta)</summary>

```
Remove the background from the active portrait layer.
Use Select Subject + a layer mask with a 2px feather. Keep the original pixels behind the mask.
The subject must be on the active layer — not a flat color fill.
```

Plantilla de prompt MCP equivalente: `ps.remove_background` con `{ feather_px: "2", keep_shadow: "false" }`.

</details>

<details>
<summary>🎨 Gradación de color (receta)</summary>

```
Apply a warm film color grade to the open document as non-destructive adjustment layers.
Use the apply-color-grade recipe with preset warm_film.
Preview the result when finished.
```

</details>

<details>
<summary>🔬 Configuración de separación de frecuencias (receta)</summary>

```
Set up frequency separation on the active raster layer with a 6px blur radius.
I will paint on the Low and High layers myself — do not apply extra smoothing.
Tell me which layers to edit when the stack is ready.
```

Plantilla de prompt MCP equivalente: `ps.frequency_separation` con `{ radius_px: "6" }`.

</details>

<details>
<summary>🌐 Preparar para web + exportación social (recetas)</summary>

```
Prepare the active document for web: sRGB, downscale, sharpen, export one optimized JPEG to ~/.photoshop-mcp/exports.
Then export Instagram post and X post variants as separate JPEGs from the same document.
List the output paths in a table.
```

Plantillas equivalentes: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>📦 Reemplazo de mockup por lotes (receta)</summary>

```
I have a mockup PSD open with a Smart Object layer named "Screen".
Replace it with every PNG/JPG in ~/assets/mockups/ and export one JPEG per asset.
Do not place flat layers — swap the Smart Object so perspective is preserved.
```

Plantilla de prompt MCP equivalente: `ps.batch_mockup_replace`.

</details>

<details>
<summary>🗂️ Organizar capas (receta)</summary>

```
Organize the layer stack: rename by kind, auto-group related layers, preserve originals.
Run the organize-layers recipe, then list layers so I can review the new structure.
```

</details>

<details>
<summary>🎨 Creación de diseño básico</summary>

```
Create a 1920x1080 Photoshop document with RGB color mode.
Add a light blue background layer and fill it with RGB(240, 248, 255).
Add centered text "Welcome" in 64pt font.
Save as welcome.psd to my Desktop.
```

</details>

<details>
<summary>🖼️ Diseño con imagen de stock (con Pexels MCP)</summary>

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
<summary>✨ Mejora de fotografías</summary>

```
Open photo.jpg from my Desktop in Photoshop.
Get state, then run the enhance-portrait recipe at low intensity.
If I only need quick tone fixes, apply auto levels, auto contrast, and unsharp mask (120%, 1.5, 0) on the active layer instead.
Adjust hue +15 and saturation +15, or use prepare-for-web when I'm ready to export.
Save as enhanced-photo.jpg with quality 12.
```

</details>

<details>
<summary>🎭 Efectos de capa y mezcla</summary>

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
<summary>📝 Diseño de cartel de texto</summary>

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
<summary>🎬 Procesamiento por lotes</summary>

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
<summary>🖌️ Manipulación creativa</summary>

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
<summary>🎯 Flujo de trabajo avanzado</summary>

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
<summary>🔄 Uso de acciones</summary>

```
Open my-photo.jpg.
Play the "Vintage Look" action from "My Actions" set.
Adjust brightness by -10 to darken slightly.
Save as vintage-photo.jpg.
```

</details>

<details>
<summary>⚡ Ejecución de scripts personalizados</summary>

```
Execute this custom ExtendScript code:
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ Operaciones de deshacer/rehacer</summary>

```
Apply Gaussian blur 15px to the active layer.
[Wait for result]
Actually, that's too much blur. Undo that.
Apply Gaussian blur 5px instead.
```

O bien:

```
Get the history states to see what operations were performed.
Undo the last 3 operations.
Redo 1 step to bring back one operation.
```

</details>

<details>
<summary>🔁 Recuperación de errores (envelopes estructurados)</summary>

```
If a recipe returns version_unsupported or generative_unavailable, call get_capabilities and tell me which Photoshop feature is missing.
If a tool fails with suggested_next_tool, follow that hint (e.g. rasterize_layer before a raster-only recipe).
Never guess — read get_state after a failure and propose the next single step.
```

</details>

## Características

- **UI web independiente** — interfaz de chat local (`photoshop-mcp-ui`); autenticación con clave de API o suscripción CLI por proveedor (Anthropic, Google)
- **Action Plan (beta)** — modo opt-in de planificar-y-ejecutar en la UI web (solo clave de API): una llamada de planificación, ejecución directa de herramientas, reparación acotada en caso de fallo
- **Compatible con Windows y macOS**
- **Admite Photoshop 2012-2025+**
- **API ExtendScript**: Compatibilidad universal mediante automatización AppleScript/COM
- **Detección automática**: Detecta automáticamente la instalación de Photoshop en el sistema
- **78 herramientas**: 66 atómicas `photoshop_*` + 12 de recetas `photoshop_recipe_*`
- **Capa de IA/Prompt**: 16 plantillas de prompts MCP (12 de recetas + 4 de guía), instrucciones del servidor, herramientas de estado/vista previa/capacidades
- **Gestión de documentos**: Crear, abrir, guardar, cerrar, recortar documentos
- **Operaciones de capa**: Crear, eliminar, duplicar, combinar, transformar capas
- **Propiedades de capa**: Opacidad, modos de mezcla, visibilidad, bloqueo
- **Formato de texto**: Controles de fuente, tamaño, color y alineación
- **Colocación de imágenes**: Colocar imágenes, abrir archivos, ajustar al documento
- **Filtros**: Desenfoque gaussiano, Enfocar, Ruido, Desenfoque de movimiento
- **Ajustes de color**: Brillo/Contraste, Tono/Saturación, Curvas, Niveles/Contraste automáticos
- **Selecciones y máscaras**: Selecciones rectangulares, seleccionar sujeto, relleno con reconocimiento de contenido, máscara de degradado, máscaras de capa
- **Control de historial**: Operaciones de deshacer/rehacer, ver estados del historial
- **Acciones**: Reproducir acciones grabadas, ejecutar scripts personalizados
- **Rasterización automática**: Convierte capas automáticamente cuando es necesario para los filtros
- **Seguimiento de contexto**: Devuelve el estado del documento/capa después de cada operación para la conciencia contextual de la IA

## Instalación

### Uso de NPX (recomendado)

¡No se requiere instalación! Solo configure su cliente MCP:

```bash
npx @alisaitteke/photoshop-mcp
```

Para trabajar en el repositorio localmente, consulte [From Source](docs/development.md#from-source) en la guía de desarrollo.

## Configuración

### Para Cursor

Añada a su configuración de Cursor (`.cursor/config.json` o la configuración del espacio de trabajo):

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

### Para Claude Desktop

Añada a su configuración de Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` en macOS o `%APPDATA%\Claude\claude_desktop_config.json` en Windows):

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

### Variables de entorno

- `PHOTOSHOP_PATH`: (Opcional) Especifique una ruta de instalación de Photoshop personalizada
- `LOG_LEVEL`: Nivel de registro (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
- `ANALYTICS_DISABLED`: Establezca en `1` o `true` para deshabilitar completamente el análisis de uso anónimo
- `POSTHOG_DISABLED`: Alias heredado de `ANALYTICS_DISABLED`
- `ANALYTICS_PROVIDER`: Backend de análisis — `mixpanel` (predeterminado) o `posthog` (rollback)
- `MIXPANEL_TOKEN`: (Opcional) Anule el token del proyecto Mixpanel
- `MIXPANEL_API_HOST`: (Opcional) Host de ingesta de Mixpanel (predeterminado: `https://api-eu.mixpanel.com`)
- `POSTHOG_KEY`: (Opcional, heredado) Clave del proyecto PostHog — se usa solo cuando `ANALYTICS_PROVIDER=posthog`
- `POSTHOG_API_HOST`: (Opcional, heredado) Host de ingesta de PostHog (predeterminado: `https://a.alisait.com`)
- `POSTHOG_UI_HOST`: (Opcional, heredado) Host de UI de PostHog (predeterminado: `https://eu.posthog.com`)

## Herramientas disponibles

Referencia completa de todas las herramientas atómicas `photoshop_*` (parámetros, ejemplos y uso):
[`docs/available-tools.md`](docs/available-tools.md).


## Seguimiento de contexto

Cada herramienta devuelve información de contexto exhaustiva sobre el estado actual de Photoshop, que incluye:

- **Información del documento**: Nombre, dimensiones, resolución, modo de color, recuento de capas
- **Información de la capa activa**: Nombre, tipo, opacidad, modo de mezcla, visibilidad, estado de bloqueo
- **Estado de selección**: Si hay una selección activa
- **Resultado de la operación**: Detalles específicos sobre lo que se modificó

Esto permite a los asistentes de IA mantener conciencia de:
- Qué documento está activo
- En qué capa se está trabajando
- Propiedades actuales de la capa (opacidad, modo de mezcla, etc.)
- Dimensiones y configuración del documento

**Respuesta de ejemplo:**
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

Este contexto ayuda a los asistentes de IA a recordar en qué documento y capa están trabajando a lo largo de múltiples comandos.

---

## Notas específicas de la plataforma

### Windows

- Utiliza automatización COM para comunicarse con Photoshop
- Detección automática basada en el registro para las rutas de instalación
- Admite versiones de 32 y 64 bits

### macOS

- Utiliza AppleScript/OSA para la comunicación con Photoshop
- Detección automática basada en Spotlight
- Admite múltiples versiones de Photoshop instaladas simultáneamente
- **La autenticación de cuenta CLI** (UI independiente) es prioritariamente para macOS: ejecute `claude auth login` / `gemini auth login` en Terminal; las credenciales se almacenan en `~/.claude/` y `~/.gemini/`

## Versiones de Photoshop admitidas

- **Todas las versiones de Photoshop** (2012-2025+): Utiliza la API ExtendScript mediante AppleScript (macOS) o COM (Windows)

**Nota importante**: Aunque Photoshop 2022+ admite UXP para complementos, la automatización externa mediante AppleScript/COM solo puede usar ExtendScript. UXP está diseñado para complementos internos y no se puede invocar desde scripts externos. Por lo tanto, este servidor MCP utiliza ExtendScript para la máxima compatibilidad con todas las versiones de Photoshop.

## Solución de problemas

Problemas comunes de conexión, scripts y registro:
[`docs/troubleshooting.md`](docs/troubleshooting.md).

### UI independiente — Autenticación de cuenta CLI

| Síntoma | Causa probable | Solución |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLI no está instalado | `npm i -g @anthropic-ai/claude-code` o `npm i -g @google/gemini-cli` |
| `not_authenticated` | Sin sesión OAuth | Ejecute `claude auth login` o `gemini auth login` en Terminal |
| `claude` / `gemini` no está en `PATH` | Ubicación de instalación personalizada | Configuración → **Ruta de CLI** → **Verificar conexión** |
| El chat funciona en el IDE pero no en la UI (modo CLI) | Los tokens OAuth son solo para CLI | Use **Cuenta CLI** en la UI; las claves de API y las sesiones CLI son independientes |
| Gemini en conversaciones de varios turnos parece olvidadizo | El CLI headless puede iniciar una nueva sesión en cada turno | Limitación conocida; el historial se antepone al prompt (MVP) |

## Desarrollo

Configuración desde el código fuente, compilación, linting, pruebas de integración (con los resultados más recientes) y ejemplos de uso:
[`docs/development.md`](docs/development.md).

## Arquitectura

Diseño del sistema, flujo de datos, abstracción de plataforma y modos de agente de UI:
[`docs/architecture.md`](docs/architecture.md).

¿Compartir en LinkedIn o redes sociales? Use [`images/og-social.png`](images/og-social.png) y
[`docs/social-preview.md`](docs/social-preview.md) para la configuración OG y el texto de publicación.

## Contribución

¡Las contribuciones son bienvenidas! Lea [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir un PR.

## Acerca del mantenedor

**[Ali Sait Teke](https://alisait.com)** — Ingeniero Full-Stack y arquitecto de software para la era de la IA
(Python, Go, Node.js, React, Next.js, Vue).

Este proyecto surgió de una pregunta práctica: *¿cómo se hace que Photoshop sea controlable de forma confiable por LLMs sin scripts individuales frágiles?* Se convirtió en un servidor MCP con 80 herramientas, una capa de recetas/prompts para flujos de trabajo de varios pasos confiables y una UI web local para que el trabajo creativo no requiera un IDE.

**Lo que demuestra este código fuente:** Diseño de sistemas en TypeScript, integración del protocolo MCP, automatización de escritorio multiplataforma (AppleScript de macOS / COM de Windows), recuperación estructurada de errores para bucles agénticos y una UI local orientada a producción (Vue 3 + Hono + SQLite).

- [Portfolio](https://alisait.com) · [GitHub](https://github.com/alisaitteke) · [LinkedIn](https://www.linkedin.com/in/alisait/)

## Licencia

MIT

## Análisis de uso anónimo

De forma predeterminada se recopilan eventos de uso anónimos y agregados para mejorar el producto. Puede optar por no participar en cualquier momento. Detalles completos:
[`docs/anonymous-usage-analytics.md`](docs/anonymous-usage-analytics.md).

## Agradecimientos

- Desarrollado con el [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Inspirado por la comunidad de scripting de Adobe Photoshop
