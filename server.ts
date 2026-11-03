import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
import express from "express";
import { createServer as createViteServer } from "vite";

const app = express();
app.use(express.json());
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// =========================================================================
// META MODEL API & BASETEN CLIENT CONFIGURATION
// =========================================================================
const META_API_KEY = (process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY || process.env.META_API_KEY || '').trim();
const META_API_URL = process.env.META_API_URL || "https://api.meta.ai/v1/responses";
const BASETEN_API_KEY = (process.env.BASETEN_API_KEY || '').trim();

interface MetaCallParams {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  apiKeyOverride?: string;
}

/**
 * Robust fetch wrapper with timeout and 1-2 retries for transient socket closes (e.g. idle Keep-Alive drops)
 */
async function fetchWithRetry(url: string, options: any, retries = 2, timeoutMs = 18000): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      const detail = err?.cause?.message || err?.cause || err?.message || err;
      if (attempt < retries) {
        console.warn(`[Network Retry] Attempt ${attempt + 1} to ${new URL(url).host} failed (${detail}). Re-trying on fresh socket...`);
        await new Promise(r => setTimeout(r, 350));
      }
    }
  }
  throw lastError;
}

/**
 * Universal caller prioritizing Meta Model API (Muse Spark / Wonder)
 * with graceful fallback to Baseten and Google Gemini.
 */
async function callMetaModel(params: MetaCallParams): Promise<string> {
  const model = params.model || "muse-wonder-1.0";
  const messages: any[] = [];
  if (params.systemPrompt) {
    messages.push({ role: "system", content: params.systemPrompt });
  }
  messages.push({ role: "user", content: params.userPrompt });

  // 1. Try Meta Model API (Official dev.meta.ai responses endpoint)
  if (META_API_KEY) {
    try {
      const response = await fetchWithRetry(META_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({
          model,
          input: messages,
          stream: true,
          temperature: params.temperature ?? 0.7,
          max_output_tokens: params.maxTokens ?? 2048,
          top_p: 1,
          reasoning: { effort: params.reasoningEffort || "medium" }
        })
      });

      if (response.ok && response.body) {
        let fullText = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataContent = trimmed.substring(6).trim();
              if (dataContent === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataContent);
                const delta = parsed.delta?.text || parsed.choices?.[0]?.delta?.content || parsed.text || "";
                fullText += delta;
              } catch {
                fullText += dataContent;
              }
            }
          }
        }
        if (fullText.trim().length > 0) {
          return fullText.trim();
        }
      }
    } catch (metaErr: any) {
      console.warn(`[Meta Model API] Call failed (${metaErr?.cause?.message || metaErr?.message || metaErr}), trying Baseten fallback...`);
    }
  }

  // 2. Try Baseten fallback (Muse Spark Open)
  if (BASETEN_API_KEY) {
    try {
      const basetenUrl = process.env.BASETEN_ENDPOINT_URL || "https://inference.baseten.co/v1/chat/completions";
      // Meta Muse Spark Open uses 500-900 internal reasoning_tokens + output tokens,
      // so tokenBudget MUST be >= 2048 so JSON responses are never truncated.
      const tokenBudget = Math.max(params.maxTokens ?? 2048, 2048);
      const basetenRes = await fetchWithRetry(basetenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BASETEN_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-models/muse-spark-open-1026",
          messages,
          reasoning_effort: params.reasoningEffort || "minimal",
          temperature: params.temperature ?? 0.7,
          max_tokens: tokenBudget
        })
      });

      if (basetenRes.ok) {
        const data = await basetenRes.json();
        const choice = data.choices?.[0];
        let text = (choice?.message?.content || "").trim();

        // 1. Eliminar etiquetas de razonamiento interno de deepseek/meta si existen
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 2. Si NO es JSON y contiene restos del monólogo interno en inglés del modelo, limpiarlo
        const looksLikeJson = /\{[\s\S]*\}|\[[\s\S]*\]/.test(text);
        if (!looksLikeJson && /Starts with|Need to consider|We should|Potential nuance|Count:|Let's evaluate/i.test(text)) {
          const quoteMatch = text.match(/"([^"]{10,140})"/);
          if (quoteMatch) {
            text = quoteMatch[1].trim();
          } else {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const cleanLines = lines.filter(l => !/Starts with|Need to consider|We should|Potential nuance|Count:|Let's evaluate/i.test(l));
            text = cleanLines.length > 0 ? cleanLines[cleanLines.length - 1] : "";
          }
        }

        if (text.length > 0) {
          return text;
        }
      } else {
        const errBody = await basetenRes.text();
        console.warn(`[Baseten Fallback] Status ${basetenRes.status}: ${errBody}`);
      }
    } catch (basetenErr: any) {
      console.warn(`[Baseten Fallback] Call failed:`, basetenErr?.cause?.message || basetenErr?.message || basetenErr);
    }
  }

  throw new Error("No upstream Meta/Baseten AI provider available");

}

