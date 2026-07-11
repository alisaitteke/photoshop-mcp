# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — Automatización de Photoshop impulsada por IA" width="100%" />
  </a>
</p>

**Idiomas:** [English](README.md) · [简体中文](README.zh-CN.md) · Español · [Deutsch](README.de.md) · [日本語](README.ja.md)

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
Haz ping a Photoshop y lee las capacidades para mi versión instalada.
Obtén el estado actual del documento antes de cambiar nada.
Abre portrait.jpg y obtén una vista previa reducida para verificar el sujeto.
Después de cada receta principal, obtén otra vista previa para confirmar el resultado.
```

</details>

<details>
<summary>👤 Retoque de retrato (receta)</summary>

```
Mejora el retrato en la capa activa con intensidad media y suavizado de piel.
Usa la receta enhance-portrait — quiero separación de frecuencias + autotonos en un solo paso deshacer.
Si la capa activa es de texto o un Objeto inteligente, rasteriza primero o elige una capa rasterizada.
Muéstrame una vista previa al terminar.
```

Plantilla de prompt MCP equivalente: `ps.enhance_portrait` con `{ intensity: "medium", skin_smoothing: "true" }`.

</details>

<details>
<summary>✂️ Eliminación de fondo (receta)</summary>

```
Elimina el fondo de la capa de retrato activa para un catálogo e-commerce.
Usa Seleccionar sujeto + una máscara de capa con difuminado de 2px. Mantén los píxeles originales detrás de la máscara.
Si el brief pide fondo blanco puro para marketplace, coloca RGB(255,255,255) y centra el producto al 70 % del encuadre.
El sujeto debe estar en la capa activa — no en un relleno de color plano.
```

Plantilla de prompt MCP equivalente: `ps.remove_background` con `{ feather_px: "2", keep_shadow: "false" }`.

</details>

<details>
<summary>🎨 Gradación de color (receta)</summary>

```
Aplica una gradación de color de película cálida al documento abierto como capas de ajuste no destructivas.
Usa la receta apply-color-grade con el preset warm_film.
Previsualiza el resultado al terminar.
```

</details>

<details>
<summary>🔬 Configuración de separación de frecuencias (receta)</summary>

```
Configura la separación de frecuencias en la capa rasterizada activa con un radio de desenfoque de 6px.
Yo pintaré en las capas Low y High por mi cuenta — no apliques suavizado adicional.
Dime qué capas editar cuando el stack esté listo.
```

Plantilla de prompt MCP equivalente: `ps.frequency_separation` con `{ radius_px: "6" }`.

</details>

<details>
<summary>🌐 Preparar para web + exportación social (recetas)</summary>

```
Prepara el documento activo para web: sRGB, reducir tamaño, enfocar, exportar un JPEG optimizado a ~/.photoshop-mcp/exports.
Luego exporta variantes para post de Instagram (1080×1080), Feed vertical (1080×1350), Stories/Reels (1080×1920) y post de X (1200×675) desde el mismo documento.
Lista las rutas de salida en una tabla.
```

Plantillas equivalentes: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>📦 Reemplazo de mockup por lotes (receta)</summary>

```
Tengo un PSD de mockup abierto con una capa de Objeto inteligente llamada "Screen".
Reemplázala con cada PNG/JPG en ~/assets/mockups/ y exporta un JPEG por recurso.
No coloques capas planas — intercambia el Objeto inteligente para preservar la perspectiva.
```

Plantilla de prompt MCP equivalente: `ps.batch_mockup_replace`.

</details>

<details>
<summary>🗂️ Organizar capas (receta)</summary>

```
Organiza el stack de capas: renombra por tipo, agrupa automáticamente las capas relacionadas y conserva los originales.
Ejecuta la receta organize-layers y luego lista las capas para que pueda revisar la nueva estructura.
```

</details>

<details>
<summary>🎨 Creación de diseño básico</summary>

```
Crea un documento de Photoshop de 1920x1080 en modo de color RGB.
Añade una capa de fondo azul claro y rellénala con RGB(240, 248, 255).
Añade texto centrado "Welcome" en fuente de 64pt.
Guarda como welcome.psd en el Escritorio.
```

</details>

<details>
<summary>🖼️ Diseño con imagen de stock (con Pexels MCP)</summary>

```
Busca imágenes de "mountain sunset" en Pexels.
Crea un documento de Photoshop de 1920x1080.
Coloca la imagen descargada y ajústala para llenar todo el lienzo.
Aplica un desenfoque gaussiano sutil de 3px.
Aumenta el brillo en 15 y el contraste en 10.
Añade texto blanco "Adventure Awaits" centrado en la parte superior en 72pt.
Establece la opacidad del texto al 90% y el modo de fusión en OVERLAY.
Guarda como adventure.jpg con calidad 10.
```

</details>

<details>
<summary>✨ Mejora de fotografías</summary>

```
Abre photo.jpg desde el Escritorio en Photoshop.
Obtén el estado y luego ejecuta la receta enhance-portrait con intensidad baja.
Si solo necesito ajustes de tono rápidos, aplica niveles automáticos, contraste automático y máscara de enfoque (120%, 1.5, 0) en la capa activa.
Ajusta el tono +15 y la saturación +15, o usa prepare-for-web cuando esté listo para exportar.
Guarda como enhanced-photo.jpg con calidad 12.
```

</details>

<details>
<summary>🎭 Efectos de capa y mezcla</summary>

```
Crea un documento de 1200x800.
Añade una nueva capa llamada "Background" y rellena con RGB(50, 50, 50).
Coloca logo.png en la posición (100, 100).
Ajusta la capa del logo al 50% de su tamaño actual.
Establece el modo de fusión en SCREEN y la opacidad al 85%.
Añade otra capa y rellena con RGB(255, 100, 50).
Establece el modo de fusión de esta capa en MULTIPLY y la opacidad al 60%.
Combina todas las capas visibles.
Guarda como composite.psd.
```

</details>

<details>
<summary>📝 Diseño de cartel de texto</summary>

```
Crea un documento vertical de 1080x1350 (tamaño de historia de Instagram).
Añade una capa y rellena con el color RGB(120, 40, 200) similar a un degradado.
Añade texto "SUMMER" en la posición (540, 300) en 96pt.
Cambia el color del texto a blanco RGB(255, 255, 255).
Establece la alineación del texto en CENTER.
Añade otro texto "2026" en (540, 450) en 128pt, color blanco.
Aplica desenfoque gaussiano de 2px a la capa de fondo.
Guarda como summer-poster.png.
```

</details>

<details>
<summary>🎬 Procesamiento por lotes</summary>

```
Abre image1.jpg.
Redimensiona a 1920x1080.
Aplica contraste automático.
Aplica enfoque sutil (cantidad 80%, radio 1.0).
Guarda como processed-1.jpg con calidad 10.
Cierra sin guardar cambios en el original.

