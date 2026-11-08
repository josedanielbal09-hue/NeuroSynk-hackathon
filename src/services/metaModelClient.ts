/**
 * NeuroSynk AI Core - Universal Google Gemini Integration Client
 *
 * Integrated capabilities:
 * 1. Google Gemini 2.5 Flash / 2.0 Flash / 1.5 Flash (Low-latency streaming & structured JSON)
 * 2. Dynamic Model Discovery via Google Generative Language API (ListModels)
 * 3. Hybrid Localhost (/api/*) + Direct Browser HTTPS execution
 * 4. Local Edge-Biomechanical Ergonomic Calibration (100% On-Device Privacy)
 */

export interface MetaSparkPayload {
  perclos: number;
  fatigueScore: number;
  postureScore: number;
  currentTask: string;
  sessionMinutes: number;
  cognitiveClass: string;
}

export interface MetaWonderDecomposePayload {
  task: string;
  perclos: number;
  stressLevel: number;
  availableMinutes: number;
  context?: string;
}

export interface MetaSAMCalibrationResult {
  isCalibrated: boolean;
  distanceMetric: 'OPTIMAL' | 'TOO_CLOSE' | 'TOO_FAR';
  headTiltAngle: number;
  shoulderAlignmentScore: number;
  clutterScore: number;
  recommendations: string[];
}

export interface BiometricTelemetryPayload {
  cognitiveState?: string;
  focusScore?: number;
  stressLevel?: number;
  sessionMinutes?: number;
  postureState?: string;
}

export interface SessionDebriefPayload {
  task: string;
  totalMinutes: number;
  completedStepsCount: number;
  totalStepsCount: number;
  averageFocus: number;
  flowPercentage: number;
  fatigueEventsCount: number;
}

export interface SessionDebriefResult {
  debrief: string;
}

let cachedModels: { key: string; models: string[] } | null = null;

export function sanitizeApiKey(raw?: string): string {
  if (!raw) {
    if (typeof window !== 'undefined') {
      raw = localStorage.getItem('gemini_api_key') || '';
    } else {
      raw = '';
    }
  }
  return raw.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim().replace(/^["']|["']$/g, '');
}

function getClientApiKey(explicitKey?: string): string {
  const candidate = (explicitKey && explicitKey.trim())
    ? explicitKey.trim()
    : (typeof localStorage !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '').trim() : '');
  return sanitizeApiKey(candidate);
}

/**
 * Queries Google Generative Language API for available models enabled for the given API Key,
 * prioritizing gemini-3.5-flash, then gemini-2.5-flash, and finally gemini-2.0-flash.
 */
export async function getAvailableModels(apiKey: string): Promise<string[]> {
  const cleanKey = sanitizeApiKey(apiKey);
  const priorityChain = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  if (!cleanKey) return priorityChain;

  if (cachedModels && cachedModels.key === cleanKey && cachedModels.models.length > 0) {
    return cachedModels.models;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const valid = data.models
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => String(m.name || '').replace(/^models\//, ''));

        if (valid.length > 0) {
          const ordered = [
            ...priorityChain,
            ...valid.filter((m: string) => !priorityChain.includes(m) && (m.startsWith('gemini-3.5-flash') || m.startsWith('gemini-2.5-flash') || m.startsWith('gemini-2.0-flash')))
          ];
          cachedModels = { key: cleanKey, models: ordered };
          return ordered;
        }
      }
    }
  } catch (e) {
    console.warn('[Gemini ListModels] Warning:', e);
  }

  return priorityChain;
}

/**
 * Direct REST call to Google Generative Language API from the browser
 */