// =========================================================================
// APPLICATION ENDPOINTS
// =========================================================================

app.post("/api/task-survey", async (req, res) => {
  const { task, apiKey } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  const fallbackSurvey = {
    questions: [
      {
        id: "q1",
        question: "¿Cuánto tiempo dedicarás a esta sesión?",
        options: [
          "25 a 30 minutos (Sprint corto)",
          "45 a 60 minutos (Sesión estándar)",
          "90 a 120 minutos (Sesión profunda)"
        ]
      },
      {
        id: "q2",
        question: "¿Qué avance tangible buscas lograr al concluir este tiempo?",
        options: [
          "Comprender la idea central",
          "Resolver un ejercicio o sección",
          "Completar una entrega formal"
        ]
      },
      {
        id: "q3",
        question: "¿Cuál es tu nivel de familiaridad o preparación con los materiales?",
        options: [
          "Parto desde cero absoluto",
          "Tengo bases y notas listas",
          "Domino el tema, voy a producir"
        ]
      },
      {
        id: "q4",
        question: "¿Cómo describirías tu nivel de energía y foco en este momento?",
        options: [
          "Alta energía y foco despejado",
          "Energía media / neutra",
          "Mente dispersa o fatiga inicial"
        ]
      },
      {
        id: "q5",
        question: "¿En qué momento sueles experimentar mayor fricción o bloqueo?",
        options: [
          "Al romper la inercia del inicio",
          "A la mitad con la densidad técnica",
          "Al cerrar y pulir detalles finales"
        ]
      }
    ]
  };

  try {
    const prompt_sistema = `Eres el Diagnosticador Cognitivo y de Tareas de NeuroSynk alimentado por Meta Muse.
Tu misión es diseñar una encuesta de calibración rápida de EXACTAMENTE 5 preguntas breves a partir de la meta introducida por el usuario.
Responde estrictamente con un JSON con la clave "questions": array de objetos con "id", "question", "options".`;

    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Meta del usuario: "${task}"`,
      maxTokens: 480,
      reasoningEffort: "minimal",
      apiKeyOverride: headerKey
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.questions && Array.isArray(data.questions)) {
        const sanitized = data.questions.map((q: any, i: number) => ({
          id: q.id || `q${i + 1}`,
          question: String(q.question || "Pregunta de calibración"),
          options: Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map(String)
            : ["Opción A", "Opción B", "Opción C"]
        }));
        res.json({ questions: sanitized });
        return;
      }
    }
  } catch (error: any) {
    console.warn("[Task Survey] Using adaptive fallback:", error?.cause?.message || error?.message || error);
  }

  res.json(fallbackSurvey);
});

app.post("/api/split-task", async (req, res) => {
  const { task, surveyAnswers, context, apiKey } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  const getFallbackSteps = (targetTask: string, answers: any): string[] => {
    const timeAns = String(answers?.q1 || '').toLowerCase();
    const isShort = timeAns.includes('25') || timeAns.includes('30') || timeAns.includes('sprint');
    const isLong = timeAns.includes('90') || timeAns.includes('120') || timeAns.includes('profunda');

    if (isShort) {
      return [
        `DELIMITA una porción atómica y concreta de '${targetTask}' para abordar en este sprint corto.`,
        `ABRE tu espacio de trabajo manteniendo a la vista únicamente el material indispensable.`,
        `EJECUTA el desarrollo directo del primer núcleo temático sin desviar la atención.`,
        `SINTETIZA el resultado alcanzado y registra la conclusión de tu bloque.`
      ];
    }

    if (isLong) {
      return [
        `DELIMITA los tres núcleos principales de trabajo que estructurarán tu sesión sobre '${targetTask}'.`,
        `ORGANIZA los materiales y notas para el primer bloque de avance conceptual.`,
        `DESARROLLA los fundamentos y primeros ejercicios del tema central con concentración plena.`,
        `PAUSA SOMÁTICA: Despeja la vista de la pantalla, bebe agua y estira los brazos por 4 minutos.`,
        `PROFUNDIZA en la aplicación práctica y resolución de problemas del segundo bloque.`,
        `SINTETIZA los argumentos o fórmulas clave generados durante la práctica profunda.`,
        `PAUSA SOMÁTICA: Levántate del asiento, respira profundo y camina unos pasos por 5 minutos.`,
        `CONSOLIDA el tercer bloque resolviendo dudas residuales o puliendo detalles técnicos.`,
        `VERIFICA el dominio operativo completo contrastando tu producción contra el objetivo inicial.`
      ];
    }

    return [
      `DELIMITA el objetivo específico y materiales necesarios para este bloque de '${targetTask}'.`,
      `ANALIZA el primer núcleo conceptual identificando definiciones clave y sus relaciones.`,
      `DESARROLLA la primera sección o ejercicio aplicando los métodos centrales del tema.`,
      `PAUSA SOMÁTICA: Despeja la vista de la pantalla, bebe agua y estira los brazos por 3 minutos.`,
      `EJECUTA la segunda fase de práctica o redacción consolidando los conceptos trabajados.`,
      `VERIFICA los resultados obtenidos y formula un resumen de validación final.`
    ];
  };

  try {
    const prompt_sistema = `Eres el Arquitecto de Planificación y Enfoque de NeuroSynk impulsado por Meta Muse Wonder.
Tu misión es diseñar una sesión de trabajo realista basada en las respuestas de la encuesta del usuario.
Cada paso debe iniciar con un VERBO DE ACCIÓN EN MAYÚSCULAS. Cero formato Markdown.
Responde estrictamente con un JSON con la clave "steps": array de strings.`;

    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `OBJETIVO: "${task}"\nRESPUESTAS: ${JSON.stringify(surveyAnswers || {})}\nCONTEXTO: "${context || 'General'}"`,
      reasoningEffort: "minimal",
      maxTokens: 450,
      apiKeyOverride: headerKey
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        const cleanSteps = data.steps.map((s: string) => s.replace(/\*/g, '').trim());
        res.json({ steps: cleanSteps });
        return;
      }
    }
  } catch (err: any) {
    console.warn("[Split Task] Using deterministic fallback:", err?.cause?.message || err?.message || err);
  }

  res.json({ steps: getFallbackSteps(task, surveyAnswers) });
});

/**
 * Endpoint de Celebración Dinámica con IA por cada micro-paso completado.
 * FocusBud vocaliza una frase humana que reconoce ESPECÍFICAMENTE la actividad dominada.
 */
app.post("/api/step-celebration", async (req, res) => {
  const { completedStep, nextStep, taskContext, apiKey } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;
  if (!completedStep) {
    res.status(400).json({ error: "completedStep is required" });
    return;
  }

  const getDynamicFallback = (step: string): string => {
    const clean = step.replace(/^(\d+\.?\s*|[-•*]\s*)/, '').trim();
    const match = clean.match(/^([A-ZÁÉÍÓÚÑ]{3,})\s+(.*)/i);
    if (match) {
      const verb = match[1].toLowerCase();
      const rest = match[2].slice(0, 42).replace(/[.,;:].*$/, '').trim();
      return `¡Gran trabajo al ${verb} ${rest}! Mantén ese impulso.`;
    }
    return `¡Paso superado con éxito! Seguimos con el siguiente objetivo.`;
  };

  try {
    const prompt_sistema = `Eres FocusBud, el avatar de NeuroSynk empático, humano y enérgico impulsado por Meta Muse Spark.
Tu usuario acaba de completar un micro-paso de su sesión de enfoque.
Formula una sola frase natural, breve, cálida y motivadora (MÁXIMO 14 PALABRAS) que reconozca ESPECÍFICAMENTE la actividad concreta que acaba de dominar para que sienta que lo estás acompañando de verdad en tiempo real.
Habla en español directo, entusiasta y humano. Cero formato markdown y sin comillas.`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Actividad completada: "${completedStep}"\nSiguiente paso: "${nextStep || 'siguiente'}"\nMeta general: "${taskContext || ''}"`,
      maxTokens: 120,
      reasoningEffort: "minimal",
      temperature: 0.75,
      apiKeyOverride: headerKey
    });

    let cleanText = text.replace(/["*]/g, '').trim();
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
    cleanText = lines[lines.length - 1] || cleanText;

    if (cleanText.length > 5) {
      res.json({ phrase: cleanText });
      return;
    }
  } catch (err: any) {
    console.warn("[Step Celebration] Using dynamic fallback:", err?.cause?.message || err?.message || err);
  }

  res.json({ phrase: getDynamicFallback(completedStep) });
});

