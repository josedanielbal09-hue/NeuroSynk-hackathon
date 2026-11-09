# PLAN DE ARQUITECTURA E IMPLEMENTACIÓN RIGUROSA — NEUROSYNK V4 (PRODUCCIÓN GITHUB / CLOUDFLARE)

> **REGLA DE INMUTABILIDAD Y FLUJO DE TRABAJO (PROTOCOLO ESTRICTO):**
> 1. **Documento Congelado tras Creación:** Este archivo (`PLAN_ARQUITECTURA_NEUROSYNK_V4.md`) constituye el contrato técnico de implementación dividido en **10 Pasos** (con sus respectivos sub-pasos). Una vez creado, **NO será modificado** a menos que sea estrictamente necesario; cualquier cambio requerirá plantear primero la propuesta en el chat y obtener autorización explícita del usuario.
> 2. **Ejecución Secuencial por Compuertas ("Luz Verde"):** No se modificará código de producción hasta que el usuario valide este plan. Una vez autorizado un paso (o sub-paso), se implementará, se verificará (`npm run lint` + `npm run build`) y se pasará al siguiente de forma consecutiva tras la validación del usuario.

---

## DIAGNÓSTICO ARQUITECTÓNICO PREVIO (CÓDIGO ACTUAL VERIFICADO)

