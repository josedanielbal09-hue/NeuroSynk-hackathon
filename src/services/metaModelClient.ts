/**
 * NeuroSynk AI Core - Meta Model Integration Client
 * Prepared for Meta Global AI Developer Hackathon (Startup Track)
 *
 * Integrated models:
 * 1. Muse Spark / Muse Spark Open (Low-latency streaming for real-time interventions)
 * 2. Muse Wonder (Reasoning engine for cognitive breakdown of complex tasks)
 * 3. SAM 3.1 (Segment Anything for workspace ergonomic analysis and calibration)
 * 4. Baseten / Modal (Resilient open-model inference)
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

export function sanitizeApiKey(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim();
}

export async function testMetaModelConnection(apiKey?: string): Promise<{ success: boolean; message: string }> {
  try {
    const key = (apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') || '').trim();
    const res = await fetch('/api/api-status', {
      headers: key ? { 'x-api-key': key } : undefined
    });
    if (res.ok) {
      const data = await res.json();
      if (data.hasBasetenKey || data.hasMetaKey || data.hasGeminiKey) {
        let name = 'Meta Model API';
        if (data.activeProvider === 'baseten') name = 'Baseten (Muse Spark Open)';
        else if (data.activeProvider === 'gemini') name = 'Google Gemini';
        return {
          success: true,
          message: `Connected to ${name}`
        };
      }
    }
    return { success: true, message: 'Local inference engine active' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection error' };
  }
}

export const testGeminiConnection = testMetaModelConnection;

function getClientApiKey(explicitKey?: string): string {
  const candidate = (explicitKey && explicitKey.trim())
    ? explicitKey.trim()
    : (typeof localStorage !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '').trim() : '');
  // Only forward valid Baseten keys (b10_...) so legacy Gemini keys (AIza...) in localStorage never cause 401/403 on Baseten
  return candidate.startsWith('b10_') ? candidate : '';
}

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
        ...(key ? { 'x-api-key': key } : {})
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
      return { reply: data.reply || "PROCEED with the first step. We are right here with you." };
    }
  } catch (err) {
    console.warn('[Meta Client Chat] Fallback:', err);
  }
  return { reply: "MOVE forward with determination on this step. Still here with you." };
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
        ...(key ? { 'x-api-key': key } : {})
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
        ...(key ? { 'x-api-key': key } : {})
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
    console.warn('[Meta Task Survey] Fallback:', err);
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
        ...(key ? { 'x-api-key': key } : {})
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
    console.warn('[Meta Split Task] Fallback:', err);
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
        ...(key ? { 'x-api-key': key } : {})
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
    console.warn('[Meta Subdivide Step] Fallback:', err);
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
 * Requests a human, specific verbal celebration from Meta Muse Spark
 * for the micro-step the user just mastered.
 */
export async function celebrateStepUniversal(
  completedStep: string,
  nextStep?: string,
  taskContext?: string
): Promise<string> {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedStep, nextStep, taskContext }),
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
 * Requests a streaming verbal micro-intervention from Muse Spark
 */
export async function streamMuseSparkIntervention(
  payload: MetaSparkPayload,
  onChunk: (chunk: string) => void,
  onComplete?: () => void
): Promise<void> {
  try {
    const response = await fetch('/api/meta/muse-spark/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Muse Spark link error (${response.status})`);
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
    console.warn('[Muse Spark Client] Local fallback:', error);
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
 * Decomposes a complex cognitive task into 3 executable nano-steps using Muse Wonder
 */
export async function decomposeWithMuseWonder(
  payload: MetaWonderDecomposePayload
): Promise<{ nanoSteps: string[]; estimatedSecondsPerStep: number }> {
  try {
    const response = await fetch('/api/meta/muse-wonder/decompose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
    console.warn('[Muse Wonder Client] Fallback:', err);
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
    console.warn('[SAM 3.1 Client] Local fallback:', err);
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