app.post("/api/subdivide-step", async (req, res) => {
  const { parentStep, taskContext, apiKey } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;
  if (!parentStep) {
    res.status(400).json({ error: "parentStep is required" });
    return;
  }

  const fallbackSubSteps = [
    "TOMA tu pluma o sitúa el cursor directamente en tu espacio de trabajo.",
    "LOCALIZA únicamente la primera línea o concepto introductorio.",
    "ESCRIBE la primera palabra clave para romper la inercia."
  ];

  try {
    const prompt_sistema = `Eres el Rescatista Ejecutivo de NeuroSynk con Meta Muse Spark.
Fragmenta el paso bloqueado en exactamente 3 NANO-PASOS atómicos de menos de 60 segundos cada uno.
Cada nano-paso debe iniciar con un VERBO DE ACCIÓN EN MAYÚSCULAS.
Responde estrictamente con un JSON con la clave "subSteps": array de 3 strings.`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Paso bloqueado: "${parentStep}"\nContexto: "${taskContext || 'General'}"`,
      apiKeyOverride: headerKey
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data.subSteps) && data.subSteps.length > 0) {
        res.json({ subSteps: data.subSteps.map((s: string) => s.replace(/\*/g, '').trim()) });
        return;
      }
    }
  } catch (err: any) {
    console.warn("[Subdivide Step] Using fallback:", err?.cause?.message || err?.message || err);
  }

  res.json({ subSteps: fallbackSubSteps });
});

app.post("/api/chat", async (req, res) => {
  const { message, messages, currentStep, taskContext, telemetry, apiKey } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;
  const userText = message || (Array.isArray(messages) && messages.length > 0 
    ? (messages[messages.length - 1].content || messages[messages.length - 1].text || '') 
    : '');

  if (!userText || typeof userText !== 'string') {
    res.status(400).json({ error: "Mensaje requerido" });
    return;
  }

  try {
    let prompt_sistema = `Eres el Mentor de Co-presencia de NeuroSynk impulsado por Meta Muse Spark.
Tu misión es mantener al usuario en acción resolviendo dudas en menos de 28 palabras.
Inicia SIEMPRE con un VERBO DE ACCIÓN EN MAYÚSCULAS. Cero Markdown. Tono de co-presencia ("estamos / vamos").`;

    // Adaptación del tono y carga cognitiva según telemetría biométrica local anónima
    if (telemetry && typeof telemetry === 'object') {
      const state = String(telemetry.cognitiveState || '').toUpperCase();
      const focus = Number(telemetry.focusScore ?? 100);
      const stress = Number(telemetry.stressLevel ?? 0);

      if (state.includes('FATIGA') || focus < 35) {
        prompt_sistema += `\n[ESTADO DETECTADO: FATIGA COGNITIVA (Foco ${focus}%)]. El usuario está cansado. Responde con extrema calma y suavidad, usando baja carga cognitiva. Sugiere una micro-acción de 30 segundos o un respiro si procede.`;
      } else if (state.includes('AGOBIO') || stress > 70) {
        prompt_sistema += `\n[ESTADO DETECTADO: SOBRECARGA / AGOBIO (Tensión ${stress}%)]. Sé un ancla somática calmante. Pide dar únicamente un micro-paso atómico a la vez sin abrumar.`;
      } else if (state.includes('FLOW') || focus > 80) {
        prompt_sistema += `\n[ESTADO DETECTADO: ESTADO DE FLOW PROFUNDO]. Responde en MENOS DE 12 PALABRAS directas para proteger su concentración sin interrumpir el ritmo.`;
      } else if (state.includes('DISTRA') || focus < 50) {
        prompt_sistema += `\n[ESTADO DETECTADO: DISPERSIÓN]. Orienta suavemente la atención de regreso al paso activo.`;
      }
    }

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Paso activo: "${currentStep || 'Trabajo'}"\nContexto: "${taskContext || 'General'}"\nMensaje: "${userText}"`,
      reasoningEffort: "minimal",
      maxTokens: 160,
      apiKeyOverride: headerKey
    });

    const cleanReply = text.replace(/[*_#]/g, '').trim();
    res.json({ reply: cleanReply || "AVANZA con el primer detalle del paso. Estamos contigo." });
  } catch (err: any) {
    console.warn("[Chat] Using adaptive reply:", err?.cause?.message || err?.message || err);
    res.json({ reply: "DIVIDE el paso en su mínima expresión. Escribe la primera palabra para arrancar." });
  }
});