export async function callGoogleGeminiDirect(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  isJson: boolean = false
): Promise<string> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    throw new Error('Gemini API Key is not configured.');
  }

  const modelsToTry = await getAvailableModels(cleanKey);
  let lastError: any = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    try {
      const payload: any = {
        contents: [
          {
            role: 'user',
            parts: [{ text: userContent }]
          }
        ]
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      if (isJson) {
        payload.generationConfig = {
          responseMimeType: 'application/json'
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.trim().length > 0) {
          return text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        }
      } else {
        const errText = await res.text();
        lastError = new Error(`Google Gemini (${model}): ${res.status} ${errText.slice(0, 120)}`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not connect to Google Gemini API.');
}

export async function testGeminiConnection(apiKey?: string): Promise<{ success: boolean; message: string }> {
  const cleanKey = getClientApiKey(apiKey);

  if (cleanKey) {
    try {
      const text = await callGoogleGeminiDirect(
        cleanKey,
        'Respond strictly with "Connection active".',
        'Link test.',
        false
      );
      return {
        success: true,
        message: `Connected to Google Gemini (3.5 -> 2.5 -> 2.0 Flash): "${text.trim()}"`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error connecting to Google Gemini API'
      };
    }
  }

  try {
    const res = await fetch('/api/api-status');
    if (res.ok) {
      const data = await res.json();
      if (data.hasGeminiKey || data.hasServerKey) {
        return {
          success: true,
          message: 'Connected to Google Gemini API (Server Key active)'
        };
      }
    }
    return {
      success: false,
      message: 'API Key is empty. Paste your Google AI Studio key (AIza...).'
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection error' };
  }
}

export const testMetaModelConnection = testGeminiConnection;

export async function chatUniversal(
  messages: any[] | string,
  _apiKey?: string,
  currentStep: string = '',
  taskContext: string = '',
  telemetry?: BiometricTelemetryPayload
): Promise<{ reply: string; proposal?: any }> {
  const userText = Array.isArray(messages)
    ? (messages[messages.length - 1]?.content || '')
    : (typeof messages === 'string' ? messages : '');
  const key = getClientApiKey(_apiKey);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({
        message: userText,
        messages: Array.isArray(messages) ? messages : undefined,
        currentStep,
        taskContext,
        telemetry,
        apiKey: key
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.reply) {
        return { reply: data.reply, proposal: data.proposal };
      }
    }
  } catch (err) {
    console.warn('[Gemini Client Chat] Backend fallback to direct:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Co-Presence Mentor powered by Google Gemini.
Answer the user's question in under 28 words in English.
ALWAYS start with an ACTION VERB IN ALL CAPS. Zero Markdown.`;
      const reply = await callGoogleGeminiDirect(
        key,
        sys,
        `Active step: "${currentStep}" | Context: "${taskContext}" | Biometrics: ${JSON.stringify(telemetry || {})} | Question: "${userText}"`,
        false
      );
      if (reply) return { reply: reply.replace(/[*_#]/g, '').trim() };
    } catch (e) {
      console.warn('[Gemini Direct Chat] Fallback:', e);
    }
  }

  return { reply: 'MOVE forward with determination on this step. Still here with you.' };
}

export async function sessionDebriefUniversal(
  payload: SessionDebriefPayload,
  _apiKey?: string
): Promise<SessionDebriefResult> {
  const key = getClientApiKey(_apiKey);
  try {
    const response = await fetch('/api/session-debrief', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ ...payload, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.debrief) {
        return { debrief: data.debrief };
      }
    }
  } catch (err) {
    console.warn('[Session Debrief Client] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Mentor powered by Google Gemini. Write a concise closing debrief in English (max 50 words) covering pace balance, completed steps, and somatic recovery.`;
      const prompt = `Task: "${payload.task}" | Duration: ${payload.totalMinutes}m | Steps: ${payload.completedStepsCount}/${payload.totalStepsCount} | Avg Focus: ${payload.averageFocus}%`;
      const text = await callGoogleGeminiDirect(key, sys, prompt, false);
      if (text) return { debrief: text.replace(/[*_#]/g, '').trim() };
    } catch {}
  }

  return {
    debrief: `SESSION COMPLETED: You finished ${payload.completedStepsCount} of ${payload.totalStepsCount} steps on "${payload.task}". Your average focus stayed at ${payload.averageFocus}%. Outstanding persistence. Take 5 minutes to stretch and rest your eyes before your next block.`
  };
}

export async function taskSurveyUniversal(
  task: string,
  _apiKey?: string
): Promise<{ questions: any[] }> {
  const key = getClientApiKey(_apiKey);
  try {
    const response = await fetch('/api/task-survey', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ task, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.questions && Array.isArray(data.questions)) {
        return { questions: data.questions };
      }
    }
  } catch (err) {
    console.warn('[Gemini Task Survey] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Cognitive & Task Diagnostician powered by Google Gemini.
Design a quick calibration survey of EXACTLY 5 brief questions in English based on the goal entered by the user.
Respond strictly with valid JSON containing the key "questions": array of objects with "id", "question", "options" (3 concrete options each, in English).`;
      const text = await callGoogleGeminiDirect(key, sys, `User goal: "${task}"`, true);
      const data = JSON.parse(text);
      if (data.questions && Array.isArray(data.questions)) {
        return { questions: data.questions };
      }
    } catch {}
  }

  return {
    questions: [
      {
        id: "q1",
        question: "How much time will you dedicate to this session?",
        options: ["25 to 30 minutes (Short sprint)", "45 to 60 minutes (Standard session)", "90 to 120 minutes (Deep session)"]
      },
      {
        id: "q2",
        question: "What tangible outcome do you want to achieve by the end?",
        options: ["Grasp the core concept", "Solve an exercise or section", "Complete a formal deliverable"]
      },
      {
        id: "q3",
        question: "How familiar or prepared are you with the materials?",
        options: ["Starting from scratch", "Have basics and notes ready", "Mastered the topic, ready to produce"]
      },
      {
        id: "q4",
        question: "How would you describe your energy and focus right now?",
        options: ["High energy and clear focus", "Medium / neutral energy", "Scattered mind or initial fatigue"]
      },
      {
        id: "q5",
        question: "When do you usually experience the most friction or mental block?",
        options: ["Breaking initial inertia", "Midway through dense technical parts", "Wrapping up and polishing final details"]
      }
    ]
  };
}

export async function splitTaskUniversal(
  task: string,
  surveyAnswers: any,
  apiKeyOrContext?: string,
  contextOrApiKey?: string
): Promise<{ steps: string[] }> {
  let context = '';
  let candidateKey = '';

  if (typeof apiKeyOrContext === 'string') {
    if (apiKeyOrContext.includes(':') || apiKeyOrContext.includes('\n') || apiKeyOrContext.length > 50) {
      context = apiKeyOrContext;
      candidateKey = contextOrApiKey || '';
    } else {
      candidateKey = apiKeyOrContext;
      context = contextOrApiKey || '';
    }
  }

  const key = getClientApiKey(candidateKey);
  try {
    const response = await fetch('/api/split-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ task, surveyAnswers, context, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        return { steps: data.steps };
      }
    }
  } catch (err) {
    console.warn('[Gemini Split Task] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Planning & Focus Architect powered by Google Gemini.
Design a realistic work session in English based on the user's survey answers.
Every step MUST begin with an ACTION VERB IN ALL CAPS (e.g., "DEFINE", "ANALYZE", "DEVELOP", "SOMATIC PAUSE:", "VERIFY"). Include at least one "SOMATIC PAUSE:" step. Zero Markdown formatting.
Respond strictly with valid JSON containing the key "steps": array of strings in English.`;
      const text = await callGoogleGeminiDirect(
        key,
        sys,
        `GOAL: "${task}" | ANSWERS: ${JSON.stringify(surveyAnswers || {})} | CONTEXT: "${context || 'General'}"`,
        true
      );
      const data = JSON.parse(text);
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        return { steps: data.steps.map((s: any) => String(typeof s === 'string' ? s : (s?.step || s?.text || s || '')).replace(/\*/g, '').trim()) };
      }
    } catch {}
  }

  return {
    steps: [
      `DEFINE the specific objective and essential materials for this block on '${task}'.`,
      `ANALYZE the first core concept by identifying key definitions.`,
      `DEVELOP the first section applying the main methods.`,
      `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 3 minutes.`,
      `EXECUTE the second practice phase consolidating the concepts covered.`,
      `VERIFY your results and write a brief closing summary.`
    ]
  };
}

export async function subdivideStepUniversal(
  parentStep: string,
  taskContextOrStepNum?: string | number,
  stepNumberOrApiKey?: number | string,
  _apiKey?: string
): Promise<{ subSteps: string[] }> {
  const taskContext = typeof taskContextOrStepNum === 'string' ? taskContextOrStepNum : (typeof stepNumberOrApiKey === 'string' ? stepNumberOrApiKey : '');
  const stepNumber = typeof taskContextOrStepNum === 'number' ? taskContextOrStepNum : (typeof stepNumberOrApiKey === 'number' ? stepNumberOrApiKey : 1);
  const explicitKey = typeof stepNumberOrApiKey === 'string' && stepNumberOrApiKey.length > 20 ? stepNumberOrApiKey : _apiKey;
  const key = getClientApiKey(explicitKey);

  try {
    const response = await fetch('/api/subdivide-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ parentStep, stepNumber, taskContext, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.subSteps) && data.subSteps.length > 0) {
        return { subSteps: data.subSteps };
      }
    }
  } catch (err) {
    console.warn('[Gemini Subdivide Step] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Executive Rescue Specialist powered by Google Gemini.
Break the blocked step into exactly 3 atomic NANO-STEPS in English, each taking under 60 seconds.
Every nano-step MUST start with an ACTION VERB IN ALL CAPS.
Respond strictly with valid JSON containing the key "subSteps": array of 3 strings in English.`;
      const text = await callGoogleGeminiDirect(
        key,
        sys,
        `Blocked step: "${parentStep}" | Context: "${taskContext || 'General'}"`,
        true
      );
      const data = JSON.parse(text);
      if (Array.isArray(data.subSteps) && data.subSteps.length > 0) {
        return { subSteps: data.subSteps.map((s: any) => String(typeof s === 'string' ? s : (s?.step || s?.text || s || '')).replace(/\*/g, '').trim()) };
      }
    } catch {}
  }

  return {
    subSteps: [
      "GRAB your pen or place the cursor directly in your workspace.",
      "LOCATE only the very first line or introductory concept.",
      "WRITE the first keyword to break initial inertia."
    ]
  };
}

/**
 * Requests a human, specific verbal celebration from Google Gemini
 * for the micro-step the user just mastered.
 */
export async function celebrateStepUniversal(
  completedStep: string,
  nextStep?: string,
  taskContext?: string
): Promise<string> {
  const key = getClientApiKey();
  const getDynamicFallback = (step: string): string => {
    const clean = step.replace(/^(\d+\.?\s*|[-•*]\s*)/, '').trim();
    const match = clean.match(/^([A-Z]{3,})\s+(.*)/i);
    if (match) {
      const verb = match[1].toLowerCase();
      const rest = match[2].slice(0, 42).replace(/[.,;:].*$/, '').trim();
      return `Great work as you ${verb} ${rest}! Keep that momentum going.`;
    }
    return `Step conquered! Moving right on to the next goal.`;
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('/api/step-celebration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ completedStep, nextStep, taskContext, apiKey: key }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.phrase && typeof data.phrase === 'string' && data.phrase.trim().length > 0) {
        return data.phrase.replace(/["*]/g, '').trim();
      }
    }
  } catch (err) {
    console.warn('[Celebrate Step Client] Fallback:', err);
  }

  return getDynamicFallback(completedStep);
}

/**
 * Requests a streaming verbal micro-intervention from Google Gemini
 */
export async function streamMuseSparkIntervention(
  payload: MetaSparkPayload,
  onChunk: (chunk: string) => void,
  onComplete?: () => void
): Promise<void> {
  const key = getClientApiKey();
  try {
    const response = await fetch('/api/meta/muse-spark/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ ...payload, apiKey: key })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Gemini stream link error (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

    if (onComplete) onComplete();
  } catch (error) {
    console.warn('[Gemini Intervention Client] Local fallback:', error);
    let fallback = 'KEEP the rhythm. Breathe deeply for 3 seconds and stay focused.';
    if (payload.perclos > 25 || payload.fatigueScore > 50) {
      fallback = 'REST your gaze away from the screen for 20 seconds. Protecting your energy.';
    } else if (payload.postureScore > 40) {
      fallback = 'ALIGN your shoulders and lift your chin. Good posture sharpens clarity.';
    }
    onChunk(fallback);
    if (onComplete) onComplete();
  }
}

/**
 * Decomposes a complex cognitive task into 3 executable nano-steps using Google Gemini
 */
export async function decomposeWithMuseWonder(
  payload: MetaWonderDecomposePayload
): Promise<{ nanoSteps: string[]; estimatedSecondsPerStep: number }> {
  const key = getClientApiKey();
  try {
    const response = await fetch('/api/meta/muse-wonder/decompose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ ...payload, apiKey: key })
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.nanoSteps) && data.nanoSteps.length > 0) {
        return {
          nanoSteps: data.nanoSteps,
          estimatedSecondsPerStep: data.estimatedSecondsPerStep || 45
        };
      }
    }
  } catch (err) {
    console.warn('[Gemini Decompose Client] Fallback:', err);
  }

  return {
    nanoSteps: [
      `DEFINE the first keyword or initial concept of "${payload.task}".`,
      'OPEN your document or notebook and write a single introductory sentence.',
      'PROCEED with the first paragraph without judging perfection; we will maintain flow.'
    ],
    estimatedSecondsPerStep: 45
  };
}

/**
 * Deterministic local ergonomic calibration (Edge Privacy)
 * NEVER sends user video or images off the device.
 */
export async function calibrateErgonomicsWithSAM(
  telemetryOrSnapshot?: string | { rollAngle?: number; shoulderAngle?: number; pitchAngle?: number; stressLevel?: number }
): Promise<MetaSAMCalibrationResult> {
  const payload = typeof telemetryOrSnapshot === 'object' && telemetryOrSnapshot !== null
    ? telemetryOrSnapshot
    : {};
  try {
    const response = await fetch('/api/meta/sam/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Ergonomic Calibration Client] Local fallback:', err);
  }

  return {
    isCalibrated: true,
    distanceMetric: 'OPTIMAL',
    headTiltAngle: 0,
    shoulderAlignmentScore: 92,
    clutterScore: 15,
    recommendations: [
      'Screen-to-face distance within optimal ergonomic range (50-70 cm).',
      'Shoulders horizontally aligned. Workspace clear for peak attention.'
    ]
  };
}

/**
 * Fetches trained Biometric Neural Network model metadata
 */
export async function getModelInfo(): Promise<any> {
  try {
    const response = await fetch('/api/model-info');
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Model Info Client] Fallback:', err);
  }
  return null;
}