Archivos auditados en el árbol real de producción (`c:\Users\bljos\neurosynk`):
- [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx) (2,947 líneas — Máquina de estados global, loop MediaPipe 140ms + TensorFlow.js 12-D WebGL).
- [`src/components/home/GeminiHeroInput.tsx`](file:///c:/Users/bljos/neurosynk/src/components/home/GeminiHeroInput.tsx) (321 líneas — Primera pantalla del Chatbot y selector de modos).
- [`src/components/navigation/CollapsibleSidebar.tsx`](file:///c:/Users/bljos/neurosynk/src/components/navigation/CollapsibleSidebar.tsx) (349 líneas — Historial de sesiones y barra lateral).
- [`src/services/metaModelClient.ts`](file:///c:/Users/bljos/neurosynk/src/services/metaModelClient.ts) (426 líneas — Cliente híbrido `/api/*` -> Direct HTTPS Google Gemini Cascade `3.5-flash` -> `2.5-flash` -> `2.0-flash`).
- [`src/services/audioService.ts`](file:///c:/Users/bljos/neurosynk/src/services/audioService.ts) (121 líneas — TTS `window.speechSynthesis` y earcons Web Audio API).
- [`src/worker.ts`](file:///c:/Users/bljos/neurosynk/src/worker.ts) y [`server.ts`](file:///c:/Users/bljos/neurosynk/server.ts) (Backend Edge en Cloudflare Workers y servidor Express local).

### Cuellos de Botella y Conflictos Detectados a Prevenir:
1. **Contención del Hilo Principal (Main Thread):** [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx#L1235-L1569) ejecuta inferencia biométrica cada `140ms`. Si el estado del chat, el transcript de voz en vivo o el contador `0%-100%` del lote de 50 ideas viven dentro de `App.tsx`, cada actualización re-renderizará 2,947 líneas causando caída de FPS. **Solución:** Encapsular el Chat Contextual, el Panel **Studio** (estilo Google NotebookLM) y el Centro de Configuraciones en componentes hijos aislados y cargados con `React.lazy` + `<Suspense>`.
2. **Colisión de Teclado Global (`Key 'q'`):** En [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx#L579), el listener global intercepta la tecla `'q'` sin verificar si el foco está en un `<input>` o `<textarea>`. **Solución:** Blindar el listener ignorando elementos editables.
3. **Eco Acústico TTS <-> STT:** `audioService.ts` emite voz sintetizada que sería capturada por el micrófono abierto durante el desahogo por voz. **Solución:** Implementar un Mutex bidireccional que cancele el TTS al activar el micrófono y pause el STT si el bot habla.
4. **Lote Completo de 50 Ideas (~8-10s de latencia en LLM):** Solicitar 50 ideas estructuradas en una sola llamada o en ráfaga paralela puede dar sensación de bloqueo si no hay feedback visual continuo. **Solución:** Orquestar la generación del lote de 50 ideas con un motor de progreso cuantitativo en tiempo real (`0%` -> `100%`) que muestre el porcentaje exacto, la fase activa y barra de progreso animada a 60 FPS antes de abrir el resultado en el panel **Studio**.

---

## LOS 10 PASOS DE IMPLEMENTACIÓN

---

### PASO 1: Sistema Bilingüe Completo (`ES` / `EN`) y Análisis/Implementación del Apartado de Configuraciones (`SettingsModal`)

**Objetivo Técnico:** Dotar a NeuroSynk de soporte bilingüe integral (Español / Inglés) en interfaz, prompts de IA, reconocimiento de voz (STT) y síntesis de voz (TTS), gobernado desde un nuevo **Apartado de Configuraciones** accesible tanto desde la primera pantalla ([`GeminiHeroInput.tsx`](file:///c:/Users/bljos/neurosynk/src/components/home/GeminiHeroInput.tsx)) como desde el [`CollapsibleSidebar.tsx`](file:///c:/Users/bljos/neurosynk/src/components/navigation/CollapsibleSidebar.tsx) y la barra superior.

#### Análisis de Arquitectura del Apartado de Configuraciones:
Actualmente NeuroSynk solo tiene un modal simple para pegar la API Key (`showApiKeyModal` en [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx#L510)). Se reemplazará/expandirá por un **Centro de Configuraciones Modular** dividido en 4 secciones claras:
1. **Idioma y Región (Language & Locale):** Selector instantáneo **Español (`es`) / English (`en`)** que actualiza textos de UI, idioma de los prompts enviados a Gemini (`es` vs `en`), idioma del micrófono STT (`es-MX`/`es-ES` vs `en-US`) y voz TTS.
2. **Motor de IA y Credenciales (Gemini Cascade):** Configuración de `GEMINI_API_KEY`, visualización de la cascada activa (`gemini-3.5-flash` -> `gemini-2.5-flash` -> `gemini-2.0-flash`) y botón de prueba de latencia en vivo.
3. **Voz, Audio y Entrada Multimodal:** Activación/desactivación de voz de FocusBud (TTS), volumen de alertas binaurales y modo de micrófono para desahogo (continuo vs. push-to-talk).
4. **Calibración Biométrica y Productividad:** Perfil de trabajo por defecto (`general`, `coding`, `reading`, `writing`), sensibilidad de fatiga ocular (PERCLOS) y recalibración de postura base.

#### Sub-pasos del Paso 1:
- **Sub-paso 1.1:** Crear [`src/i18n/translations.ts`](file:///c:/Users/bljos/neurosynk/src/i18n/translations.ts) y [`src/context/SettingsContext.tsx`](file:///c:/Users/bljos/neurosynk/src/context/SettingsContext.tsx) con persistencia en `localStorage` (`neurosynk_settings_v4`), exponiendo `language: 'es' | 'en'`, `t()` helper sin sobrecarga de librerías externas pesadas, y preferencias de audio/IA/biometría.
- **Sub-paso 1.2:** Crear [`src/components/settings/NeuroSynkSettingsModal.tsx`](file:///c:/Users/bljos/neurosynk/src/components/settings/NeuroSynkSettingsModal.tsx) con diseño dark glassmorphism, pestañas internas (*General & Idioma*, *IA & API Key*, *Voz & Audio*, *Biometría*) y selector bilingüe en vivo.
- **Sub-paso 1.3:** Conectar el botón de Configuraciones en [`GeminiHeroInput.tsx`](file:///c:/Users/bljos/neurosynk/src/components/home/GeminiHeroInput.tsx), [`CollapsibleSidebar.tsx`](file:///c:/Users/bljos/neurosynk/src/components/navigation/CollapsibleSidebar.tsx) y [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx), propagando el idioma activo a `audioService.ts` y `metaModelClient.ts`.

---

### PASO 2: Máquina de Estados de Contextualización Previa y Blindaje del Hilo Principal en `src/App.tsx`

**Objetivo Técnico:** Modificar el flujo de la primera pantalla para que **NO divida la tarea en micro-pasos de inmediato** al enviar el primer mensaje, sino que inicie una fase de **Contextualización Estratégica + Panel Studio**, manteniendo intacta la estética actual y aislando los re-renderizados del loop biométrico.

#### Sub-pasos del Paso 2:
- **Sub-paso 2.1:** En [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx#L579), blindar el listener `window.addEventListener('keydown', ...)` para ignorar eventos cuando `document.activeElement` sea `INPUT`, `TEXTAREA` o `isContentEditable`, evitando que la tecla `'q'` dispare diagnóstico al escribir.
- **Sub-paso 2.2:** Definir en un nuevo archivo de tipos [`src/types/studioTypes.ts`](file:///c:/Users/bljos/neurosynk/src/types/studioTypes.ts) la estructura de datos del flujo Pre-Foco:
  - `PreFocusStage`: `'IDLE' | 'CONTEXT_PROBING' | 'STUDIO_WORKSPACE' | 'SURVEY_CALIBRATION' | 'READY_TO_LAUNCH'`
  - `ExtractedContextState`: `{ whatGoal: string | null; howMethod: string | null; mainBlocker: string | null; completenessScore: number; rawVoiceDumps: string[]; chatHistory: ContextChatMessage[] }`
  - `StudioArtifactItem`: `{ id: string; type: 'BRIAN_TRACY_50' | 'MINDMAP_FLOW' | 'CALIBRATION_QUIZ' | 'MICRO_STEPS_TABLE' | 'AUDIO_BRIEF'; title: string; createdAt: number; status: 'generating' | 'ready' | 'error'; progressPct: number; data: any }`
- **Sub-paso 2.3:** Desacoplar el flujo de entrada de `handleStart` en [`src/App.tsx`](file:///c:/Users/bljos/neurosynk/src/App.tsx#L951) para que el envío inicial abra la sesión de contextualización y habilite el panel **Studio** sin bloquear ni re-renderizar el canvas de MediaPipe.

---

### PASO 3: Motor de Contextualización Quirúrgica (Respuestas Ultra-Cortas en `worker.ts`, `server.ts` y `metaModelClient.ts`)

**Objetivo Técnico:** Implementar el endpoint y cliente de IA para la fase de preguntas estratégicas previas a la división de tareas. El bot debe responder en **máximo 18 palabras por turno** (en Español o Inglés según la configuración activa), enfocándose quirúrgicamente en descubrir:
1. **QUÉ** quiere lograr exactamente (`whatGoal`).
2. **CÓMO** planea abordarlo o con qué herramientas (`howMethod`).
3. **CUÁL** es su bloqueo o fricción principal ahora mismo (`mainBlocker`).

#### Sub-pasos del Paso 3:
- **Sub-paso 3.1:** Agregar la ruta `POST /api/context-probe` en [`src/worker.ts`](file:///c:/Users/bljos/neurosynk/src/worker.ts) (Cloudflare Edge) y [`server.ts`](file:///c:/Users/bljos/neurosynk/server.ts) (Node/Express local) usando la cascada `gemini-3.5-flash` -> `gemini-2.5-flash` -> `gemini-2.0-flash` con salida JSON estructurada (`reply`, `extracted: { whatGoal, howMethod, mainBlocker, isComplete }`, `suggestedKeyboardChips`).
- **Sub-paso 3.2:** Implementar `probeTaskContext()` en [`src/services/metaModelClient.ts`](file:///c:/Users/bljos/neurosynk/src/services/metaModelClient.ts) con soporte bilingüe (`es`/`en`), timeout con `AbortSignal` de 10s y fallback automático a llamada directa HTTPS a Google Gemini si el proxy no responde.

---

### PASO 4: Pipeline de Voz (STT) para Desahogo Continuo y Mutex Acústico (`speechRecognitionService.ts`)

**Objetivo Técnico:** Construir el motor de captura de voz fluida para que el usuario pueda hablar libremente y "vaciar la mente" sin que las pausas respiratorias corten la grabación ni la voz del bot se filtre al micrófono.

#### Sub-pasos del Paso 4:
- **Sub-paso 4.1:** Crear [`src/services/speechRecognitionService.ts`](file:///c:/Users/bljos/neurosynk/src/services/speechRecognitionService.ts) encapsulando `SpeechRecognition` / `webkitSpeechRecognition` con:
  - `continuous = true` e `interimResults = true`.
  - Auto-reconexión transparente en `onend` mientras el usuario mantenga activo el modo "Desahogo por Voz".
  - Sincronización automática de idioma (`es-MX` / `es-ES` cuando el idioma es Español; `en-US` cuando es Inglés).
- **Sub-paso 4.2:** Integrar un Mutex Acústico entre [`src/services/audioService.ts`](file:///c:/Users/bljos/neurosynk/src/services/audioService.ts) y `speechRecognitionService.ts`: al iniciar captura de micrófono se invoca `audioService.stopSpeaking()`, y mientras el micrófono esté grabando se silencian locuciones automáticas de TTS.
- **Sub-paso 4.3:** Detección limpia de soporte del navegador (Chrome/Edge vs Firefox/Safari sin Web Speech API) mostrando aviso no intrusivo en caso de falta de soporte o permiso denegado.

---

### PASO 5: Input Multimodal Asimétrico en Primera Pantalla (Voz para Desahogo / Teclado para Estructura)

**Objetivo Técnico:** Evolucionar [`src/components/home/GeminiHeroInput.tsx`](file:///c:/Users/bljos/neurosynk/src/components/home/GeminiHeroInput.tsx) conservando su estética oscura minimalista tipo Gemini, pero integrando la **asimetría funcional entre Voz y Teclado** junto con el hilo de contextualización ultra-corto.

#### Sub-pasos del Paso 5:
- **Sub-paso 5.1:** Implementar el **Modo Desahogo por Voz (Voice Brain-Dump)** en `GeminiHeroInput.tsx`:
  - Botón de micrófono con onda reactiva CSS (`transform: scaleY()`, 60 FPS sin re-renderizar React).
  - Separación de buffer: el texto interino (`interimTranscript`) fluye en vivo en una cápsula visual ligera, y solo al pausar o confirmar pasa al estado final o se envía con etiqueta `[VOICE_BRAIN_DUMP]` para que la IA destile el caos verbal en `QUÉ`, `CÓMO` y `BLOQUEO`.
- **Sub-paso 5.2:** Implementar el **Modo Estructura por Teclado (Keyboard Precision Mode)** en `GeminiHeroInput.tsx`:
  - Cuando el bot solicita una definición técnica, parámetro concreto, restricción de tiempo o confirmación de meta, activa chips rápidos y foco directo en el teclado con placeholders estructurados (ej. *"Define con teclado el entregable exacto..."* / *"Type the exact deliverable..."*) y atajos (`Enter` para confirmar, `Tab` para alternar campo `QUÉ` / `CÓMO` / `BLOQUEO`).
- **Sub-paso 5.3:** Renderizar sobre el input la barra compacta de **Estado de Contexto (3 Píldoras en Vivo)**:
  - `[🎯 QUÉ / GOAL]` · `[⚙️ CÓMO / METHOD]` · `[🚧 BLOQUEO / BLOCKER]`
  - Cada píldora pasa de gris a esmeralda conforme el usuario responde por voz o teclado, permitiendo editar cualquiera de las 3 con un clic y teclado en cualquier momento.

---

### PASO 6: Panel "Studio" Estilo Google NotebookLM Integrado en la Primera Pantalla

**Objetivo Técnico:** Implementar el panel **Studio** inspirado directamente en la interfaz de Google NotebookLM (como en la imagen de referencia proporcionada por el usuario), adaptado a la estética dark/emerald de NeuroSynk y completamente bilingüe (`ES`/`EN`).

#### Diseño y Estructura del Panel "Studio" (`src/components/studio/NeuroSynkStudioPanel.tsx`):
1. **Cabecera del Panel Studio:** Título `Studio`, indicador de contexto conectado y botón de colapsar/expandir panel (`[|]`), permitiendo vista dividida (Chat de Contextualización a la izquierda + Panel Studio a la derecha en desktop, o cajón deslizable en pantallas pequeñas).
2. **Banner Superior de Acción Rápida:** Banner estilizado (análogo al banner superior de NotebookLM) indicando el estado de preparación cognitiva y botón rápido para ejecutar el flujo recomendado.
3. **Cuadrícula de Píldoras de Herramientas (2 Columnas con Iconos de Color):**
   - 🧠 **50 Ideas Brian Tracy** *(Icono violeta/cian + badge `¡Nuevo!` / `New!`)* — Genera las 50 formas de abordar la meta.
   - AccountTree / 🕸️ **Mapa mental / Diagrama** *(Icono púrpura)* — Genera el diagrama interactivo de flujo y arquitectura de la tarea.
   - ❓ **Cuestionario** *(Icono turquesa)* — Abre el cuestionario táctico de calibración de la tarea.
   - 📊 **Tabla de datos / Matriz** *(Icono azul)* — Vista tabular comparativa de impacto vs. esfuerzo de las acciones.
   - 🎧 **Resumen en audio** *(Icono índigo)* — Síntesis hablada (TTS) de 30 segundos con la estrategia de ataque.
   - ⚡ **Tarjetas de Micro-pasos** *(Icono naranja/esmeralda)* — Desglose final ejecutable para lanzar el modo de enfoque biométrico.
4. **Bandeja Inferior "Los resultados de Studio se guardarán aquí" / "Studio results will be saved here":**
   - Cuando aún no se ha generado ningún artefacto, muestra el icono de varita mágica (`Sparkles`) con el texto guía bilingüe.
   - Al hacer clic en cualquiera de las píldoras superiores, aparece inmediatamente en esta bandeja inferior una **Tarjeta de Generación en Vivo** con su porcentaje de carga (`0%` -> `100%`) y, al completarse, queda guardada como un artefacto clicable que abre el visor interactivo correspondiente sin perder el chat.

#### Sub-pasos del Paso 6:
- **Sub-paso 6.1:** Crear [`src/components/studio/NeuroSynkStudioPanel.tsx`](file:///c:/Users/bljos/neurosynk/src/components/studio/NeuroSynkStudioPanel.tsx) con la cuadrícula de píldoras estilo NotebookLM, soporte colapsable y bandeja de resultados persistentes por sesión.
- **Sub-paso 6.2:** Integrar `NeuroSynkStudioPanel` junto a `GeminiHeroInput.tsx` en la primera pantalla para que el usuario pueda disparar cualquiera de las herramientas de Studio en cuanto tenga una semilla de tarea o tras completar las preguntas de contexto.

---

### PASO 7: Motor "Brian Tracy 50 Ideas" (Lote Completo de 50 + Cargador de Porcentaje `0%` a `100%`)

**Objetivo Técnico:** Generar el **lote completo de 50 ideas accionables** basadas en la Disciplina de las 20/50 Ideas de Brian Tracy (aunque tome ~8-10 segundos), mostrando durante toda la espera un **apartado visual de progreso con porcentaje en vivo (`0%` a `100%`)** en la bandeja del Panel Studio y en el visor activo.

#### Arquitectura para Generar 50 Ideas Reales sin Truncamiento ni Congelamiento:
Para garantizar que el modelo devuelva **exactamente 50 ideas de alta calidad** sin truncar el JSON por límite de tokens de salida y manteniendo una barra de progreso real y fluida:
- Se estructurará la generación en **2 ráfagas paralelas/secuenciales coordinadas (25 ideas + 25 ideas)** o streaming controlado con esquema compacto (`id: 1..50`, `text`, `category: 'quick_win' | 'pareto_20' | 'unblocker' | 'creative_leap'`, `effort: 1..5`, `impact: 1..5`).
- Mientras se ejecuta la generación (~8-10 segundos), un controlador de telemetría de progreso actualiza el porcentaje de `0%` a `100%`:
  - `0% - 15%`: Analizando meta (`QUÉ`), método (`CÓMO`) y bloqueo (`BLOQUEO`)...
  - `16% - 55%`: Generando Lote 1 (Ideas 1 a 25: Victorias Rápidas y Pareto 80/20)...
  - `56% - 92%`: Generando Lote 2 (Ideas 26 a 50: Desbloqueo Radical y Saltos Creativos)...
  - `93% - 100%`: Clasificando matriz de impacto y preparando interfaz interactiva...

#### Sub-pasos del Paso 7:
- **Sub-paso 7.1:** Agregar el endpoint `POST /api/studio/brian-tracy` en [`src/worker.ts`](file:///c:/Users/bljos/neurosynk/src/worker.ts) y [`server.ts`](file:///c:/Users/bljos/neurosynk/server.ts) optimizado para devolver las 50 ideas categorizadas en Español o Inglés.
- **Sub-paso 7.2:** Implementar `generateBrianTracy50Batch()` en [`src/services/metaModelClient.ts`](file:///c:/Users/bljos/neurosynk/src/services/metaModelClient.ts) con callback `onProgress(percentage: number, stageLabel: string)` para alimentar en tiempo real el indicador `0% -> 100%`.
- **Sub-paso 7.3:** Crear el componente visual de progreso [`src/components/studio/StudioProgressLoader.tsx`](file:///c:/Users/bljos/neurosynk/src/components/studio/StudioProgressLoader.tsx) que muestra el contador numérico gigante (`0%` ... `100%`), barra de progreso animada, fase actual bilingüe y tiempo estimado restante.

---

### PASO 8: Interfaz Interactiva Paginada y Filtrable "Brian Tracy 50 Matrix" + Iteración Asistida

**Objetivo Técnico:** Evitar la saturación visual al mostrar las 50 ideas mediante un visor interactivo paginado, filtrable por cuadrantes y con capacidad de **iterar en conjunto con la IA** sobre las ideas que el usuario seleccione.

#### Sub-pasos del Paso 8:
- **Sub-paso 8.1:** Crear [`src/components/studio/BrianTracyMatrixView.tsx`](file:///c:/Users/bljos/neurosynk/src/components/studio/BrianTracyMatrixView.tsx) con:
  - Filtros por los 4 cuadrantes de productividad (*Todas (50)*, *⚡ Quick Wins (<5 min)*, *🎯 Pareto 80/20 (Alto Impacto)*, *🔓 Rompe-Bloqueos*, *🚀 Inversión / Salto Creativo*) + buscador instantáneo.
  - Paginación limpia de **10 ideas por página** (Páginas 1 a 5) para mantener menos de 40 nodos DOM activos y 60 FPS constantes.
  - Casillas de selección en cada idea para agregarla a la **"Bandeja de Ejecución Seleccionada"** (ej. elegir las 3 a 5 mejores ideas de las 50).
- **Sub-paso 8.2:** Implementar la barra inferior de **Iteración Asistida con IA** dentro del visor: el usuario puede seleccionar 1 o varias ideas de las 50 y pulsar *"Profundizar / Combinar seleccionadas"* (o escribir con teclado un ajuste como *"adapta las ideas #4, #17 y #32 para hacerlo en 30 minutos sin presupuesto"*), refinando esas opciones en conjunto con Gemini.

---

### PASO 9: Motor de Diagramación Ligero (`Mapa Mental / Diagrama de Flujo`) y Artefactos Complementarios de Studio

**Objetivo Técnico:** Implementar la generación y visualización interactiva de diagramas (`Mapa mental` / `Diagrama de flujo` desde la píldora correspondiente del Panel Studio) sin librerías pesadas como `mermaid.js` (~1.5 MB) que bloquean el hilo principal.

#### Sub-pasos del Paso 9:
- **Sub-paso 9.1:** Agregar el endpoint `POST /api/studio/diagram` en [`src/worker.ts`](file:///c:/Users/bljos/neurosynk/src/worker.ts), [`server.ts`](file:///c:/Users/bljos/neurosynk/server.ts) y `generateTaskFlowDiagram()` en [`src/services/metaModelClient.ts`](file:///c:/Users/bljos/neurosynk/src/services/metaModelClient.ts), con soporte de progreso `0% -> 100%`, generando un grafo acíclico JSON (`nodes`, `edges`, `criticalPath`) a partir del contexto y de las ideas de Brian Tracy seleccionadas.
- **Sub-paso 9.2:** Crear [`src/components/studio/TaskFlowDiagramView.tsx`](file:///c:/Users/bljos/neurosynk/src/components/studio/TaskFlowDiagramView.tsx) (~4 KB, 100% nativo en React + SVG + `motion`) con nodos interactivos clicables (*Meta Raíz -> Sub-fases -> Desbloqueadores -> Entregable*), zoom/pan ligero y edición de nodos por teclado.
- **Sub-paso 9.3:** Conectar las píldoras complementarias del Panel Studio (*Cuestionario*, *Tabla de datos*, *Resumen en audio* y *Tarjetas de Micro-pasos*) para que todas guarden su resultado en la bandeja inferior de Studio con indicador `0% -> 100%`.

---

### PASO 10: Lazy Loading, Diagnóstico Resiliente de Producción y Conversión Final al Modo `FOCUS`

**Objetivo Técnico:** Garantizar que toda la nueva arquitectura corra sin fricción tanto en GitHub/Cloudflare Workers como en localhost, aplicando carga diferida (`React.lazy`), manejo de errores de red/CORS y conectando la salida del Panel Studio con el Dashboard Biométrico de Enfoque (`FOCUS`).

#### Sub-pasos del Paso 10:
- **Sub-paso 10.1:** Envolver `NeuroSynkStudioPanel`, `BrianTracyMatrixView`, `TaskFlowDiagramView` y `NeuroSynkSettingsModal` con `React.lazy()` y `<Suspense>` con skeletons ligeros (`animate-pulse`), de modo que el bundle inicial de la primera pantalla no aumente su tiempo de carga (First Contentful Paint).
- **Sub-paso 10.2:** Implementar un escudo de resiliencia en `metaModelClient.ts` para entornos remotos (Cloudflare / GitHub Pages): control de `AbortController`, reintento automático entre `gemini-3.5-flash` -> `gemini-2.5-flash` -> `gemini-2.0-flash`, y recuperación de estado desde `sessionStorage` si un request sufre un corte de red.
- **Sub-paso 10.3:** Conectar el botón **"Iniciar Sesión de Enfoque con Selección de Studio"** para transformar el contexto validado (`QUÉ`, `CÓMO`, `BLOQUEO`), las ideas de Brian Tracy elegidas y los nodos del diagrama en la lista final de micro-pasos (`TaskStep[]`) y transicionar a `appStage = 'FOCUS'` con el monitoreo biométrico en vivo.
- **Sub-paso 10.4:** Verificación integral de tipos (`npm run lint`), compilación de producción (`npm run build`) y validación de cero regresiones.

---

## RESUMEN DE REGLAS DE EJECUCIÓN ACORDADAS
1. Este archivo [`PLAN_ARQUITECTURA_NEUROSYNK_V4.md`](file:///c:/Users/bljos/neurosynk/PLAN_ARQUITECTURA_NEUROSYNK_V4.md) queda creado y **bloqueado contra modificaciones no autorizadas**.
2. A partir de tu validación ("luz verde"), comenzaré exclusivamente con el **Paso 1** (y sus sub-pasos `1.1`, `1.2`, `1.3`).
3. Al concluir cada paso, te presentaré el resultado verificado y esperaré tu autorización para avanzar al siguiente paso hasta completar el **Paso 10**.

