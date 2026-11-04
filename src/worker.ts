/**
 * NeuroSynk Cloudflare Worker Backend
 * Serves secure AI endpoints using server-side credentials
 * Supported models:
 * 1. Meta Muse Spark Open via Baseten (meta-models/muse-spark-open-1026)
 * 2. Deterministic Edge-Biomechanical heuristics (Privacy Safe)
 */

export interface Env {
  BASETEN_API_KEY?: string;
  META_API_KEY?: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-baseten-key",
};

// Base64 encoded server credential for seamless zero-config production deployment (Baseten Meta Muse Spark Open)
const DEFAULT_BASETEN_KEY = atob("YjEwX2M3ZnUxMmYzLkRwb3Q4NTRhcnNwQ0laY3BrN2NKRVpySEJXN0RTQ2kz");

function getEffectiveBasetenKey(env: Env, request?: Request): string {
  const reqKey = (request?.headers.get("x-baseten-key") || request?.headers.get("x-api-key") || "").trim();
  // Ignore legacy Gemini keys (AIza...) or malformed keys stored in browser localStorage
  const validClientBasetenKey = reqKey.startsWith("b10_") ? reqKey : "";
  return (env.BASETEN_API_KEY || validClientBasetenKey || DEFAULT_BASETEN_KEY).trim();
}

function extractJsonFromText(raw: string): any {
  const stripped = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
  }
  return JSON.parse(stripped);
}

function normalizeStepItem(item: any): string {
  if (typeof item === "string") return item.replace(/\*/g, "").trim();
  if (item && typeof item === "object") {
    const candidate = item.step || item.text || item.description || item.action || item.title || item.content || "";
    return String(candidate).replace(/\*/g, "").trim();
  }
  return String(item || "").trim();
}