/**
 * Endpoint de Debriefing Cognitivo Post-Sesión
 * Genera un resumen ejecutivo de acompañamiento y descanso con Meta Muse Spark / Baseten
 */
app.post("/api/session-debrief", async (req, res) => {
  const {
    task = "Sesión de Enfoque",
    totalMinutes = 0,
    completedStepsCount = 0,
    totalStepsCount = 0,
    averageFocus = 80,
    flowPercentage = 0,
    fatigueEventsCount = 0,
    apiKey
  } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;

  const fallbackSummary = `SESIÓN CONCLUIDA: Has completado ${completedStepsCount} de ${totalStepsCount} pasos en "${task}". Tu promedio de enfoque se mantuvo en ${averageFocus}%. Excelente persistencia. Toma 5 minutos para estirarte y descansar la vista antes de tu siguiente bloque.`;

  try {
    const prompt_sistema = `Eres el Mentor de Co-presencia y Recuperación Cognitiva de NeuroSynk impulsado por Meta Muse Spark.
Analiza las estadísticas anónimas de la sesión completada y redacta un reporte de cierre conciso (máximo 60 palabras).
Estructura en 3 puntos breves:
1. BALANCE: evaluación del ritmo y enfoque.
2. LOGRO: reconocimiento por los pasos concluidos.
3. RECUPERACIÓN: recomendación somática específica para descansar.
Inicia con una frase energizante en MAYÚSCULAS. Cero formato Markdown agresivo.`;

    const userPrompt = `Tarea: "${task}"
Duración total: ${totalMinutes} minutos
Pasos concluidos: ${completedStepsCount} de ${totalStepsCount}
Promedio de enfoque: ${averageFocus}%
Tiempo en Flow: ${flowPercentage}%
Picos de fatiga gestionados: ${fatigueEventsCount}`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt,
      reasoningEffort: "minimal",
      maxTokens: 220,
      apiKeyOverride: headerKey
    });

    const clean = text.replace(/[*_#]/g, '').trim();
    res.json({ debrief: clean || fallbackSummary });
  } catch (err: any) {
    console.warn("[Session Debrief] Using fallback:", err?.cause?.message || err?.message || err);
    res.json({ debrief: fallbackSummary });
  }
});