Repite para image2.jpg e image3.jpg.
```

</details>

<details>
<summary>🖌️ Manipulación creativa</summary>

```
Crea un documento cuadrado de 2000x2000.
Coloca abstract-pattern.jpg y ajústalo para llenar el documento.
Duplica la capa.
En el duplicado, aplica desenfoque de movimiento a 45 grados, radio 50px.
Establece el modo de fusión en OVERLAY y la opacidad al 70%.
Añade texto centrado "MOTION" en blanco de 120pt.
Aplica una selección rectangular de (200, 200) a (1800, 1800).
Invierte la selección y elimínala (para crear un efecto de borde).
Aplana la imagen.
Guarda como motion-art.jpg.
```

</details>

<details>
<summary>🎯 Flujo de trabajo avanzado</summary>

```
Crea un documento de 3000x2000 a 300 DPI para impresión.
Coloca hero-image.jpg y ajústalo para llenar el lienzo.
Duplica la capa de imagen.
En el duplicado, desatura completamente.
Establece el modo de fusión en LUMINOSITY y la opacidad al 50%.
Crea una nueva capa llamada "Overlay".
Rellena con RGB(255, 150, 0) y establece el modo de fusión en SOFTLIGHT con opacidad al 30%.
Añade texto "PORTFOLIO" en la parte superior centrado en (1500, 200) en 96pt.
Establece el color del texto en blanco.
Añade subtexto "2026 Collection" en (1500, 320) en 36pt.
Crea una selección rectangular alrededor del área de texto.
Crea una máscara de capa en la capa overlay.
Combina las capas visibles.
Guarda como portfolio-cover.psd.
Exporta como portfolio-cover.jpg con calidad 12.
```

</details>

<details>
<summary>🔄 Uso de acciones</summary>

```
Abre my-photo.jpg.
Ejecuta la acción "Vintage Look" del conjunto "My Actions".
Ajusta el brillo en -10 para oscurecer ligeramente.
Guarda como vintage-photo.jpg.
```

</details>

<details>
<summary>⚡ Ejecución de scripts personalizados</summary>

```
Ejecuta este código ExtendScript personalizado:
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ Operaciones de deshacer/rehacer</summary>

```
Aplica desenfoque gaussiano de 15px a la capa activa.
[Esperar resultado]
En realidad, es demasiado desenfoque. Deshaz eso.
Aplica desenfoque gaussiano de 5px en su lugar.
```