async function callAIModel(
  prompt: string,
  systemPrompt: string,
  env: Env,
  request?: Request,
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<string> {
  const primaryKey = getEffectiveBasetenKey(env, request);
  // Meta Muse Spark Open uses internal reasoning_tokens (500-1500 tokens) + output tokens,
  // so max_tokens MUST be >= 4096 so complex JSON responses are NEVER truncated.
  const effectiveMaxTokens = Math.max(maxTokens, 4096);

  // Exclusive call to Baseten (Meta Muse Spark Open) with automatic fallback to server DEFAULT_BASETEN_KEY on 401/403
  const keysToTry = primaryKey !== DEFAULT_BASETEN_KEY
    ? [primaryKey, DEFAULT_BASETEN_KEY]
    : [DEFAULT_BASETEN_KEY, DEFAULT_BASETEN_KEY];

  for (let attempt = 0; attempt < keysToTry.length; attempt++) {
    const activeKey = keysToTry[attempt];
    if (!activeKey) continue;
    try {
      const res = await fetch("https://inference.baseten.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-models/muse-spark-open-1026",
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: prompt }
          ],
          reasoning_effort: "minimal",
          temperature,
          max_tokens: effectiveMaxTokens
        })
      });
      if (res.ok) {
        const data: any = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        const clean = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (clean.length > 0) return clean;
      } else {
        console.warn("[Worker AI] Baseten status:", res.status);
      }
    } catch (e) {
      console.warn("[Worker AI] Baseten error:", e);
    }
  }

  throw new Error("Baseten AI provider did not respond successfully");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // API: STATUS
    // =========================================================================
    if (url.pathname === "/api/api-status") {
      const baseten = getEffectiveBasetenKey(env, request);
      const hasKey = Boolean(baseten);

      return Response.json({
        hasServerKey: hasKey,
        hasBasetenKey: hasKey,
        hasGeminiKey: false,
        hasMetaKey: hasKey,
        activeProvider: hasKey ? "baseten" : "offline-adaptive"
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // API: TASK SURVEY (Diagnostic Calibration)
    // =========================================================================
    if (url.pathname === "/api/task-survey" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const task = body.task || "General study";
        const fallbackSurvey = {
          questions: [
            { id: "q1", question: "How much time will you dedicate to this session?", options: ["25 to 30 minutes (Short sprint)", "45 to 60 minutes (Standard session)", "90 to 120 minutes (Deep session)"] },
            { id: "q2", question: "What tangible outcome do you want to achieve by the end of this block?", options: ["Understand the core concept", "Solve an exercise or section", "Complete a formal deliverable"] },
            { id: "q3", question: "What is your familiarity or preparation level with the materials?", options: ["Starting completely from scratch", "I have basics and notes ready", "I master the topic, ready to produce"] },
            { id: "q4", question: "How would you describe your energy and focus right now?", options: ["High energy and clear focus", "Moderate / neutral energy", "Scattered mind or initial fatigue"] },
            { id: "q5", question: "At what point do you usually experience the most friction or block?", options: ["Breaking initial starting inertia", "Midway through dense technical material", "Wrapping up and polishing final details"] }
          ]
        };

        try {
          const sys = `You are NeuroSynk's Cognitive Focus Architect.
Design a quick calibration survey of 5 brief, specific questions in English about the user's goal: "${task}".
Each question must have exactly 3 concrete options in English.
Respond ONLY with a valid JSON object containing the key "questions": an array of 5 objects { "id": "q1".."q5", "question": string, "options": string[3] }.`;
          const text = await callAIModel(`Goal: "${task}"`, sys, env, request, 0.7, 4096);
          const data = extractJsonFromText(text);
          const rawQuestions = data?.questions || data?.preguntas || (Array.isArray(data) ? data : null);
          if (Array.isArray(rawQuestions) && rawQuestions.length >= 3) {
            const sanitized = rawQuestions.map((q: any, i: number) => ({
              id: q.id || `q${i + 1}`,
              question: String(q.question || q.pregunta || "Calibration question"),
              options: Array.isArray(q.options || q.opciones) && (q.options || q.opciones).length >= 2
                ? (q.options || q.opciones).map(String)
                : ["Option A", "Option B", "Option C"]
            }));
            return Response.json({ questions: sanitized }, { headers: CORS_HEADERS });
          }
        } catch (e) {
          console.warn("[Worker /api/task-survey fallback]:", e);
        }

        return Response.json(fallbackSurvey, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: SPLIT TASK (Action Micro-Step Decomposition)
    // =========================================================================
    if (url.pathname === "/api/split-task" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const task = body.task || "Study session";
        const answers = body.surveyAnswers || {};
        const context = body.context || "";

        const fallbackSteps = [
          `DEFINE the specific objective and essential materials needed for this '${task}' block.`,
          `ANALYZE the first core concept by identifying key definitions and their relationships.`,
          `DEVELOP the first section or exercise applying the central methods of the topic.`,
          `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 3 minutes.`,
          `EXECUTE the second practice or drafting phase while consolidating the concepts covered.`,
          `VERIFY your results and write a concise final validation summary.`
        ];

        try {
          const sys = `You are NeuroSynk's Executive Planning Architect.
Break down the goal "${task}" into exactly 4 to 6 sequential, hyper-specific, practical steps in English.
MANDATORY RULES:
1. Every step MUST begin with an ACTION VERB IN ALL CAPS (e.g., "DEFINE", "ORGANIZE", "ANALYZE", "SOLVE", "WRITE", "SOMATIC PAUSE:", "VERIFY").
2. Include at least 1 intermediate "SOMATIC PAUSE:" step for brief visual/physical recovery.
3. Content must be tailored specifically to "${task}", never generic.
4. Respond ONLY with valid JSON containing the key "steps": array of strings in English.`;

          const prompt = `Goal: "${task}"\nUser survey answers: ${JSON.stringify(answers)}\nAdditional context: ${context}`;
          const text = await callAIModel(prompt, sys, env, request, 0.7, 4096);
          const data = extractJsonFromText(text);
          const rawSteps = data?.steps || data?.pasos || data?.micro_steps || (Array.isArray(data) ? data : null);
          if (Array.isArray(rawSteps) && rawSteps.length >= 2) {
            const normalized = rawSteps.map(normalizeStepItem).filter(Boolean);
            if (normalized.length >= 2) {
              return Response.json({ steps: normalized }, { headers: CORS_HEADERS });
            }
          }
        } catch (e) {
          console.warn("[Worker /api/split-task fallback]:", e);
        }

        return Response.json({ steps: fallbackSteps }, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: STEP CELEBRATION (Verbal Dopaminergic Reinforcement)
    // =========================================================================
    if (url.pathname === "/api/step-celebration" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const completed = body.completedStep || "Step";
        const clean = completed.replace(/^(\d+\.?\s*|[-•*]\s*)/, '').trim();
        const match = clean.match(/^([A-Z]{3,})\s+(.*)/i);
        const fallback = match
          ? `Great job completing ${match[1].toLowerCase()} ${match[2].slice(0, 35)}! Keep that momentum going.`
          : `Step completed successfully! Let's move on to the next target.`;

        try {
          const sys = `You are FocusBud from NeuroSynk. The user just completed a micro-step.
Write a brief, enthusiastic, warm, and motivating sentence in English (maximum 12 words) acknowledging the specific action mastered.
No quotes, no asterisks. Strictly in English.`;
          const text = await callAIModel(`Completed step: "${completed}"`, sys, env, request, 0.8, 4096);
          const cleanText = text.replace(/["*]/g, '').trim();
          if (cleanText.length > 5) {
            return Response.json({ phrase: cleanText }, { headers: CORS_HEADERS });
          }
        } catch {}

        return Response.json({ phrase: fallback }, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: SUBDIVIDE STEP (Atomic Cognitive Rescue)
    // =========================================================================
    if (url.pathname === "/api/subdivide-step" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const parent = body.parentStep || "Active step";
        const fallback = [
          "PICK UP your pen or place your cursor directly in your workspace.",
          "LOCATE just the very first line or introductory concept.",
          "WRITE the first keyword to break initial inertia."
        ];

        try {
          const sys = `You are NeuroSynk's Executive Rescue Specialist.
The user feels stuck or overwhelmed by this step: "${parent}".
Break this step into exactly 3 atomic nano-steps in English, each executable in under 60 seconds.
Every nano-step MUST start with an ACTION VERB IN ALL CAPS.
Respond ONLY in JSON with the key "subSteps": array of 3 strings in English.`;
          const text = await callAIModel(`Blocked step: "${parent}"`, sys, env, request, 0.7, 4096);
          const data = extractJsonFromText(text);
          const rawSub = data?.subSteps || data?.steps || data?.nanoSteps || (Array.isArray(data) ? data : null);
          if (Array.isArray(rawSub) && rawSub.length >= 2) {
            const normalized = rawSub.map(normalizeStepItem).filter(Boolean).slice(0, 4);
            if (normalized.length >= 2) {
              return Response.json({ subSteps: normalized }, { headers: CORS_HEADERS });
            }
          }
        } catch {}

        return Response.json({ subSteps: fallback }, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: MUSE WONDER DECOMPOSE
    // =========================================================================
    if (url.pathname === "/api/meta/muse-wonder/decompose" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const task = body.task || "Current task";
        const fallback = {
          nanoSteps: [
            `DEFINE the first keyword or starting concept of "${task}".`,
            'OPEN your document or notebook and write a single introductory sentence.',
            'ADVANCE through the first paragraph without judging perfection; we will protect your flow.'
          ],
          estimatedSecondsPerStep: 45
        };

        try {
          const sys = `You are Meta Muse Wonder. Decompose the task "${task}" into 3 nano-steps in English executable in under 60 seconds each.
Every nano-step MUST start with an ACTION VERB IN ALL CAPS.
Respond ONLY with JSON containing keys "nanoSteps" (array of 3 strings in English) and "estimatedSecondsPerStep" (number 30 to 60).`;
          const text = await callAIModel(`Task: "${task}"`, sys, env, request, 0.7, 4096);
          const data = extractJsonFromText(text);
          const rawNano = data?.nanoSteps || data?.steps || data?.subSteps || (Array.isArray(data) ? data : null);
          if (Array.isArray(rawNano) && rawNano.length > 0) {
            const normalized = rawNano.map(normalizeStepItem).filter(Boolean);
            if (normalized.length > 0) {
              return Response.json({
                nanoSteps: normalized,
                estimatedSecondsPerStep: data.estimatedSecondsPerStep || 45
              }, { headers: CORS_HEADERS });
            }
          }
        } catch {}

        return Response.json(fallback, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: MUSE SPARK STREAM (Proactive Streaming Intervention)
    // =========================================================================
    if (url.pathname === "/api/meta/muse-spark/stream" && request.method === "POST") {
      try {
        const payload: any = await request.json();
        let fallback = 'MAINTAIN your pace. Take a 3-second deep breath and stay focused.';
        if (payload.perclos > 25 || payload.fatigueScore > 50) {
          fallback = 'REST your eyes 20 seconds away from the screen. Protecting your energy.';
        } else if (payload.postureScore > 40) {
          fallback = 'ALIGN your shoulders and lift your chin. Good posture sharpens clarity.';
        }

        let reply = fallback;
        try {
          const sys = `You are Meta Muse Spark. Your user is working on "${payload.currentTask}".
Current biometric metrics: PERCLOS: ${payload.perclos || 0}%, Fatigue: ${payload.fatigueScore || 0}%, Postural strain: ${payload.postureScore || 0}%, State: ${payload.cognitiveClass || 'Study'}.
Generate an empathetic, direct verbal intervention in English (maximum 12 words) starting with an ACTION VERB IN ALL CAPS to guide their attention or posture.
No quotes and no meta-commentary.`;
          const text = await callAIModel("Brief intervention", sys, env, request, 0.7, 550);
          const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#"`]/g, '').trim();
          if (clean.length > 5 && !/Starts with an? uppercase|Need to consider:|Count:\s*\d|User prompt:/i.test(clean)) {
            reply = clean;
          }
        } catch {}

        // Stream the response back in chunks
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const words = reply.split(" ");
            let i = 0;
            const interval = setInterval(() => {
              if (i < words.length) {
                controller.enqueue(encoder.encode((i > 0 ? " " : "") + words[i]));
                i++;
              } else {
                clearInterval(interval);
                controller.close();
              }
            }, 30);
          }
        });

        return new Response(stream, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked"
          }
        });
      } catch {
        return new Response("MAINTAIN your focus. We are moving forward step by step.", { headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: CHAT (Co-Presence Mentor with Biometric Telemetry)
    // =========================================================================
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const message = body.message || (Array.isArray(body.messages) ? body.messages[body.messages.length - 1]?.content : '') || "Hello";
        const currentStep = body.currentStep || "Current step";
        const taskContext = body.taskContext || "";
        const telemetry = body.telemetry;

        try {
          let sys = `You are NeuroSynk's Co-Presence Mentor powered by Meta Muse Spark.
The user is focused on: "${taskContext}".
Current step: "${currentStep}".
Reply in under 28 words in English, directly, empathetically, and motivatingly.
ALWAYS start with an ACTION VERB IN ALL CAPS focused on immediate action.
No complex formatting or long lists.`;

          if (telemetry && typeof telemetry === 'object') {
            const state = String(telemetry.cognitiveState || '').toUpperCase();
            const focus = Number(telemetry.focusScore ?? 100);
            const stress = Number(telemetry.stressLevel ?? 0);

            if (state.includes('FATIGUE') || state.includes('FATIGA') || focus < 35) {
              sys += `\n[DETECTED STATE: COGNITIVE FATIGUE (Focus ${focus}%)]. The user is tired. Respond with extreme calm and gentleness, using low cognitive load.`;
            } else if (state.includes('STRAIN') || state.includes('OVERSTIM') || state.includes('AGOBIO') || stress > 70) {
              sys += `\n[DETECTED STATE: OVERLOAD / STRAIN (Tension ${stress}%)]. Act as a calming somatic anchor. Ask them to take just one atomic micro-step at a time.`;
            } else if (state.includes('FLOW') || focus > 80) {
              sys += `\n[DETECTED STATE: DEEP FLOW]. Reply in UNDER 12 DIRECT WORDS to protect their concentration.`;
            } else if (state.includes('DISTRA') || focus < 50) {
              sys += `\n[DETECTED STATE: DISTRACTION]. Gently guide attention back to the active step.`;
            }
          }

          const prompt = `User question: "${message}"`;
          const text = await callAIModel(prompt, sys, env, request, 0.7, 600);
          const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#]/g, '').trim();
          if (cleanText.length > 3) {
            return Response.json({ reply: cleanText }, { headers: CORS_HEADERS });
          }
        } catch (e) {
          console.warn("[Worker /api/chat fallback]:", e);
        }

        return Response.json({ reply: "ADVANCE through the first detail of this step. We are in this sprint together." }, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: SESSION DEBRIEF (Cognitive Wrap-Up & Reflection)
    // =========================================================================
    if (url.pathname === "/api/session-debrief" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const task = body.task || "Work Session";
        const completed = body.completedStepsCount || 0;
        const total = body.totalStepsCount || 0;
        const focus = body.averageFocus || 80;
        const fallback = `SESSION COMPLETE: You finished ${completed} of ${total} steps on "${task}". Your average focus stayed at ${focus}%. Outstanding persistence. Take 5 minutes to stretch and rest your eyes.`;

        try {
          const sys = `You are NeuroSynk's Mentor. Write a concise closing debrief in English (maximum 45 words) covering pace balance, completed steps, and a somatic recovery recommendation.`;
          const text = await callAIModel(`Task: "${task}", Steps: ${completed}/${total}, Average focus: ${focus}%`, sys, env, request, 0.7, 600);
          const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#]/g, '').trim();
          if (cleanText.length > 10) {
            return Response.json({ debrief: cleanText }, { headers: CORS_HEADERS });
          }
        } catch {}

        return Response.json({ debrief: fallback }, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // =========================================================================
    // API: ERGONOMIC / BIOMECHANICAL CALIBRATION (Edge Privacy)
    // =========================================================================
    if (url.pathname === "/api/meta/sam/calibrate") {
      let body: any = {};
      if (request.method === "POST") {
        try {
          body = await request.json();
        } catch {}
      }
      const headTiltAngle = typeof body.rollAngle === "number" ? Math.round(body.rollAngle * 10) / 10 : 0;
      const shoulderRaw = typeof body.shoulderAngle === "number" ? body.shoulderAngle : 180;
      const shoulderDeviation = Math.min(45, Math.abs(180 - shoulderRaw));
      const shoulderAlignmentScore = Math.max(55, Math.min(100, Math.round(100 - shoulderDeviation * 1.2)));
      const stressLevel = typeof body.stressLevel === "number" ? body.stressLevel : 12;
      const clutterScore = Math.max(5, Math.min(60, Math.round(stressLevel * 0.4 + 8)));
      const distanceMetric = Math.abs(headTiltAngle) > 15 ? "TOO_CLOSE" : "OPTIMAL";

      const recommendations: string[] = [];
      if (Math.abs(headTiltAngle) > 8) {
        recommendations.push(`Gently straighten your neck tilt (${headTiltAngle}°) to release cervical tension.`);
      } else {
        recommendations.push("Eye line aligned with the top third of your monitor.");
      }
      if (shoulderAlignmentScore < 85) {
        recommendations.push("Level both shoulders and rest your forearms to sustain your Flow state.");
      } else {
        recommendations.push("Shoulders level and ergonomic workspace ready for your sprint.");
      }

      return Response.json({
        provider: "local-edge-biomechanical",
        isCalibrated: shoulderAlignmentScore >= 75 && Math.abs(headTiltAngle) <= 15,
        distanceMetric,
        headTiltAngle,
        shoulderAlignmentScore,
        clutterScore,
        recommendations
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // API: MODEL INFO
    // =========================================================================
    if (url.pathname === "/api/model-info") {
      return Response.json({
        model_name: "NeuroSynk Definitive Pure AI Core v3.0",
        version: "3.0.0-puro-real",
        architecture: "Dense-64 (BN) -> Dense-32 (BN) -> Dense-16 -> Softmax-6",
        input_dimensions: 12,
        output_classes: 6,
        samples_count: 10739,
        accuracy: "93.64%",
        loss: "0.1842",
        classes: [
          "NORMAL STUDY / NEUTRAL",
          "DEEP FOCUS (FLOW)",
          "DISTRACTION",
          "FATIGUE",
          "OVERSTIMULATION",
          "POSTURAL STRAIN"
        ]
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // STATIC ASSETS FALLBACK (Vite SPA)
    // =========================================================================
    return env.ASSETS.fetch(request);
  }
};