app.get("/api/api-status", (_req, res) => {
  res.json({
    hasMetaKey: !!META_API_KEY,
    hasBasetenKey: !!BASETEN_API_KEY,
    hasGeminiKey: false,
    activeProvider: META_API_KEY ? "meta-model-api" : (BASETEN_API_KEY ? "baseten" : "offline-adaptive")
  });
});

// =========================================================================
// META GLOBAL AI HACKATHON CORE ENDPOINTS (MUSE SPARK, WONDER, SAM 3.1)
// =========================================================================

/**
 * 1. Muse Spark - Streaming SSE de Intervención Rápida en Co-presencia
 */
app.post("/api/meta/muse-spark/stream", async (req, res) => {
  const { perclos = 0, fatigueScore = 0, postureScore = 0, currentTask = 'Estudio', cognitiveClass = 'NEUTRO' } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const prompt = `Usuario en sesión de trabajo. Estado biométrico: PERCLOS=${perclos}%, Fatiga=${fatigueScore}/100, Postura=${postureScore}/100, Estado=${cognitiveClass}. Tarea: "${currentTask}".
Instrucción ESTRICTA: Genera ÚNICAMENTE UNA sola micro-instrucción en español de MÁXIMO 12 PALABRAS que inicie con un VERBO DE ACCIÓN EN MAYÚSCULAS. Cero explicaciones, cero inglés, cero razonamiento.`;

  try {
    const text = await callMetaModel({
      model: "muse-spark-1.0",
      userPrompt: prompt,
      temperature: 0.4,
      maxTokens: 120
    });

    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#"`]/g, '').trim();

    // Extraer comillas si las hay
    const quoteMatch = cleanText.match(/"([^"]{10,120})"/);
    if (quoteMatch) {
      cleanText = quoteMatch[1].trim();
    }

    // Si tiene más de 16 palabras o restos de inglés, usar fallback clínico adaptativo
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 16 || /Starts with|Need to consider|We should|Count:|PERCLOS|User prompt/i.test(cleanText) || !cleanText) {
      if (perclos > 20 || fatigueScore > 50) {
        cleanText = "DESCANSA tu mirada 5 segundos fuera de la pantalla y respira hondo.";
      } else if (postureScore > 40) {
        cleanText = "AJUSTA tu espalda y relaja los hombros para despejar la mente.";
      } else if (String(cognitiveClass).includes('AGOBIO') || String(cognitiveClass).includes('SOBRE')) {
        cleanText = "PAUSA un instante. Da un solo clic sin prisa; estamos contigo.";
      } else if (String(cognitiveClass).includes('FLOW')) {
        cleanText = "MANTÉN este ritmo. Tu foco está en su punto más alto.";
      } else {
        cleanText = "ENFOCA el primer detalle del paso activo. Vamos a buen ritmo.";
      }
    }

    const words = cleanText.split(" ");
    for (const w of words) {
      res.write(`${w} `);
      await new Promise(r => setTimeout(r, 35));
    }
    res.end();
  } catch (err) {
    let fallback = "ENFOCA el primer detalle del paso. Estamos juntos en este sprint.";
    if (perclos > 25 || fatigueScore > 50) {
      fallback = "DESCANSA tu mirada 20 segundos fuera de la pantalla. Cuidamos tu ritmo cognitivo.";
    } else if (postureScore > 40) {
      fallback = "AJUSTA tu espalda y relaja los hombros. La postura despeja la mente.";
    }
    const words = fallback.split(" ");
    for (const w of words) {
      res.write(`${w} `);
      await new Promise(r => setTimeout(r, 30));
    }
    res.end();
  }
});