O bien:

```
Obtén los estados del historial para ver qué operaciones se realizaron.
Deshaz las últimas 3 operaciones.
Rehaz 1 paso para recuperar una operación.
```

</details>

<details>
<summary>🔁 Recuperación de errores (envelopes estructurados)</summary>

```
Si una receta devuelve version_unsupported o generative_unavailable, llama a get_capabilities y dime qué función de Photoshop falta.
Si una herramienta falla con suggested_next_tool, sigue esa sugerencia (p. ej. rasterize_layer antes de una receta solo para capas rasterizadas).
Nunca adivines — lee get_state después de un fallo y propón el siguiente paso único.
```

</details>

<details>
<summary>📱 Kit de formatos para redes sociales (agencias)</summary>

```
Tengo un KV maestro 1:1 (2000×2000 px) para una campaña de cosmética.
Prepara el documento activo para web: sRGB, recortar y exportar variantes con el recipe prepare-for-web.
Luego exporta variantes para Instagram Feed (1080×1350), Stories/Reels (1080×1920 con zona segura superior e inferior), LinkedIn (1200×627) y banner Meta (1200×628).
Usa Ampliación generativa solo si hace falta para 9:16 sin perder el producto en el encuadre.
El producto debe ocupar al menos el 60 % del área visual; el logo en la esquina superior derecha con 20 px de margen.
Lista las rutas de salida en una tabla.
```

Plantillas equivalentes: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>🖨️ Arte final para impresión (CMYK / FOGRA39)</summary>

```
Prepara el documento activo para impresión offset en España:
convierte a CMYK con perfil Coated FOGRA39, añade 3 mm de sangrado, comprueba la resolución a 300 ppp en tamaño final.
Configura prueba en pantalla para FOGRA39 y avísame si hay colores fuera de gamut.
Las áreas de negro profundo deben ir a C50 M20 Y20 K100; el texto negro solo en K100.
Exporta un PDF/X-4 listo para imprenta y muéstrame una vista previa antes de cerrar.
```

</details>

<details>
<summary>🛍️ Bodegón publicitario con Relleno Generativo</summary>

```
Tengo un frasco de perfume en PNG con fondo eliminado sobre la capa activa.
Con photoshop_generative_fill crea tres escenarios publicitarios: baño de mármol con luz cálida, jardín mediterráneo al atardecer y superficie de hielo con gotas de agua.
Para cada variante usa photoshop_generative_expand hasta 1080×1350 (4:5) manteniendo el producto centrado.
Después de cada escena, obtén una vista previa para comprobar sombras y perspectiva.
Si generative_unavailable, llama a get_capabilities y dime qué falta.
```

</details>

<details>
<summary>🎨 Gradación de color unificada para campaña</summary>

```
Tengo 30 fotos de una campaña de moda veraniega con luces distintas.
Aplica el recipe apply-color-grade con preset warm_film como capas de ajuste no destructivas.
Si hace falta, ajusta Curvas y Tono/Saturación para un look cinematográfico mediterráneo: sombras frías, altas luces doradas.
Prepara una Acción que exporte cada imagen a 1080 px de ancho en sRGB, JPEG calidad 85, en ~/.photoshop-mcp/exports/campana/.
Muéstrame una vista previa del antes/después en tres imágenes representativas.
```

Equivalente MCP: `ps.apply_color_grade` con `{ preset: "warm_film" }`.

</details>

<details>
<summary>🏢 Mockup de identidad corporativa (manual de marca)</summary>

```
Tengo un mockup PSD abierto con Smart Objects para tarjeta de visita, menú A4, packaging kraft y perfil de Instagram.
Sustituye cada Smart Object con los assets de ~/assets/marca-cliente/ sin aplanar capas — conserva perspectiva y sombras.
Ejecuta el recipe batch_mockup_replace para exportar un JPEG por aplicación en ~/.photoshop-mcp/exports/mockups/.
Lista las rutas finales en una tabla para la presentación al cliente.
```

Plantilla equivalente: `ps.batch_mockup_replace`.

</details>

<details>
<summary>🏷️ Producción masiva multicliente (retail / Navidad)</summary>

```
Tengo un creativo maestro 1:1 para campaña navideña y 6 logos de clientes retail en ~/assets/clientes/.
Para cada cliente exporta Story 9:16, Feed 4:5 y banner 1200×628 desde el mismo PSD usando Smart Objects para logo y claim.
Nombra los archivos Cliente_Formato_Navidad2025.jpg y guarda todo en ~/.photoshop-mcp/exports/navidad/.
Si un paso falla, lee get_state y propón solo el siguiente paso.
Al terminar, lista todas las rutas en una tabla.
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
