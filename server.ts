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
 * with graceful fallback to Baseten.
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
      // Meta Muse Spark Open uses 500-1500 internal reasoning_tokens + output tokens,
      // so tokenBudget MUST be >= 4096 so JSON responses are never truncated.
      const tokenBudget = Math.max(params.maxTokens ?? 4096, 4096);
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

        // 1. Strip internal <think> reasoning tags if present
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 2. If NOT JSON and contains internal reasoning monologue leaks, strip them cleanly
        const looksLikeJson = /\{[\s\S]*\}|\[[\s\S]*\]/.test(text);
        if (!looksLikeJson && /Starts with an? uppercase|Need to consider:|Count:\s*\d|User prompt:/i.test(text)) {
          const quoteMatch = text.match(/"([^"]{10,140})"/);
          if (quoteMatch) {
            text = quoteMatch[1].trim();
          } else {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const cleanLines = lines.filter(l => !/Starts with an? uppercase|Need to consider:|Count:\s*\d|User prompt:/i.test(l));
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
        question: "How much time will you dedicate to this session?",
        options: [
          "25 to 30 minutes (Short sprint)",
          "45 to 60 minutes (Standard session)",
          "90 to 120 minutes (Deep session)"
        ]
      },
      {
        id: "q2",
        question: "What tangible outcome do you want to achieve by the end of this block?",
        options: [
          "Understand the core concept",
          "Solve an exercise or section",
          "Complete a formal deliverable"
        ]
      },
      {
        id: "q3",
        question: "What is your familiarity or preparation level with the materials?",
        options: [
          "Starting completely from scratch",
          "I have basics and notes ready",
          "I master the topic, ready to produce"
        ]
      },
      {
        id: "q4",
        question: "How would you describe your energy and focus right now?",
        options: [
          "High energy and clear focus",
          "Moderate / neutral energy",
          "Scattered mind or initial fatigue"
        ]
      },
      {
        id: "q5",
        question: "At what point do you usually experience the most friction or block?",
        options: [
          "Breaking initial starting inertia",
          "Midway through dense technical material",
          "Wrapping up and polishing final details"
        ]
      }
    ]
  };

  try {
    const prompt_sistema = `You are NeuroSynk's Cognitive & Task Diagnostician powered by Meta Muse.
Your mission is to design a quick calibration survey of EXACTLY 5 brief questions in English based on the goal entered by the user.
Respond strictly with valid JSON containing the key "questions": array of objects with "id", "question", "options" (3 concrete options each, in English).`;

    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `User goal: "${task}"`,
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
          question: String(q.question || "Calibration question"),
          options: Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map(String)
            : ["Option A", "Option B", "Option C"]
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
    const isLong = timeAns.includes('90') || timeAns.includes('120') || timeAns.includes('deep') || timeAns.includes('profunda');

    if (isShort) {
      return [
        `DEFINE a concrete, atomic slice of '${targetTask}' to tackle in this short sprint.`,
        `OPEN your workspace keeping only indispensable material visible.`,
        `EXECUTE direct work on the first core topic without dividing your attention.`,
        `SYNTHESIZE the outcome achieved and log the conclusion of your block.`
      ];
    }

    if (isLong) {
      return [
        `DEFINE the three main focus pillars that will structure your session on '${targetTask}'.`,
        `ORGANIZE materials and notes for the first conceptual progress block.`,
        `DEVELOP the fundamentals and initial exercises of the core topic with full concentration.`,
        `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 4 minutes.`,
        `DEEPEN practical application and problem-solving in the second block.`,
        `SYNTHESIZE key arguments or formulas generated during deep practice.`,
        `SOMATIC PAUSE: Stand up from your chair, breathe deeply, and walk a few steps for 5 minutes.`,
        `CONSOLIDATE the third block by resolving remaining questions or polishing technical details.`,
        `VERIFY complete operational mastery by comparing your output against your initial goal.`
      ];
    }

    return [
      `DEFINE the specific objective and essential materials needed for this '${targetTask}' block.`,
      `ANALYZE the first core concept by identifying key definitions and their relationships.`,
      `DEVELOP the first section or exercise applying the central methods of the topic.`,
      `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 3 minutes.`,
      `EXECUTE the second practice or drafting phase while consolidating the concepts covered.`,
      `VERIFY your results and write a concise final validation summary.`
    ];
  };

  try {
    const prompt_sistema = `You are NeuroSynk's Planning & Focus Architect powered by Meta Muse Wonder.
Your mission is to design a realistic work session in English based on the user's survey answers.
Every step MUST begin with an ACTION VERB IN ALL CAPS (e.g., "DEFINE", "ANALYZE", "DEVELOP", "SOMATIC PAUSE:", "VERIFY"). Include at least one "SOMATIC PAUSE:" step. Zero Markdown formatting.
Respond strictly with valid JSON containing the key "steps": array of strings in English.`;

    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `GOAL: "${task}"\nANSWERS: ${JSON.stringify(surveyAnswers || {})}\nCONTEXT: "${context || 'General'}"`,
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
 * Dynamic AI Celebration Endpoint for each completed micro-step.
 * FocusBud speaks a human sentence recognizing the specific mastered activity.
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
    const match = clean.match(/^([A-Z]{3,})\s+(.*)/i);
    if (match) {
      const verb = match[1].toLowerCase();
      const rest = match[2].slice(0, 42).replace(/[.,;:].*$/, '').trim();
      return `Great job completing ${verb} ${rest}! Keep that momentum going.`;
    }
    return `Step completed successfully! Let's move on to the next target.`;
  };

  try {
    const prompt_sistema = `You are FocusBud, NeuroSynk's empathetic, human, energetic avatar powered by Meta Muse Spark.
Your user just completed a micro-step in their focus session.
Write a single natural, brief, warm, motivating sentence in English (MAXIMUM 14 WORDS) acknowledging SPECIFICALLY the concrete activity they just mastered so they feel genuinely accompanied in real time.
Speak in direct, enthusiastic, human English. Zero markdown formatting and no quotes.`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Completed activity: "${completedStep}"\nNext step: "${nextStep || 'next'}"\nOverall goal: "${taskContext || ''}"`,
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
    "PICK UP your pen or place your cursor directly in your workspace.",
    "LOCATE just the very first line or introductory concept.",
    "WRITE the first keyword to break initial inertia."
  ];

  try {
    const prompt_sistema = `You are NeuroSynk's Executive Rescue Specialist powered by Meta Muse Spark.
Break the blocked step into exactly 3 atomic NANO-STEPS in English, each taking under 60 seconds.
Every nano-step MUST start with an ACTION VERB IN ALL CAPS.
Respond strictly with valid JSON containing the key "subSteps": array of 3 strings in English.`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Blocked step: "${parentStep}"\nContext: "${taskContext || 'General'}"`,
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
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    let prompt_sistema = `You are NeuroSynk's Co-Presence Mentor powered by Meta Muse Spark.
Your mission is to keep the user in motion by answering questions in under 28 words in English.
ALWAYS start with an ACTION VERB IN ALL CAPS. Zero Markdown. Supportive co-presence tone ("we're on it / let's go").`;

    // Adapt tone and cognitive load based on anonymous local biometric telemetry
    if (telemetry && typeof telemetry === 'object') {
      const state = String(telemetry.cognitiveState || '').toUpperCase();
      const focus = Number(telemetry.focusScore ?? 100);
      const stress = Number(telemetry.stressLevel ?? 0);

      if (state.includes('FATIGUE') || state.includes('FATIGA') || focus < 35) {
        prompt_sistema += `\n[DETECTED STATE: COGNITIVE FATIGUE (Focus ${focus}%)]. The user is tired. Respond with extreme calm and gentleness, using low cognitive load. Suggest a 30-second micro-action or brief breath if helpful.`;
      } else if (state.includes('STRAIN') || state.includes('OVERSTIM') || state.includes('AGOBIO') || stress > 70) {
        prompt_sistema += `\n[DETECTED STATE: OVERLOAD / STRAIN (Tension ${stress}%)]. Act as a calming somatic anchor. Ask them to take just one atomic micro-step at a time without overwhelming them.`;
      } else if (state.includes('FLOW') || focus > 80) {
        prompt_sistema += `\n[DETECTED STATE: DEEP FLOW]. Reply in UNDER 12 DIRECT WORDS to protect their concentration without breaking pace.`;
      } else if (state.includes('DISTRA') || focus < 50) {
        prompt_sistema += `\n[DETECTED STATE: DISTRACTION]. Gently guide attention back to the active step.`;
      }
    }

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Active step: "${currentStep || 'Work'}"\nContext: "${taskContext || 'General'}"\nMessage: "${userText}"`,
      reasoningEffort: "minimal",
      maxTokens: 160,
      apiKeyOverride: headerKey
    });

    const cleanReply = text.replace(/[*_#]/g, '').trim();
    res.json({ reply: cleanReply || "ADVANCE through the first detail of this step. We are right here with you." });
  } catch (err: any) {
    console.warn("[Chat] Using adaptive reply:", err?.cause?.message || err?.message || err);
    res.json({ reply: "BREAK the step down to its smallest piece. Write the first word to get moving." });
  }
});

/**
 * Post-Session Cognitive Debrief Endpoint
 * Generates an executive accompaniment and recovery summary with Meta Muse Spark / Baseten
 */
app.post("/api/session-debrief", async (req, res) => {
  const {
    task = "Focus Session",
    totalMinutes = 0,
    completedStepsCount = 0,
    totalStepsCount = 0,
    averageFocus = 80,
    flowPercentage = 0,
    fatigueEventsCount = 0,
    apiKey
  } = req.body;
  const headerKey = (req.headers['x-api-key'] as string) || apiKey;

  const fallbackSummary = `SESSION COMPLETE: You finished ${completedStepsCount} of ${totalStepsCount} steps on "${task}". Your average focus stayed at ${averageFocus}%. Outstanding persistence. Take 5 minutes to stretch and rest your eyes before your next block.`;

  try {
    const prompt_sistema = `You are NeuroSynk's Co-Presence & Cognitive Recovery Mentor powered by Meta Muse Spark.
Analyze the anonymous statistics of the completed session and write a concise closing report in English (maximum 60 words).
Structure in 3 brief points:
1. BALANCE: pace and focus assessment.
2. ACHIEVEMENT: recognition for completed steps.
3. RECOVERY: specific somatic recommendation to rest.
Start with an energizing phrase in ALL CAPS. Zero heavy Markdown formatting.`;

    const userPrompt = `Task: "${task}"
Total duration: ${totalMinutes} minutes
Completed steps: ${completedStepsCount} of ${totalStepsCount}
Average focus: ${averageFocus}%
Time in Flow: ${flowPercentage}%
Fatigue spikes managed: ${fatigueEventsCount}`;

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
 * 1. Muse Spark - Streaming SSE Rapid Co-Presence Intervention
 */
app.post("/api/meta/muse-spark/stream", async (req, res) => {
  const { perclos = 0, fatigueScore = 0, postureScore = 0, currentTask = 'Study', cognitiveClass = 'NEUTRAL' } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const prompt = `User in active work session. Biometric state: PERCLOS=${perclos}%, Fatigue=${fatigueScore}/100, Posture=${postureScore}/100, State=${cognitiveClass}. Task: "${currentTask}".
STRICT Instruction: Generate ONLY ONE single micro-instruction in English of MAXIMUM 12 WORDS starting with an ACTION VERB IN ALL CAPS. Zero explanations, zero reasoning.`;

  try {
    const text = await callMetaModel({
      model: "muse-spark-1.0",
      userPrompt: prompt,
      temperature: 0.4,
      maxTokens: 120
    });

    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#"`]/g, '').trim();

    // Extract quoted sentence if present
    const quoteMatch = cleanText.match(/"([^"]{10,120})"/);
    if (quoteMatch) {
      cleanText = quoteMatch[1].trim();
    }

    // If over 16 words or reasoning monologue leaked, use clinical adaptive fallback
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 16 || /Starts with an? uppercase|Need to consider:|Count:\s*\d|User prompt:/i.test(cleanText) || !cleanText) {
      if (perclos > 20 || fatigueScore > 50) {
        cleanText = "REST your gaze 5 seconds away from the screen and breathe deeply.";
      } else if (postureScore > 40) {
        cleanText = "ADJUST your back and relax your shoulders to clear your mind.";
      } else if (String(cognitiveClass).includes('STRAIN') || String(cognitiveClass).includes('OVER') || String(cognitiveClass).includes('AGOBIO') || String(cognitiveClass).includes('SOBRE')) {
        cleanText = "PAUSE for a moment. Take one unhurried click; we are right here.";
      } else if (String(cognitiveClass).includes('FLOW')) {
        cleanText = "MAINTAIN this rhythm. Your focus is at peak performance.";
      } else {
        cleanText = "FOCUS on the first detail of the active step. Steady pace.";
      }
    }

    const words = cleanText.split(" ");
    for (const w of words) {
      res.write(`${w} `);
      await new Promise(r => setTimeout(r, 35));
    }
    res.end();
  } catch (err) {
    let fallback = "FOCUS on the first detail of the step. We are in this sprint together.";
    if (perclos > 25 || fatigueScore > 50) {
      fallback = "REST your gaze 20 seconds away from the screen. Protecting your cognitive pace.";
    } else if (postureScore > 40) {
      fallback = "ADJUST your back and relax your shoulders. Posture clears the mind.";
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
 * 2. Muse Wonder - Cognitive Task Decomposition into 3 Nano-Steps
 */
app.post("/api/meta/muse-wonder/decompose", async (req, res) => {
  const { task = 'Work', perclos = 0, stressLevel = 0 } = req.body;

  const fallback = {
    nanoSteps: [
      `DEFINE the first term or atomic point of "${task}".`,
      "WRITE a single sentence or open the first working file.",
      "CONTINUE without judging perfection; we will track your progress step by step."
    ],
    estimatedSecondsPerStep: perclos > 25 ? 60 : 45
  };

  try {
    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: "You are Muse Wonder. Decompose the task into exactly 3 nano-steps in English executable in under 60 seconds each, starting with an ACTION VERB IN ALL CAPS. Respond in JSON with key 'nanoSteps': array of strings.",
      userPrompt: `Task: "${task}", PERCLOS: ${perclos}%, Stress: ${stressLevel}%`,
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
 * 3. SAM 3.1 - Deterministic Local Ergonomic Calibration (Edge Privacy)
 * Visual data NEVER leaves the user's device.
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
    recommendations.push(`Gently straighten your neck tilt (${headTiltAngle}°) to release cervical tension.`);
  } else {
    recommendations.push('Eye line aligned with the top third of your monitor.');
  }
  if (shoulderAlignmentScore < 85) {
    recommendations.push('Level both shoulders and rest your forearms to sustain your Flow state.');
  } else {
    recommendations.push('Shoulders level and ergonomic workspace ready for your sprint.');
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