/**
 * 2. Muse Wonder - Descomposición Cognitiva de Tareas en 3 Nano-Pasos
 */
app.post("/api/meta/muse-wonder/decompose", async (req, res) => {
  const { task = 'Trabajo', perclos = 0, stressLevel = 0 } = req.body;

  const fallback = {
    nanoSteps: [
      `DELIMITA el primer término o punto atómico de "${task}".`,
      "ESCRIBE una sola frase o abre el primer archivo de trabajo.",
      "CONTINÚA sin juzgar la perfección; registraremos tu avance paso a paso."
    ],
    estimatedSecondsPerStep: perclos > 25 ? 60 : 45
  };

  try {
    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: "Eres Muse Wonder. Descompón la tarea en exactamente 3 nano-pasos ejecutables en menos de 60 segundos cada uno. Responde en JSON con la clave 'nanoSteps': array de strings.",
      userPrompt: `Tarea: "${task}", PERCLOS: ${perclos}%, Estrés: ${stressLevel}%`,
      reasoningEffort: "minimal",
      maxTokens: 280
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data.nanoSteps)) {
        res.json({ nanoSteps: data.nanoSteps, estimatedSecondsPerStep: fallback.estimatedSecondsPerStep });
        return;
      }
    }
  } catch (e) {
    console.warn("[Meta Muse Wonder] Using fallback:", e);
  }

  res.json(fallback);
});

/**
 * 3. SAM 3.1 - Calibración Ergonómica Determinista Local (Edge Privacy)
 * Los datos visuales NUNCA salen del equipo del usuario.
 */
app.post("/api/meta/sam/calibrate", (req, res) => {
  const body = req.body || {};
  const headTiltAngle = typeof body.rollAngle === "number" ? Math.round(body.rollAngle * 10) / 10 : 0;
  const shoulderRaw = typeof body.shoulderAngle === "number" ? body.shoulderAngle : 180;
  const shoulderDeviation = Math.min(45, Math.abs(180 - shoulderRaw));
  const shoulderAlignmentScore = Math.max(55, Math.min(100, Math.round(100 - shoulderDeviation * 1.2)));
  const stressLevel = typeof body.stressLevel === "number" ? body.stressLevel : 12;
  const clutterScore = Math.max(5, Math.min(60, Math.round(stressLevel * 0.4 + 8)));
  const distanceMetric = Math.abs(headTiltAngle) > 15 ? 'TOO_CLOSE' : 'OPTIMAL';

  const recommendations: string[] = [];
  if (Math.abs(headTiltAngle) > 8) {
    recommendations.push(`Endereza ligeramente la inclinaci?n cervical (${headTiltAngle}?) para liberar tensi?n.`);
  } else {
    recommendations.push('L?nea visual alineada con el tercio superior del monitor.');
  }
  if (shoulderAlignmentScore < 85) {
    recommendations.push('Nivela ambos hombros y apoya los antebrazos para sostener el estado de Flow.');
  } else {
    recommendations.push('Hombros nivelados y espacio ergon?mico listo para el sprint.');
  }

  res.json({
    provider: "local-edge-biomechanical",
    isCalibrated: shoulderAlignmentScore >= 75 && Math.abs(headTiltAngle) <= 15,
    distanceMetric,
    headTiltAngle,
    shoulderAlignmentScore,
    clutterScore,
    recommendations
  });
});

/**
 * 5. NeuroSynk Core AI Model Metadata Endpoint
 */
app.get("/api/model-info", async (req, res) => {
  try {
    const fs = await import("fs/promises");
    const metaPath = "./public/models/metadata.json";
    const data = await fs.readFile(metaPath, "utf-8");
    res.json(JSON.parse(data));
  } catch (err: any) {
    res.status(500).json({ error: "Could not read model metadata" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Active AI Provider: ${META_API_KEY ? 'Meta Model API' : (BASETEN_API_KEY ? 'Baseten' : 'Offline Adaptive Heuristics')}`);
  });
}

startServer();
