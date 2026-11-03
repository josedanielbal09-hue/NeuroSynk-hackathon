import React, { useEffect, useRef, useState } from 'react';
import { Activity, BrainCircuit, CheckCircle, Target, ArrowRight, Play, Pause, Eye, EyeOff, Timer, MessageSquare, Send, Settings, Sparkles, Cpu, ShieldCheck, Headphones, Volume2, Sliders, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadNeuroSynkBrain, evaluateAIBiometrics, AIPredictionResult } from './services/aiInference';
import { FocusBudWidget } from './components/avatar/FocusBudWidget';
import { FocusState } from './config/avatarConfig';
import { getBudContextualMessage } from './utils/budMessages';
import { brownNoise } from './utils/audioEngine';
import { audioService } from './services/audioService';
import { avatarBridge } from './services/avatarBridge';
import { GroundingBreak } from './components/GroundingBreak';
import { GeminiHeroInput } from './components/home/GeminiHeroInput';
import { CollapsibleSidebar, SavedSessionItem } from './components/navigation/CollapsibleSidebar';
import { saveSessionItem } from './services/sessionHistoryService';
import { PreWarmupScreen, WarmupStep } from './components/PreWarmupScreen';
import {
  chatUniversal,
  taskSurveyUniversal,
  splitTaskUniversal,
  subdivideStepUniversal,
  testGeminiConnection,
  sanitizeApiKey,
  streamMuseSparkIntervention,
  sessionDebriefUniversal,
  celebrateStepUniversal,
  BiometricTelemetryPayload,
  SessionDebriefResult
} from './services/metaModelClient';
import { KawaiiRewardCelebration, REWARD_ARCHETYPES } from './components/rewards/KawaiiRewardCelebration';


declare global {
  interface Window {
    Holistic: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    FACEMESH_TESSELATION: any;
    FACEMESH_CONTOURS: any;
    FACEMESH_RIGHT_EYE: any;
    FACEMESH_RIGHT_EYEBROW: any;
    FACEMESH_LEFT_EYE: any;
    FACEMESH_LEFT_EYEBROW: any;
    FACEMESH_FACE_OVAL: any;
    FACEMESH_LIPS: any;
    POSE_CONNECTIONS: any;
  }
}



interface NeuroMascotProps {
  expression?: 'normal' | 'blink' | 'happy';
  size?: number;
}

function NeuroMascot({ expression = 'normal', size = 120 }: NeuroMascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="drop-shadow-[0_0_25px_rgba(34,197,94,0.5)] transition-all duration-300"
    >
      {/* Cuerpo circular negro con contorno verde neón */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="#09090b"
        stroke="#22c55e"
        strokeWidth="4"
      />

      {/* Ojos expresivos minimalistas */}
      <g>
        {expression === 'normal' && (
          <>
            {/* Ojo izquierdo */}
            <motion.ellipse
              cx="36"
              cy="48"
              rx="5"
              ry="9"
              fill="white"
              initial={{ scaleY: 1 }}
              animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
              transition={{ repeat: Infinity, duration: 3, repeatDelay: 1.5 }}
            />
            {/* Ojo derecho */}
            <motion.ellipse
              cx="64"
              cy="48"
              rx="5"
              ry="9"
              fill="white"
              initial={{ scaleY: 1 }}
              animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
              transition={{ repeat: Infinity, duration: 3, repeatDelay: 1.5 }}
            />
          </>
        )}
        {expression === 'blink' && (
          <>
            <path
              d="M 31,48 L 41,48"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 59,48 L 69,48"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </>
        )}
        {expression === 'happy' && (
          <>
            <path
              d="M 31,51 Q 36,43 41,51"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 59,51 Q 64,43 69,51"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
    </svg>
  );
}

const mapAIPredictionToAvatarState = (className?: string): FocusState => {
  switch (className) {
    case 'ENFOQUE PROFUNDO (FLOW)':
    case 'ESTUDIO NORMAL / NEUTRO':
    case 'ENFOQUE':
      return 'ENFOQUE';
    case 'DISTRACCIÓN':
    case 'SOBREESTIMULACIÓN':
      return 'ALERTA_SUAVE';
    case 'FATIGA':
      return 'FATIGA';
    case 'AGOBIO POSTURAL':
      return 'PARALISIS';
    default:
      return 'ENFOQUE';
  }
};

interface SurveyQuestion {
  id: string;
  question: string;
  options: string[];
}

const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
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
];

type TimerMode = 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';

export default function App() {
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Estados de la Encuesta Dinámica de Calibración de Contexto
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [showSurvey, setShowSurvey] = useState<boolean>(false);
  const [isSurveyLoading, setIsSurveyLoading] = useState<boolean>(false);

  // Temporizador Pomodoro Adaptable
  const [workDuration, setWorkDuration] = useState<number>(25 * 60);
  const [breakDuration, setBreakDuration] = useState<number>(5 * 60);
  const [timerMode, setTimerMode] = useState<TimerMode>('WORK');
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [completedBlocks, setCompletedBlocks] = useState<number>(0);
  const [totalTargetBlocks, setTotalTargetBlocks] = useState<number>(2);

  // Configuración de audio
  const [isBrownNoiseActive, setIsBrownNoiseActive] = useState<boolean>(false);
  const [noiseVolume, setNoiseVolume] = useState<number>(0.3);
  const [isTimerConfigOpen, setIsTimerConfigOpen] = useState<boolean>(false);

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isPreWarmupVisible, setIsPreWarmupVisible] = useState(true);
  const [warmupProgress, setWarmupProgress] = useState(25);
  const [warmupSteps, setWarmupSteps] = useState<WarmupStep[]>([
    { id: 'webgl', label: 'Motor Neural WebGL (TensorFlow.js)', status: 'loading', detail: 'COMPILANDO' },
    { id: 'mediapipe', label: 'Visión Biomecánica (MediaPipe Holistic)', status: 'pending' },
    { id: 'camera', label: 'Sensor Óptico y Calibración Basal', status: 'pending' }
  ]);
  const hasFirstLandmarkRef = useRef(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mascotExpression, setMascotExpression] = useState<'normal' | 'blink' | 'happy'>('normal');
  const [proposedChange, setProposedChange] = useState<{ proposedTask: string; proposedSteps: string[] } | null>(null);

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    const isCleared = localStorage.getItem('gemini_api_key_cleared') === 'true';
    const stored = localStorage.getItem('gemini_api_key');
    if (stored !== null && stored !== '') return stored;
    if (isCleared) return '';
    return typeof process !== 'undefined' && (process.env as any)?.GEMINI_API_KEY
      ? (process.env as any).GEMINI_API_KEY
      : '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);

  const handleStartNewSession = () => {
    // Si la sesión anterior tuvo avance, asegurar que quede grabada en el historial
    if (currentSessionIdRef.current && (elapsedTimeRef.current > 15 || currentStepIdx > 0)) {
      const focusHistory = focusSamplesRef.current;
      const avgFocus = focusHistory.length > 0
        ? Math.round(focusHistory.reduce((a, b) => a + b, 0) / focusHistory.length)
        : Math.round(metricsRef.current.nivel_clap);
      saveSessionItem({
        id: currentSessionIdRef.current,
        task: task || 'Sesión de Trabajo',
        timestamp: Date.now(),
        durationMinutes: Math.max(1, Math.round(elapsedTimeRef.current / 60)),
        completedSteps: currentStepIdx,
        totalSteps: steps.length,
        avgFocus: avgFocus,
        status: currentStepIdx >= steps.length ? 'COMPLETADA' : 'EN_PROGRESO'
      });
    }
    currentSessionIdRef.current = null;

    setIsStarted(false);
    setShowSurvey(false);
    setAppStage('LOGIN');
    setTask('');
    setSteps([]);
    setCurrentStepIdx(0);
    setChatMessages([]);
    setSessionDebrief(null);
    debriefRequestedRef.current = false;
    elapsedTimeRef.current = 0;
    setElapsedTime(0);
    setIsPaused(false);
    setTimerSecondsLeft(workDuration);
    setTimerMode('WORK');
    setCompletedBlocks(0);
    setIsShowingReward(false);
    setIsDebriefLoading(false);
    focusSamplesRef.current = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleSelectPastSession = (item: SavedSessionItem) => {
    setTask(item.task);
    setIsStarted(false);
    setShowSurvey(false);
    setAppStage('LOGIN');
    setSteps([]);
    setCurrentStepIdx(0);
    setChatMessages([]);
    setSessionDebrief(null);
    debriefRequestedRef.current = false;
  };
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [apiStatus, setApiStatus] = useState<'browser' | 'server' | 'none'>('server');

  useEffect(() => {
    setApiStatus('server');
  }, []);


  // Chat States
  const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([
    { role: 'assistant', content: '¿Duda rápida? Pregunta y no pierdas el flujo.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // NÚCLEO PDEF v1.0 State
  const metricsRef = useRef({
    blinks: [] as number[],
    is_blinking: false,
    gaze_history: [] as { x: number, y: number, t: number }[],
    distraction_start: null as number | null,
    stress_events: [] as { timestamp: number, weight: number, reason: string }[],
    frown_accumulated_ms: 0,
    hands_accumulated_ms: 0,
    last_frame_time: 0,
    last_blink_penalty: 0,
    last_auto_chat: 0,
    calibration_start: null as number | null,

    calib_frames: 0,
    calib_ear_sum: 0,
    calib_frown_sum: 0,
    calib_yaw_sum: 0,
    calib_pitch_sum: 0,
    baseline_ear: 0.2,
    baseline_frown: 0.22,
    baseline_yaw: 0.5,
    baseline_pitch: 0.5,

    // Subdivisión de tareas
    subdivided_indexes: [] as number[],
    is_subdividing: false,

    // UI mapped properties
    nivel_clap: 100.0,
    nivel_carga: 0.0,
  });

  // Estado del Motor de Red Neuronal TensorFlow.js
  const [isAIBrainReady, setIsAIBrainReady] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResult | null>(null);
  const windowFramesRef = useRef<{ ear: number; yaw: number; pitch: number; frown: number; noseDelta: number; gazeVar: number; shoulder: number; mar: number; roll: number; t: number }[]>([]);
  const lastNoseRef = useRef<{ x: number; y: number } | null>(null);
  const lastAiUpdateRef = useRef<number>(0);
  const displayedClassRef = useRef<number>(0);
  const pendingClassRef = useRef<number | null>(null);
  const pendingClassSinceRef = useRef<number>(0);

  // Carga inicial del cerebro IA y pre-compilación de shaders WebGL
  useEffect(() => {
    loadNeuroSynkBrain().then(res => {
      setIsAIBrainReady(res.isReady);
      if (res.isReady) {
        setWarmupSteps(prev => prev.map(s => s.id === 'webgl' ? { ...s, status: 'completed', detail: '60 FPS' } : (s.id === 'mediapipe' ? { ...s, status: 'loading', detail: 'WASM ACTIVO' } : s)));
        setWarmupProgress(prev => Math.max(prev, 50));
      }
    });
  }, []);

  // Estado de higiene postural local determinista (100% Edge Privacy)
  const [postureHygiene, setPostureHygiene] = useState<{
    status: 'OPTIMAL' | 'NECK_TILT' | 'SHOULDER_TENSION';
    label: string;
    color: string;
    bg: string;
  }>({
    status: 'OPTIMAL',
    label: 'Postura Óptima',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-800/40'
  });
  const lastPostureUpdateRef = useRef<number>(0);

  // Streaming y voz de micro-intervención de Muse Spark hacia FocusBud
  const isBudStreamingRef = useRef<boolean>(false);
  const [isBudSpeaking, setIsBudSpeaking] = useState<boolean>(false);
  const isBudSpeakingAudioRef = useRef<boolean>(false);
  const lastSpokenTimeRef = useRef<number>(0);

  /**
   * Helper unificado para que FocusBud hable de forma autónoma con síntesis de voz real en español
   * y sincronice su boca animada y el bocadillo visual superior.
   */
  const speakFocusBud = (text: string, options?: { rate?: number; pitch?: number; force?: boolean }) => {
    if (!text || typeof window === 'undefined') return;
    const now = Date.now();
    // Prevenir colisiones o spam si ya está hablando (a menos que sea forzado)
    if (!options?.force && (isBudSpeakingAudioRef.current || (now - lastSpokenTimeRef.current < 3500))) {
      setBudMessage(text);
      return;
    }

    lastSpokenTimeRef.current = now;
    isBudSpeakingAudioRef.current = true;
    setIsBudSpeaking(true);
    setBudMessage(text);

    audioService.speak(text, {
      rate: options?.rate ?? 1.0,
      pitch: options?.pitch ?? 1.08,
      onStart: () => {
        setIsBudSpeaking(true);
        isBudSpeakingAudioRef.current = true;
      },
      onEnd: () => {
        setIsBudSpeaking(false);
        isBudSpeakingAudioRef.current = false;
        setTimeout(() => {
          setBudMessage(prev => (prev === text ? '' : prev));
        }, 3200);
      }
    });
  };


  // Métricas acumuladas para el debriefing cognitivo post-sesión
  const focusSamplesRef = useRef<number[]>([]);
  const flowSamplesCountRef = useRef<number>(0);
  const fatigueEventsCountRef = useRef<number>(0);
  const [sessionDebrief, setSessionDebrief] = useState<string | null>(null);
  const [isDebriefLoading, setIsDebriefLoading] = useState<boolean>(false);
  const debriefRequestedRef = useRef<boolean>(false);

  // Helper para extraer telemetría biométrica local anónima para el Mentor IA
  const getBiometricTelemetry = (): BiometricTelemetryPayload => ({
    cognitiveState: aiPrediction?.className || 'NEUTRO',
    focusScore: Math.round(metricsRef.current.nivel_clap),
    stressLevel: Math.round(metricsRef.current.nivel_carga),
    sessionMinutes: Math.round(elapsedTimeRef.current / 60),
    postureState: postureHygiene.status
  });

  const [appStage, setAppStage] = useState<'LOGIN' | 'BRIEFING' | 'FOCUS'>('LOGIN');
  const [briefingMsgs, setBriefingMsgs] = useState<{ role: string, content: string }[]>([]);
  const [briefingInput, setBriefingInput] = useState('');

  const [workMode, setWorkMode] = useState<'pantalla' | 'lectura' | 'flexible'>('pantalla');
  const workModeRef = useRef<'pantalla' | 'lectura' | 'flexible'>('pantalla');
  const [sensitivity, setSensitivity] = useState<'estricto' | 'normal' | 'relajado'>('normal');
  const sensitivityRef = useRef<'estricto' | 'normal' | 'relajado'>('normal');

  useEffect(() => {
    workModeRef.current = workMode;
  }, [workMode]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const rewardTimeoutRef = useRef<number | null>(null);

  // Sync ref for MediaPipe callback
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const currentStepIdxRef = useRef(0);
  useEffect(() => {
    currentStepIdxRef.current = currentStepIdx;
  }, [currentStepIdx]);

  const subdivideCurrentStepRef = useRef<(stepIdx: number) => Promise<void>>(async () => { });
  useEffect(() => {
    subdivideCurrentStepRef.current = async (stepIdx: number) => {
      const metrics = metricsRef.current;
      if (metrics.is_subdividing || metrics.subdivided_indexes.includes(stepIdx)) return;

      metrics.is_subdividing = true;
      metrics.subdivided_indexes.push(stepIdx);

      const parentStepText = steps[stepIdx];
      if (!parentStepText) {
        metrics.is_subdividing = false;
        return;
      }

      // Evitar subdividir un sub-paso ya existente (ej. "3.1") para no saturar la lista
      const isAlreadySubStep = /\b\d+\.\d+\b/.test(parentStepText);
      if (isAlreadySubStep) {
        metrics.is_subdividing = false;
        return;
      }

      setIsChatLoading(true);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚙️ Analizando dificultad del paso actual... Vamos a desglosar "${parentStepText}" en metas más pequeñas.`
      }]);

      try {
        const data = await subdivideStepUniversal(
          parentStepText,
          task,
          stepIdx + 1,
          geminiApiKey
        );

        if (data.subSteps && Array.isArray(data.subSteps) && data.subSteps.length > 0) {
          setSteps(prevSteps => {
            const nextSteps = [...prevSteps];
            nextSteps.splice(stepIdx, 1, ...data.subSteps);
            return nextSteps;
          });

          metrics.nivel_clap = Math.min(100, metrics.nivel_clap + 30);

          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `💡 ¡Listo! He subdividido el paso en 3 metas más sencillas:
${data.subSteps.map((s: string) => `• ${s}`).join('\n')}

Concentrémonos en el primer sub-paso. ¡Tú puedes!`
          }]);
        } else {
          throw new Error("Respuesta no válida");
        }
      } catch (err) {
        console.error("Error subdividing step:", err);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ No pude desglosar el paso automáticamente, pero recuerda que puedes tomar un breve respiro si lo necesitas.`
        }]);
      } finally {
        setIsChatLoading(false);
        metrics.is_subdividing = false;
      }
    };
  }, [steps, task, isChatLoading, geminiApiKey]);

  // Keyboard Listener (Q to pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isStarted && e.key.toLowerCase() === 'q') {
        setIsPaused(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStarted]);

  // Cleanup reward timeout on unmount
  useEffect(() => {
    return () => {
      if (rewardTimeoutRef.current) {
        clearTimeout(rewardTimeoutRef.current);
      }
    };
  }, []);

  // Separate Timer logic with Pause control (Total Session Time - Zero Re-renders during session)
  const elapsedTimeRef = useRef<number>(0);
  useEffect(() => {
    let timerInterval: any;
    if (isStarted && currentStepIdx < steps.length && !isPaused) {
      timerInterval = setInterval(() => {
        elapsedTimeRef.current += 1;
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isStarted, currentStepIdx, steps.length, isPaused]);

  // Disparo del Debriefing Cognitivo Post-Sesión al completar todos los pasos
  useEffect(() => {
    if (steps.length > 0 && currentStepIdx >= steps.length && !debriefRequestedRef.current) {
      debriefRequestedRef.current = true;
      setElapsedTime(elapsedTimeRef.current);
      setIsDebriefLoading(true);

      const focusHistory = focusSamplesRef.current;
      const avgFocus = focusHistory.length > 0
        ? Math.round(focusHistory.reduce((a, b) => a + b, 0) / focusHistory.length)
        : Math.round(metricsRef.current.nivel_clap);

      const totalMins = Math.max(1, Math.round(elapsedTimeRef.current / 60));
      const flowPct = focusHistory.length > 0
        ? Math.min(100, Math.round((flowSamplesCountRef.current / focusHistory.length) * 100))
        : 65;

      sessionDebriefUniversal({
        task: task || 'Sesión de Trabajo',
        totalMinutes: totalMins,
        completedStepsCount: steps.length,
        totalStepsCount: steps.length,
        averageFocus: avgFocus,
        flowPercentage: flowPct,
        fatigueEventsCount: fatigueEventsCountRef.current
      }).then(res => {
        setSessionDebrief(res.debrief);

        // Guardar sesión completada con debriefing en historial local
        const finalSessionId = currentSessionIdRef.current || `session-${Date.now()}`;
        saveSessionItem({
          id: finalSessionId,
          task: task || 'Sesión de Trabajo',
          timestamp: Date.now(),
          durationMinutes: totalMins,
          completedSteps: steps.length,
          totalSteps: steps.length,
          avgFocus: avgFocus,
          debriefSummary: res.debrief,
          status: 'COMPLETADA'
        });

        // FocusBud sintetiza el debriefing con voz empática en español (5 a 8 segundos)
        const spokenDebrief = `¡Sesión completada con éxito! Has finalizado todos los pasos de ${task || 'tu meta'}. Tu enfoque promedio fue de ${avgFocus} por ciento. ¡Excelente constancia!`;
        speakFocusBud(spokenDebrief, { force: true, rate: 0.98 });
      }).catch(err => {
        console.warn("[Debrief Error]:", err);
        const fallback = `SESIÓN CONCLUIDA: Has completado todos los pasos de "${task}". Tu enfoque promedio fue de ${avgFocus}%. Respira hondo y felicítate por este avance tangible.`;
        setSessionDebrief(fallback);

        const finalSessionId = currentSessionIdRef.current || `session-${Date.now()}`;
        saveSessionItem({
          id: finalSessionId,
          task: task || 'Sesión de Trabajo',
          timestamp: Date.now(),
          durationMinutes: totalMins,
          completedSteps: steps.length,
          totalSteps: steps.length,
          avgFocus: avgFocus,
          debriefSummary: fallback,
          status: 'COMPLETADA'
        });

        const spokenFallback = `¡Sesión terminada! Buen trabajo con todos tus pasos. Descansa la mente y estira un poco.`;
        speakFocusBud(spokenFallback, { force: true, rate: 0.98 });
      }).finally(() => {
        setIsDebriefLoading(false);
      });

    }
  }, [currentStepIdx, steps.length, elapsedTime, task]);

  // Controles de Audio Ambiental (Ruido Marrón)
  const toggleBrownNoise = () => {
    if (isBrownNoiseActive) {
      brownNoise.stop();
      setIsBrownNoiseActive(false);
    } else {
      brownNoise.start(noiseVolume);
      setIsBrownNoiseActive(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setNoiseVolume(newVol);
    brownNoise.setVolume(newVol);
  };

  const handleSkipBreak = () => {
    setTimerMode('WORK');
    setTimerSecondsLeft(workDuration);
    if (isBrownNoiseActive) {
      brownNoise.start(noiseVolume);
    }
  };

  const handleTriggerTestGrounding = () => {
    // Si ya está en descanso, regresa a trabajo; si está en trabajo, activa el descanso
    if (timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK') {
      setTimerMode('WORK');
      setTimerSecondsLeft(workDuration || 25 * 60);
      if (isBrownNoiseActive) {
        brownNoise.start(noiseVolume);
      }
    } else {
      if (isBrownNoiseActive) {
        brownNoise.stop();
      }
      setTimerMode('SHORT_BREAK');
      setTimerSecondsLeft(breakDuration || 5 * 60);
    }
  };

  // Ciclo del Temporizador Pomodoro Adaptable
  useEffect(() => {
    let timerInterval: any = null;
    if (isStarted && isTimerRunning && !isPaused) {
      timerInterval = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            // Cambio de modo al llegar a 0
            if (timerMode === 'WORK') {
              setCompletedBlocks(c => c + 1);
              if (isBrownNoiseActive) {
                brownNoise.stop();
              }
              setTimerMode('SHORT_BREAK');
              return breakDuration;
            } else {
              setTimerMode('WORK');
              if (isBrownNoiseActive) {
                brownNoise.start(noiseVolume);
              }
              return workDuration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isStarted, isTimerRunning, isPaused, timerMode, workDuration, breakDuration, isBrownNoiseActive, noiseVolume]);

  // Detener audio al desmontar
  useEffect(() => {
    return () => {
      brownNoise.stop();
    };
  }, []);

  // UX states for Micro-rewards (Paso 7/8: Celebración Kawaii Anime 60 FPS)
  const [rewardKaomoji, setRewardKaomoji] = useState('');
  const [isShowingReward, setIsShowingReward] = useState(false);
  const [rewardArchetypeIdx, setRewardArchetypeIdx] = useState(0);
  const [isStateLocked] = useState(false);
  const mascotExpressionRef = useRef<'normal' | 'blink' | 'happy'>('normal');
  const KAOMOJIS = ["(๑˃̵ᴗ˂̵)و 🚀", "✨ ESTELAR ✨", "🌸 FLUIDO 🌸", "⚡️ ENERGÍA ⚡️", "(ง'̀-'́)ง ⚡️"];

  // Notificaciones Contextuales de FocusBud (Body Doubling - Fase 4)
  const stepDistractionsRef = useRef<number>(0);
  const prevAvatarStateRef = useRef<FocusState>('ENFOQUE');

  const isBreakActive = timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK';

  const currentFocusState: FocusState = (isBreakActive || isPaused)
    ? 'PAUSA'
    : isShowingReward
    ? 'CELEBRACION'
    : mapAIPredictionToAvatarState(aiPrediction?.className);

  // Estado biométrico directo emitido por la Red Neuronal (ej. 'AGOBIO POSTURAL', 'SOBREESTIMULACIÓN', 'ENFOQUE')
  const rawAIState = (isBreakActive || isPaused)
    ? 'PAUSA'
    : isShowingReward
    ? 'CELEBRACION'
    : (aiPrediction?.className || 'ENFOQUE');

  const currentActiveStep = steps[currentStepIdx] || '';
  const [budMessage, setBudMessage] = useState<string>(() =>
    getBudContextualMessage('ENFOQUE', { stepText: '', distractionCount: 0 })
  );

  useEffect(() => {
    if (isBudStreamingRef.current) return;
    if (isBreakActive) {
      setBudMessage("Buen trabajo. Terminamos este bloque. Toca descansar un poco.");
      return;
    }

    if (currentFocusState === 'ALERTA_SUAVE' && prevAvatarStateRef.current !== 'ALERTA_SUAVE') {
      stepDistractionsRef.current += 1;
    }
    prevAvatarStateRef.current = currentFocusState;

    const msg = getBudContextualMessage(rawAIState, {
      stepText: currentActiveStep,
      distractionCount: stepDistractionsRef.current
    });
    setBudMessage(msg);
  }, [rawAIState, currentFocusState, currentStepIdx, steps, currentActiveStep, isBreakActive]);

  // Reiniciar contador de distracciones al cambiar o completar un paso
  useEffect(() => {
    stepDistractionsRef.current = 0;
  }, [currentStepIdx]);




  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const msgsForAi = [...chatMessages, { role: 'user', content: userMsg }];
      const data = await chatUniversal(
        msgsForAi,
        geminiApiKey,
        steps[currentStepIdx] || 'Preparación general',
        task || 'Estudio / Trabajo',
        getBiometricTelemetry()
      );

      const replyText = typeof data.reply === 'string' ? data.reply : "⚠️ Error de decodificación neuronal.";

      setChatMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      if (data.proposal) {
        setProposedChange(data.proposal);
      }

      // FocusBud vocaliza en vivo la primera frase de la respuesta (3-5 segundos)
      const firstSentence = replyText.split(/[.!?]\s+/)[0] || replyText;
      const cleanVoice = firstSentence.replace(/[*_#"`]/g, '').trim();
      if (cleanVoice.length > 4 && !cleanVoice.startsWith('⚠️')) {
        const spokenShort = cleanVoice.length > 85 ? cleanVoice.substring(0, 80) + '...' : cleanVoice;
        speakFocusBud(spokenShort, { force: true, rate: 1.04 });
      }

    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Enlace neuronal inestable.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Performance Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holisticRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const lastFrameProcessTimeRef = useRef<number>(0);

  // HUD Stat Refs and variables
  const focusRef = useRef<HTMLDivElement>(null);
  const fatigueRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);



  // Automated System Intervention (Stress trigger to AI)
  const interventionRef = useRef((info: string) => { });
  useEffect(() => {
    interventionRef.current = async (info: string) => {
      if (isChatLoading) return;
      setIsChatLoading(true);
      try {
        const sysMsg = { role: 'system', content: info };
        const currentMsgs = chatMessages.map(m => ({ role: m.role, content: m.content }));
        const data = await chatUniversal(
          [...currentMsgs, sysMsg],
          geminiApiKey,
          steps[currentStepIdx] || 'Trabajo en curso',
          task || 'General',
          getBiometricTelemetry()
        );
        if (data.reply) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        }
      } catch (e) {
        console.error("Intervention error:", e);
      } finally {
        setIsChatLoading(false);
      }
    };
  }, [chatMessages, isChatLoading, geminiApiKey, steps, currentStepIdx, task, aiPrediction, postureHygiene]);

  const isSystemBooted = useRef(false);

  const surveyAnswersRef = useRef<Record<string, string>>({});
  useEffect(() => {
    surveyAnswersRef.current = surveyAnswers;
  }, [surveyAnswers]);

  const handleStart = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalTask = task.trim() ? task : 'Estudiar material general';
    setTask(finalTask);

    // Transición optimista instantánea (0ms de espera): abre el modal de inmediato con las preguntas base
    surveyAnswersRef.current = {};
    setSurveyAnswers({});
    setSurveyQuestions(DEFAULT_SURVEY_QUESTIONS);
    setShowSurvey(true);
    setIsSurveyLoading(true);

    // Refinamiento asíncrono con IA en segundo plano
    taskSurveyUniversal(finalTask, geminiApiKey)
      .then(data => {
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          if (Object.keys(surveyAnswersRef.current).length === 0) {
            setSurveyQuestions(data.questions);
          }
        }
      })
      .catch(err => {
        console.warn("Task survey background refinement notice:", err);
      })
      .finally(() => {
        setIsSurveyLoading(false);
      });
  };

  const handleGenerateFromSurvey = async (useAnswers: boolean = true) => {
    setIsLoading(true);
    const answersToSend = useAnswers ? surveyAnswers : {};
    let resolvedSteps: string[] = [];

    try {
      const data = await splitTaskUniversal(
        task,
        answersToSend,
        `Modo de trabajo: ${workMode}, Sensibilidad: ${sensitivity}`,
        geminiApiKey
      );

      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        resolvedSteps = data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').trim());
      } else {
        throw new Error("Formato de respuesta incorrecto");
      }
    } catch (err) {
      console.error("Error al generar ruta de trabajo:", err);
      resolvedSteps = [
        `DELIMITA el objetivo y alcance principal de '${task}'.`,
        `ORGANIZA los materiales o fuentes indispensables para arrancar.`,
        `DESARROLLA el primer bloque central con enfoque total.`,
        `REVISA y consolida el avance realizado.`
      ];
    } finally {
      setSteps(resolvedSteps);

      // Sincronización con la Encuesta de Duración (surveyAnswers.q1)
      const q1Ans = surveyAnswers.q1 || '';
      let wDur = 25 * 60;
      let bDur = 5 * 60;
      let targetBlocks = 2;

      if (q1Ans.includes('30') || q1Ans.toLowerCase().includes('sprint')) {
        wDur = 25 * 60;
        bDur = 5 * 60;
        targetBlocks = 1;
      } else if (q1Ans.includes('60') || q1Ans.toLowerCase().includes('estándar') || q1Ans.toLowerCase().includes('estandar')) {
        wDur = 25 * 60;
        bDur = 5 * 60;
        targetBlocks = 2;
      } else if (q1Ans.includes('90') || q1Ans.includes('120') || q1Ans.toLowerCase().includes('profunda')) {
        wDur = 45 * 60;
        bDur = 10 * 60;
        targetBlocks = 3;
      }

      setWorkDuration(wDur);
      setBreakDuration(bDur);
      setTotalTargetBlocks(targetBlocks);
      setCompletedBlocks(0);
      setTimerMode('WORK');
      setTimerSecondsLeft(wDur);
      setIsTimerRunning(true);

      setCurrentStepIdx(0);
      setIsLoading(false);
      setShowSurvey(false);
      setIsStarted(true);
      setAppStage('FOCUS');

      // Iniciar y registrar la nueva sesión en el historial local
      const sId = `session-${Date.now()}`;
      currentSessionIdRef.current = sId;
      saveSessionItem({
        id: sId,
        task: task || 'Sesión de Trabajo',
        timestamp: Date.now(),
        durationMinutes: 0,
        completedSteps: 0,
        totalSteps: resolvedSteps.length,
        avgFocus: 100,
        status: 'EN_PROGRESO'
      });
    }
  };

  const handleBriefingSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefingInput.trim() || isLoading) return;
    const userMsg = briefingInput.trim();
    setBriefingInput('');
    setBriefingMsgs(prev => [...prev, { role: 'user', content: userMsg }]);

    setIsLoading(true);
    try {
      const currentMsgs = briefingMsgs.map(m => ({ role: m.role, content: m.content }));
      const sysMsg = { role: 'system', content: `El usuario está en una entrevista de briefing para configurar sus tareas. Tarea actual: "${task}". Modo: ${workMode}. Hazle otra pregunta breve si necesitas más contexto para crear micro-pasos, o dale ánimos si ya tienes lo necesario.` };

      const data = await chatUniversal(
        [sysMsg, ...currentMsgs, { role: 'user', content: userMsg }],
        geminiApiKey,
        'Briefing inicial',
        task
      );
      if (data.reply) {
        setBriefingMsgs(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      console.error("Briefing chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFocus = async () => {
    setIsLoading(true);
    const contextStr = briefingMsgs.map(m => `${m.role === 'user' ? 'Usuario' : 'IA'}: ${m.content}`).join('\n');
    let resolvedSteps: string[] = [];

    try {
      const data = await splitTaskUniversal(
        task,
        {},
        contextStr,
        geminiApiKey
      );

      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        resolvedSteps = data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').trim());
      } else {
        throw new Error("Formato de respuesta incorrecto");
      }
    } catch (err) {
      resolvedSteps = ['Preparar material', 'Iniciar primera fase', 'Revisar progreso', 'Finalizar'];
    } finally {
      setSteps(resolvedSteps);
      setIsTimerRunning(true);
      setTimerSecondsLeft(workDuration);
      setTimerMode('WORK');
      setCompletedBlocks(0);
      setIsLoading(false);
      setIsStarted(true);
      setAppStage('FOCUS');

      // Iniciar y registrar la nueva sesión en el historial local
      const sId = `session-${Date.now()}`;
      currentSessionIdRef.current = sId;
      saveSessionItem({
        id: sId,
        task: task || 'Sesión de Trabajo',
        timestamp: Date.now(),
        durationMinutes: 0,
        completedSteps: 0,
        totalSteps: resolvedSteps.length,
        avgFocus: 100,
        status: 'EN_PROGRESO'
      });

      // Bienvenida con voz autónoma de FocusBud (3-4 segundos)
      setTimeout(() => {
        const welcomePhrases = [
          `¡Todo listo! Iniciamos la sesión de ${task || 'estudio'}. Te acompaño en cada paso.`,
          `¡Enfoque activado! Primer micro-paso en marcha. Vamos a nuestro propio ritmo.`
        ];
        const phrase = welcomePhrases[Math.floor(Math.random() * welcomePhrases.length)];
        speakFocusBud(phrase, { force: true, rate: 0.98 });
      }, 1200);
    }

  };

  useEffect(() => {
    let animationFrameId: number;
    let isComponentMounted = true;

    if (!isSystemBooted.current && videoRef.current && canvasRef.current) {
      isSystemBooted.current = true;
      const initSystem = async () => {
        // Esperar a que MediaPipe esté inyectado en window
        let waitCount = 0;
        while (!window.Holistic && waitCount < 30 && isComponentMounted) {
          await new Promise(r => setTimeout(r, 150));
          waitCount++;
        }

        if (!isComponentMounted) return;

        if (!window.Holistic) {
          console.warn("⚠️ MediaPipe CDN no respondió a tiempo. Continuando en modo de resiliencia...");
          setWarmupSteps(prev => prev.map(s => s.id === 'mediapipe' ? { ...s, status: 'completed', detail: 'CDN OFFLINE' } : s));
          setWarmupProgress(prev => Math.max(prev, 80));
          setTimeout(() => {
            setIsPreWarmupVisible(false);
            setIsAppLoading(false);
          }, 600);
          return;
        }

        try {
          // 1. Inicializar Holistic en Modo Ligero (Complexity 0)
          const holistic = new window.Holistic({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
          });

          holistic.setOptions({
            modelComplexity: 0,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            refineFaceLandmarks: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          holistic.onResults(onResults);
          holisticRef.current = holistic;

          if (isComponentMounted) {
            setWarmupSteps(prev => prev.map(s => s.id === 'mediapipe' ? { ...s, status: 'completed', detail: 'WASM ACTIVO' } : (s.id === 'camera' ? { ...s, status: 'loading', detail: 'ACCEDIENDO' } : s)));
            setWarmupProgress(prev => Math.max(prev, 70));
          }

          // 2. Solicitar cámara nativa en 320x240 (1/4 de consumo de RAM y ancho de banda USB/WASM)
          if (statusRef.current) statusRef.current.textContent = "SOLICITANDO CAMARA...";
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320, max: 480 },
              height: { ideal: 240, max: 360 },
              frameRate: { ideal: 12, max: 15 },
              facingMode: "user"
            }
          });

          if (!isComponentMounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(e => console.warn("Video play notice:", e));
            };

            // 3. Procesamiento controlado de cuadros
            videoRef.current.onplaying = () => {
              if (isComponentMounted) {
                setWarmupSteps(prev => prev.map(s => s.id === 'camera' ? { ...s, status: 'completed', detail: 'STREAM ACTIVO' } : s));
                setWarmupProgress(prev => Math.max(prev, 90));
              }

              // Fallback de seguridad: si no detecta landmarks en 3.5s, desbloquear suavemente
              setTimeout(() => {
                if (!hasFirstLandmarkRef.current && isComponentMounted) {
                  hasFirstLandmarkRef.current = true;
                  setWarmupSteps(prev => prev.map(s => ({ ...s, status: 'completed', detail: s.detail || 'STREAM ACTIVO' })));
                  setWarmupProgress(100);
                  setTimeout(() => {
                    setIsPreWarmupVisible(false);
                    setIsAppLoading(false);
                  }, 400);
                }
              }, 3500);

              if (statusRef.current) statusRef.current.textContent = "ANALIZANDO BIOMETRIA...";

              let isProcessing = false;

              const sendToMediaPipe = async () => {
                if (!isComponentMounted) return;

                const now = performance.now();

                if (
                  !document.hidden &&
                  !isPausedRef.current &&
                  now - lastFrameProcessTimeRef.current >= 140 &&
                  videoRef.current &&
                  videoRef.current.readyState >= 2 &&
                  videoRef.current.videoWidth > 0 &&
                  videoRef.current.videoHeight > 0 &&
                  holisticRef.current &&
                  !isProcessing
                ) {
                  lastFrameProcessTimeRef.current = now;
                  isProcessing = true;
                  try {
                    await holisticRef.current.send({ image: videoRef.current });
                  } catch (e) {
                    console.warn("MediaPipe Frame Skipped:", e);
                  } finally {
                    isProcessing = false;
                  }
                }

                if (isComponentMounted) {
                  animationFrameId = requestAnimationFrame(sendToMediaPipe);
                }
              };
              sendToMediaPipe();
            };
          }
        } catch (error) {
          console.warn("[Hardware Warmup] Acceso a cámara opcional o bloqueado:", error);
          if (isComponentMounted) {
            setWarmupSteps(prev => prev.map(s => s.id === 'camera' ? { ...s, status: 'completed', detail: 'MODO SIN CAMARA' } : s));
            setWarmupProgress(100);
            setTimeout(() => {
              setIsPreWarmupVisible(false);
              setIsAppLoading(false);
            }, 600);
          }
          if (statusRef.current) {
            statusRef.current.textContent = "MODO LOCAL SIN CAMARA";
            statusRef.current.className = "px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 bg-zinc-800/80 text-zinc-400 border-zinc-700/50 uppercase shadow-2xl backdrop-blur-md";
          }
        }
      };

      initSystem();
    }

    return () => {
      isComponentMounted = false;
      isSystemBooted.current = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      if (holisticRef.current) {
        holisticRef.current.close();
        holisticRef.current = null;
      }
    };
  }, []);
  const onResults = (results: any) => {
    // Sincronización del primer frame detectado con PreWarmupScreen
    if (results.faceLandmarks && !hasFirstLandmarkRef.current) {
      hasFirstLandmarkRef.current = true;
      setWarmupSteps(prev => prev.map(s => ({ ...s, status: 'completed', detail: '60 FPS ESTABLE' })));
      setWarmupProgress(100);
      setTimeout(() => {
        setIsPreWarmupVisible(false);
        setIsAppLoading(false);
      }, 400);
    }

    // Optimización 60 FPS: Solo renderizar en canvas si está visible (evita decodificación masiva de 1280x720 en background)
    const canvas = canvasRef.current;
    if (canvas && !canvas.classList.contains('hidden') && canvas.offsetParent !== null) {
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx && videoRef.current) {
        const width = canvas.width;
        const height = canvas.height;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);

        // Flip horizonally to mirror
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);

        // Draw Video feed onto canvas
        canvasCtx.drawImage(results.image, 0, 0, width, height);

        // MediaPipe overlays (Classic Python Styling)
        if (results.faceLandmarks) {
          window.drawConnectors?.(canvasCtx, results.faceLandmarks, window.FACEMESH_RIGHT_EYEBROW, { color: '#FF3030', lineWidth: 1.5 });
          window.drawConnectors?.(canvasCtx, results.faceLandmarks, window.FACEMESH_RIGHT_EYE, { color: '#FF3030', lineWidth: 1.5 });
          window.drawConnectors?.(canvasCtx, results.faceLandmarks, window.FACEMESH_LEFT_EYEBROW, { color: '#30FF30', lineWidth: 1.5 });
          window.drawConnectors?.(canvasCtx, results.faceLandmarks, window.FACEMESH_LEFT_EYE, { color: '#30FF30', lineWidth: 1.5 });
          window.drawConnectors?.(canvasCtx, results.faceLandmarks, window.FACEMESH_FACE_OVAL, { color: '#E0E0E0', lineWidth: 1.5 });
          window.drawConnectors?.(canvasCtx, results.faceLandmarks, window.FACEMESH_LIPS, { color: '#E0E0E0', lineWidth: 1.5 });
        }
        if (results.poseLandmarks && window.POSE_CONNECTIONS) {
          window.drawConnectors?.(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#E0E0E0', lineWidth: 2 });
          window.drawLandmarks?.(canvasCtx, results.poseLandmarks, { color: '#00FFFF', lineWidth: 1, radius: 2.5 });
        }

        canvasCtx.restore();
      }
    }

    if (isPausedRef.current) {
      if (statusRef.current) {
        statusRef.current.textContent = "SISTEMA PAUSADO (PULSA 'Q')";
        statusRef.current.className = `px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 bg-blue-500/10 text-blue-400 border-blue-500/30 uppercase shadow-2xl backdrop-blur-md`;
      }
      return;
    }

    // ===========================================
    // NÚCLEO BIOMÉTRICO P.D.E.F. v1.0
    // ===========================================
    let statusMsg = "EN ESTADO DE FLUJO (FIJACIÓN ACTIVA)";
    let statusColor = "text-green-500";
    let statusBg = "bg-green-500/10";
    let statusBorder = "border-green-500/30";

    const faces = results.faceLandmarks;
    if (faces) {
      const now = Date.now();
      const metrics = metricsRef.current;

      // Fase de Calibración (15 segundos)
      if (!metrics.calibration_start) {
        metrics.calibration_start = now;
        metrics.calib_frames = 0;
        metrics.calib_ear_sum = 0;
        metrics.calib_frown_sum = 0;
        metrics.calib_yaw_sum = 0;
        metrics.calib_pitch_sum = 0;
        metrics.stress_events = [];
      }
      const isCalibrating = (now - metrics.calibration_start) < 15000;

      // --- EXTRACCIÓN DE MALLA (PDEF) ---
      const pI = faces[468] || faces[159]; // Pupila/Ojo Izquierdo
      const pD = faces[473] || faces[386]; // Pupila/Ojo Derecho
      const upperEye = faces[159];
      const lowerEye = faces[145];
      const outerEye = faces[33];
      const innerEye = faces[133];
      const cejaI = faces[65];
      const cejaD = faces[295];
      const nose = faces[1];
      const mouth = faces[14];

      const eyeHeight = Math.hypot(upperEye.x - lowerEye.x, upperEye.y - lowerEye.y);
      const eyeWidth = Math.hypot(outerEye.x - innerEye.x, outerEye.y - innerEye.y);
      const EAR = eyeHeight / eyeWidth;

      const dx = faces[263].x - faces[33].x;
      const dy = mouth.y - ((faces[263].y + faces[33].y) / 2);
      const yawRatio = dx !== 0 ? (nose.x - faces[33].x) / dx : 0.5;
      const pitchRatio = dy !== 0 ? (nose.y - ((faces[263].y + faces[33].y) / 2)) / dy : 0.5;

      const faceWidth = Math.hypot(faces[234].x - faces[454].x, faces[234].y - faces[454].y);
      const eyebrowDist = faceWidth !== 0 ? Math.hypot(cejaI.x - cejaD.x, cejaI.y - cejaD.y) / faceWidth : 0.22;

      const midX = (pI.x + pD.x) / 2;
      const midY = (pI.y + pD.y) / 2;
      metrics.gaze_history.push({ x: midX, y: midY, t: now });
      metrics.gaze_history = metrics.gaze_history.filter(p => now - p.t < 10000); // Ventana de 10s

      let variance = 0;
      if (metrics.gaze_history.length > 5) {
        let mX = 0, mY = 0;
        metrics.gaze_history.forEach(p => { mX += p.x; mY += p.y; });
        mX /= metrics.gaze_history.length;
        mY /= metrics.gaze_history.length;
        metrics.gaze_history.forEach(p => {
          variance += Math.pow(p.x - mX, 2) + Math.pow(p.y - mY, 2);
        });
        variance /= metrics.gaze_history.length;
      }

      // --- EXTRACCIÓN CINEMÁTICA (Pose de Agobio / Tensión) ---
      const pose = results.poseLandmarks;
      let distressPosture = false;
      let postureDetail = "";
      let leftShoulderTorsoAngle = 0;
      let rightShoulderTorsoAngle = 0;
      let leftArmShoulderAngle = 0;
      let rightArmShoulderAngle = 0;

      // Helper to calculate 2D angle between 3 points
      const getAngle = (
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number }
      ) => {
        const rad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
        let deg = Math.abs((rad * 180) / Math.PI);
        if (deg > 180) deg = 360 - deg;
        return deg;
      };

      if (pose && pose[11] && pose[12] && pose[13] && pose[14] && pose[15] && pose[16]) {
        const leftShoulder = pose[11];
        const rightShoulder = pose[12];
        const leftElbow = pose[13];
        const rightElbow = pose[14];
        const leftWrist = pose[15];
        const rightWrist = pose[16];
        const leftHip = pose[23] || { x: leftShoulder.x, y: leftShoulder.y + 0.5 };
        const rightHip = pose[24] || { x: rightShoulder.x, y: rightShoulder.y + 0.5 };

        // 1. Ángulo en el codo (brazo estirado)
        const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);

        // 2. Ángulo en el hombro con respecto al torso (línea recta / 180 grados con el cuerpo hacia arriba)
        leftShoulderTorsoAngle = getAngle(leftElbow, leftShoulder, leftHip);
        rightShoulderTorsoAngle = getAngle(rightElbow, rightShoulder, rightHip);
        const isLeftArmRaisedUp = leftShoulderTorsoAngle > 135;
        const isRightArmRaisedUp = rightShoulderTorsoAngle > 135;

        // 3. Ángulo del brazo con respecto al hombro opuesto (brazo horizontal o extendido hacia fuera)
        leftArmShoulderAngle = getAngle(leftElbow, leftShoulder, rightShoulder);
        rightArmShoulderAngle = getAngle(rightElbow, rightShoulder, leftShoulder);
        const isLeftArmHorizontal = Math.abs(leftArmShoulderAngle - 180) < 35;
        const isRightArmHorizontal = Math.abs(rightArmShoulderAngle - 180) < 35;

        // 4. Manos (muñecas) por encima del torso o de los hombros
        const isLeftHandAboveTorso = leftWrist.y < leftShoulder.y - 0.05;
        const isRightHandAboveTorso = rightWrist.y < rightShoulder.y - 0.05;

        // Condición combinada de agobio/tensión
        if (isLeftArmRaisedUp || isRightArmRaisedUp) {
          distressPosture = true;
          postureDetail = `Brazos arriba (Izq: ${leftShoulderTorsoAngle.toFixed(0)}°, Der: ${rightShoulderTorsoAngle.toFixed(0)}°)`;
        } else if (isLeftArmHorizontal || isRightArmHorizontal) {
          distressPosture = true;
          postureDetail = `Brazos rectos (Izq: ${leftArmShoulderAngle.toFixed(0)}°, Der: ${rightArmShoulderAngle.toFixed(0)}°)`;
        } else if (isLeftHandAboveTorso || isRightHandAboveTorso) {
          distressPosture = true;
          postureDetail = "Manos altas";
        }
      }

      // Calcular delta de tiempo real entre frames
      const delta = Math.min(1000, metrics.last_frame_time > 0 ? (now - metrics.last_frame_time) : 33);
      metrics.last_frame_time = now;

      // 1. Cálculo de Desplazamiento Nasal (Inquietud física)
      let noseDelta = 0;
      if (lastNoseRef.current) {
        noseDelta = Math.hypot(nose.x - lastNoseRef.current.x, nose.y - lastNoseRef.current.y);
      }
      lastNoseRef.current = { x: nose.x, y: nose.y };

      // 2. Ángulo de hombros / Postura
      let shoulderAngle = 105;
      if (pose && pose[11] && pose[12] && pose[13]) {
        const rad = Math.atan2(pose[13].y - pose[11].y, pose[13].x - pose[11].x) - Math.atan2(pose[12].y - pose[11].y, pose[12].x - pose[11].x);
        shoulderAngle = Math.abs((rad * 180) / Math.PI);
      }

      // MAR (Mouth Aspect Ratio - Detección de bostezo / fatiga somnolienta)
      const mouthTop = faces[13];
      const mouthBottom = faces[14];
      const mouthLeft = faces[61] || faces[78];
      const mouthRight = faces[291] || faces[308];
      const mouthHeight = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);
      const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
      const MAR = mouthWidth > 0 ? mouthHeight / mouthWidth : 0.05;

      // Inclinación lateral de la cabeza (Roll angle en grados)
      const rollRad = Math.atan2(faces[263].y - faces[33].y, faces[263].x - faces[33].x);
      const rollAngle = rollRad * (180 / Math.PI);

      // 3. Buffer rodante de 2 segundos para la Red Neuronal de TensorFlow.js (12 Dimensiones)
      windowFramesRef.current.push({
        ear: EAR,
        yaw: yawRatio,
        pitch: pitchRatio,
        frown: eyebrowDist,
        noseDelta: noseDelta,
        gazeVar: variance,
        shoulder: shoulderAngle,
        mar: MAR,
        roll: rollAngle,
        t: now
      });
      windowFramesRef.current = windowFramesRef.current.filter(f => now - f.t <= 2000);

      const wFrames = windowFramesRef.current;
      const wCount = Math.max(1, wFrames.length);

      const ears = wFrames.map(f => f.ear);
      const yaws = wFrames.map(f => f.yaw);
      const pitches = wFrames.map(f => f.pitch);
      const frowns = wFrames.map(f => f.frown);
      const gazes = wFrames.map(f => f.gazeVar);
      const shoulders = wFrames.map(f => f.shoulder);
      const mars = wFrames.map(f => f.mar ?? 0.05);
      const rolls = wFrames.map(f => f.roll ?? 0.0);

      const earMean = ears.reduce((a, b) => a + b, 0) / wCount;
      const earMin = Math.min(...ears);
      const yawMean = yaws.reduce((a, b) => a + b, 0) / wCount;
      const yawStd = Math.sqrt(yaws.reduce((sq, n) => sq + Math.pow(n - yawMean, 2), 0) / wCount);
      const pitchMean = pitches.reduce((a, b) => a + b, 0) / wCount;
      const pitchStd = Math.sqrt(pitches.reduce((sq, n) => sq + Math.pow(n - pitchMean, 2), 0) / wCount);
      const frownMean = frowns.reduce((a, b) => a + b, 0) / wCount;

      // Normalización temporal de desplazamiento nasal (independiente de los FPS del navegador)
      const wDurationSec = Math.max(0.5, (wFrames[wFrames.length - 1].t - wFrames[0].t) / 1000);
      const rawNoseSum = wFrames.reduce((a, b) => a + b.noseDelta, 0);
      const noseDeltaSum = (rawNoseSum / wDurationSec) * 2.0;

      const gazeVarMean = gazes.reduce((a, b) => a + b, 0) / wCount;
      const shoulderMean = shoulders.reduce((a, b) => a + b, 0) / wCount;
      const marMean = mars.reduce((a, b) => a + b, 0) / wCount;
      const rollMean = rolls.reduce((a, b) => a + b, 0) / wCount;

      // 4. INFERENCIA CON LA RED NEURONAL ENTRENADA EN TENSORFLOW.JS (<2ms)
      const aiResult = evaluateAIBiometrics({
        ear_mean: earMean,
        ear_min: earMin,
        yaw_mean: yawMean,
        yaw_std: yawStd,
        pitch_mean: pitchMean,
        pitch_std: pitchStd,
        frown_mean: frownMean,
        nose_delta_sum: noseDeltaSum,
        gaze_variance_mean: gazeVarMean,
        shoulder_angle_mean: shoulderMean,
        mar_mean: marMean,
        roll_angle_mean: rollMean
      });

      // Histéresis temporal de 1200ms para estabilización clínica de clase en pantalla
      const rawClassIdx = aiResult.classIndex;
      if (rawClassIdx !== displayedClassRef.current) {
        if (pendingClassRef.current !== rawClassIdx) {
          pendingClassRef.current = rawClassIdx;
          pendingClassSinceRef.current = now;
        } else if (now - pendingClassSinceRef.current >= 1200) {
          displayedClassRef.current = rawClassIdx;
          pendingClassRef.current = null;
        }
      } else {
        pendingClassRef.current = null;
      }

      const CLASS_NAMES = [
        'ESTUDIO NORMAL / NEUTRO',
        'ENFOQUE PROFUNDO (FLOW)',
        'DISTRACCIÓN',
        'FATIGA',
        'SOBREESTIMULACIÓN',
        'AGOBIO POSTURAL'
      ];

      const stabilizedResult: AIPredictionResult = {
        ...aiResult,
        classIndex: displayedClassRef.current,
        className: CLASS_NAMES[displayedClassRef.current] || aiResult.className
      };

      // Guardado inteligente: Solo actualizar React state cuando cambie la clase cognitiva o la confianza varíe >= 4%
      if (now - lastAiUpdateRef.current >= 250) {
        lastAiUpdateRef.current = now;

        // Registro de métricas anónimas en sesión activa para el debriefing cognitivo (buffer circular acotado a 300 muestras para cuidar la RAM)
        if (isStarted && currentStepIdx < steps.length && !isPaused) {
          if (focusSamplesRef.current.length >= 300) {
            focusSamplesRef.current.shift();
          }
          focusSamplesRef.current.push(aiResult.focusScore);
          if (displayedClassRef.current === 1) { // 1 = FLOW
            flowSamplesCountRef.current += 1;
          }
        }

        setAiPrediction(prev => {
          if (
            prev &&
            prev.classIndex === stabilizedResult.classIndex &&
            Math.abs(prev.confidence - stabilizedResult.confidence) < 0.04
          ) {
            return prev;
          }
          return stabilizedResult;
        });
      }

      // Control Directo de Métricas C.L.A.P. y Carga Cognitiva con Suavizado Exponencial Orgánico
      const targetFocus = aiResult.focusScore;
      const targetLoad = aiResult.stressLevel;

      metrics.nivel_clap = Math.max(5, Math.min(100, metrics.nivel_clap * 0.94 + targetFocus * 0.06));
      metrics.nivel_carga = Math.max(0, Math.min(100, metrics.nivel_carga * 0.94 + targetLoad * 0.06));

      // Paso 3: Enrutamiento de Telemetría Biocognitiva en Vivo a FocusBud (60 FPS, Latencia Cero)
      const pupilShiftX = (pI && outerEye && innerEye)
        ? ((pI.x - (outerEye.x + innerEye.x) / 2) / (Math.abs(outerEye.x - innerEye.x) || 1)) * 4.0
        : 0;
      const headYaw = (yawRatio - 0.5) * 3.8;
      const gazeXNorm = Math.max(-1, Math.min(1, headYaw + pupilShiftX * 0.35));
      const gazeYNorm = Math.max(-1, Math.min(1, (pitchRatio - 0.46) * 3.8));
      const userBlinking = EAR < 0.19 || (metrics.baseline_ear > 0 && EAR < metrics.baseline_ear * 0.72);
      const isFlowActive = displayedClassRef.current === 1 || aiResult.focusScore >= 78;
      const isFatigueActive = displayedClassRef.current === 3 || MAR > 0.38;
      const isDistressActive = displayedClassRef.current === 5 || distressPosture || metrics.nivel_carga > 60;


      avatarBridge.emitBiometricFeed({
        gazeX: gazeXNorm,
        gazeY: gazeYNorm,
        headRoll: rollAngle,
        isBlinking: userBlinking,
        isFlow: isFlowActive,
        isFatigue: isFatigueActive,
        isDistress: isDistressActive,
        ear: EAR,
        focusScore: Math.round(metrics.nivel_clap),
      });

      const nextExpr = (displayedClassRef.current === 1 || displayedClassRef.current === 0)
        ? 'happy'
        : (displayedClassRef.current === 3 || displayedClassRef.current === 5)
          ? 'blink'
          : 'normal';
      if (mascotExpressionRef.current !== nextExpr) {
        mascotExpressionRef.current = nextExpr;
        setMascotExpression(nextExpr as any);
      }




      // Subdivisión autónoma de tarea si la Red Neuronal detecta que el enfoque cayó bajo 40%
      if (metrics.nivel_clap < 40 && !metrics.is_subdividing && !metrics.subdivided_indexes.includes(currentStepIdxRef.current)) {
        subdivideCurrentStepRef.current(currentStepIdxRef.current);
      }

      // Higienización Postural Local Determinista (100% Edge Privacy, sin envíos de imagen ni video)
      const pFatiga = aiResult.probabilities[3] || 0;
      const pAgobio = aiResult.probabilities[5] || 0;

      if (now - lastPostureUpdateRef.current >= 600) {
        lastPostureUpdateRef.current = now;
        let pStatus: 'OPTIMAL' | 'NECK_TILT' | 'SHOULDER_TENSION' = 'OPTIMAL';
        let pLabel = 'Postura Óptima';
        let pColor = 'text-emerald-400';
        let pBg = 'bg-emerald-950/40 border-emerald-800/40';

        if (pitchMean > 0.62) {
          pStatus = 'NECK_TILT';
          pLabel = 'Ajuste Cervical';
          pColor = 'text-amber-400';
          pBg = 'bg-amber-950/40 border-amber-800/40';
        } else if (pAgobio > 0.55 || Math.abs(rollMean) > 22) {
          pStatus = 'SHOULDER_TENSION';
          pLabel = 'Tensión Postural';
          pColor = 'text-rose-400';
          pBg = 'bg-rose-950/40 border-rose-800/40';
        }

        setPostureHygiene(prev => {
          if (prev.status === pStatus) return prev;
          return { status: pStatus, label: pLabel, color: pColor, bg: pBg };
        });
      }

      // Intervención proactiva en Streaming con Meta Muse Spark hacia FocusBud cuando la Red Neuronal detecta sobrecarga continua
      if ((pAgobio > 0.65 || pFatiga > 0.65 || metrics.nivel_carga > 75) && (now - metrics.last_auto_chat > 45000)) {
        metrics.last_auto_chat = now;
        fatigueEventsCountRef.current += 1;

        isBudStreamingRef.current = true;
        let streamAccumulator = "";

        // Calcular severidad de la señal biométrica para adaptar la duración y cadencia de la voz (3 a 8 segundos)
        const severity = Math.max(
          Math.round(pFatiga * 100),
          Math.round(pAgobio * 100),
          Math.round(aiResult.perclos * 2.5),
          Math.round(metrics.nivel_carga)
        );

        streamMuseSparkIntervention(
          {
            perclos: Math.round(aiResult.perclos),
            fatigueScore: Math.round(pFatiga * 100),
            postureScore: Math.round(metrics.nivel_carga),
            currentTask: steps[currentStepIdx] || task || 'Trabajo en curso',
            sessionMinutes: Math.round(elapsedTimeRef.current / 60),
            cognitiveClass: stabilizedResult.className
          },
          (chunk: string) => {
            streamAccumulator += chunk;
          },
          () => {
            let fullText = streamAccumulator.trim();
            // Sanitización estricta: purgar razonamiento interno en inglés si existiera
            fullText = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#"`]/g, '').trim();
            if (/Starts with|Need to consider|We should|Count:|PERCLOS|User prompt/i.test(fullText)) {
              fullText = "";
            }

            // Micro-resumen verbal empático adaptado a la magnitud de la señal (3 a 8 segundos de voz)
            let voiceSummary = "";
            let speechRate = 0.95;

            if (severity >= 70 || pFatiga > 0.65) {
              // Señal grande de fatiga: voz pausada (~6-8s)
              voiceSummary = "Detecto sobrecarga en tu ritmo. Cierra los ojos y respira hondo cinco segundos.";
              speechRate = 0.88;
            } else if (pAgobio > 0.65) {
              // Agobio: voz calmante (~5-6s)
              voiceSummary = "Cero agobio. Respira hondo y da un solo clic a la vez.";
              speechRate = 0.90;
            } else if (metrics.nivel_carga > 45) {
              // Tensión postural: voz ágil (~3-4s)
              voiceSummary = "Ajusta tu postura: eleva el mentón y relaja los hombros.";
              speechRate = 1.0;
            } else {
              voiceSummary = fullText || "Mantenemos el ritmo. Un paso a la vez.";
              speechRate = 0.95;
            }

            // Si el texto de la IA es una frase limpia de menos de 12 palabras, usarla
            const wordsCount = fullText.split(/\s+/).filter(Boolean).length;
            if (fullText && wordsCount <= 12 && !/Starts with|Need to consider/i.test(fullText)) {
              voiceSummary = fullText;
            }

            // 1. Mostrar micro-resumen en el bocadillo de FocusBud (resumido, no empuja el avatar)
            setBudMessage(voiceSummary);

            // 2. Colocar el consejo completo en el Chat de Asistencia
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: `🤖 [FocusBud / Muse Spark]: ${fullText || voiceSummary}`
            }]);

            // 3. Sintetizar la voz en vivo con Web Speech API (3 a 8 segundos)
            audioService.speak(voiceSummary, {
              rate: speechRate,
              pitch: 1.08,
              onStart: () => setIsBudSpeaking(true),
              onEnd: () => {
                setIsBudSpeaking(false);
                // Desvanecer el bocadillo tras 2.5s de concluir la voz para mantener limpia la interfaz
                setTimeout(() => {
                  setBudMessage("");
                }, 2500);
              }
            });

            setTimeout(() => {
              isBudStreamingRef.current = false;
            }, 6000);
          }
        );
      }

      statusMsg = `🧠 IA: ${stabilizedResult.className} (${(stabilizedResult.confidence * 100).toFixed(0)}%) • ${stabilizedResult.statusMessage}`;
      statusColor = stabilizedResult.badgeColor;
      statusBg = stabilizedResult.badgeBg;
      statusBorder = stabilizedResult.badgeBorder;
    } else {
      statusMsg = "ROSTRO FUERA DE ENCUADRE";
      statusColor = "text-zinc-600";
      statusBg = "bg-zinc-800/10";
      statusBorder = "border-zinc-800/30";
    }

    // Actualización directa del DOM de las barras para rendimiento a 60 FPS
    if (focusRef.current) {
      focusRef.current.style.width = `${Math.round(metricsRef.current.nivel_clap)}%`;
    }
    if (fatigueRef.current) {
      fatigueRef.current.style.width = `${Math.round(metricsRef.current.nivel_carga)}%`;
    }
    // Actualización de statusRef desactivada para consolidar notificación única en FocusBudWidget / AvatarMessage
    // if (statusRef.current) {
    //   statusRef.current.textContent = statusMsg;
    //   statusRef.current.className = `px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 ${statusBg} ${statusColor} ${statusBorder} uppercase shadow-2xl backdrop-blur-md transition-all duration-300`;
    // }
  };

  const handleRecalibrate = (silent = false) => {
    const metrics = metricsRef.current;
    metrics.calibration_start = Date.now();
    metrics.calib_frames = 0;
    metrics.calib_ear_sum = 0;
    metrics.calib_frown_sum = 0;
    metrics.calib_yaw_sum = 0;
    metrics.calib_pitch_sum = 0;
    metrics.stress_events = [];
    metrics.frown_accumulated_ms = 0;
    metrics.hands_accumulated_ms = 0;
    metrics.nivel_carga = 0;

    if (!silent) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔄 Re-iniciando sensores biométricos. Por favor, mantén una postura cómoda y rostro neutral durante 15 segundos para la recalibración.'
      }]);
      speakFocusBud("Recalibrando sensores. Mantén rostro neutral y postura cómoda durante quince segundos.", { force: true, rate: 0.98 });
    }

  };

  const handleAcceptProposal = () => {
    if (!proposedChange) return;

    const newSteps = proposedChange.proposedSteps.map((s: string) => s.replace(/(Paso \d+\.\d+:|Paso \d+:)/i, '').trim());
    setTask(proposedChange.proposedTask);
    setSteps(newSteps);
    setCurrentStepIdx(0);
    elapsedTimeRef.current = 0;
    setElapsedTime(0);

    metricsRef.current.subdivided_indexes = [];
    setProposedChange(null);

    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: `🚀 ¡Misión actualizada con éxito! Ahora tu objetivo es: "${proposedChange.proposedTask}".`
    }]);

    setTimeout(() => {
      handleRecalibrate(true);
    }, 100);
  };

  const handleNextStep = () => {
    if (currentStepIdx < steps.length) {
      const completedStepText = steps[currentStepIdx] || '';
      stepDistractionsRef.current = 0;
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      metricsRef.current.nivel_clap = 100; // Dopamine CLAP boost
      metricsRef.current.nivel_carga = Math.max(0, metricsRef.current.nivel_carga - 30); // Less stress

      // Clear any existing timeout
      if (rewardTimeoutRef.current) {
        clearTimeout(rewardTimeoutRef.current);
      }

      // Trigger Kawaii Anime Reward Celebration (Rotación variada de 10 arquetipos)
      const nextArchetype = nextIdx >= steps.length 
        ? 5 // APEX VICTORY (¡DOMINIO TOTAL! 👑 ＼(＾▽＾)／ 👑) en el paso final
        : Math.floor(Math.random() * REWARD_ARCHETYPES.length);
      setRewardArchetypeIdx(nextArchetype);
      const selectedKao = REWARD_ARCHETYPES[nextArchetype].kaomoji;
      setRewardKaomoji(selectedKao);
      setIsShowingReward(true);
      audioService.playStateSound('CELEBRACION');
      rewardTimeoutRef.current = window.setTimeout(() => {
        setIsShowingReward(false);
        rewardTimeoutRef.current = null;
      }, 1150);

      // Diferir persistencia en localStorage por 250ms para que el frame 0 de la animación sea instantáneo (60 FPS puros)
      if (currentSessionIdRef.current) {
        const sessionId = currentSessionIdRef.current;
        const currentTaskTitle = task || 'Sesión de Trabajo';
        const totalStepsCount = steps.length;
        window.setTimeout(() => {
          const focusHistory = focusSamplesRef.current;
          const avgFocus = focusHistory.length > 0
            ? Math.round(focusHistory.reduce((a, b) => a + b, 0) / focusHistory.length)
            : Math.round(metricsRef.current.nivel_clap);
          const totalMins = Math.max(1, Math.round(elapsedTimeRef.current / 60));
          saveSessionItem({
            id: sessionId,
            task: currentTaskTitle,
            timestamp: Date.now(),
            durationMinutes: totalMins,
            completedSteps: nextIdx,
            totalSteps: totalStepsCount,
            avgFocus,
            status: nextIdx >= totalStepsCount ? 'COMPLETADA' : 'EN_PROGRESO'
          });
        }, 250);
      }

      if (nextIdx < steps.length) {
        // Vocalización instantánea (< 5ms) de FocusBud al completar el paso sin esperar llamada de red
        const nextStepText = steps[nextIdx] || '';
        const isNextSomatic = /^PAUSA(\s+SOMÁTICA)?/i.test(nextStepText);
        if (isNextSomatic) {
          speakFocusBud("Paso completado. Ahora entramos en una pausa somática. Inhala profundo y relaja los hombros.", { force: true });
        } else {
          const clean = completedStepText.replace(/^(\d+\.?\s*|[-•*]\s*)/, '').trim();
          const match = clean.match(/^([A-ZÁÉÍÓÚÑ]{3,})\s+(.*)/i);
          const instantPhrase = match
            ? `¡Excelente al ${match[1].toLowerCase()} ${match[2].slice(0, 38).replace(/[.,;:].*$/, '').trim()}! Vamos por el siguiente paso.`
            : `¡Paso dominado con éxito! Avanzamos con el siguiente objetivo.`;
          speakFocusBud(instantPhrase, { force: true, rate: 1.04 });
        }
      }
    }
  };


  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${s}`;
  };

  const renderGlobalSettings = () => {
    return (
      <>
        {/* GLOBAL HEADER CONTROLS (Settings, Audio & Status) */}
        <div className="fixed top-4 right-4 z-[90] flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl shadow-2xl select-none">
          {/* Conmutador de Audio Ambiental (Ruido Marrón) */}
          <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
            <button
              onClick={toggleBrownNoise}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                isBrownNoiseActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-700/50'
              }`}
              title={isBrownNoiseActive ? "Desactivar Ruido Marrón" : "Activar Ruido Marrón"}
            >
              <Headphones className={`w-3.5 h-3.5 ${isBrownNoiseActive ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline font-semibold">Ruido Marrón:</span>
              <span className={`font-bold ${isBrownNoiseActive ? 'text-amber-400' : 'text-zinc-500'}`}>
                {isBrownNoiseActive ? 'ON' : 'OFF'}
              </span>
            </button>
            {isBrownNoiseActive && (
              <div className="flex items-center gap-1.5 pl-1 animate-fadeIn">
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={noiseVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1.5 bg-zinc-800 accent-amber-400 rounded-lg cursor-pointer"
                  title={`Volumen: ${Math.round(noiseVolume * 100)}%`}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-mono text-[9px] tracking-wider text-emerald-400 uppercase font-semibold">
              Meta Muse Activo
            </span>
          </div>
        </div>
      </>
    );
  };

  const renderSurveyStage = () => (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans tracking-tight p-4 sm:p-6 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl w-full p-6 sm:p-8 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl flex flex-col gap-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  Personalicemos tu sesión
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Meta: <span className="text-emerald-400 font-medium font-mono">"{task}"</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSurvey(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer"
              title="Volver a editar meta"
            >
              ← Modificar meta
            </button>
          </div>

          {/* Question List container with comfortable vertical scroll */}
          <div className="flex flex-col gap-4 max-h-[55vh] sm:max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {surveyQuestions.map((q, idx) => {
              const selectedOption = surveyAnswers[q.id];
              return (
                <div
                  key={q.id || idx}
                  className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-medium text-zinc-100 leading-snug">
                      {q.question}
                    </p>
                  </div>

                  {/* Options as pill/card buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:pl-9">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = selectedOption === opt;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`px-3 py-2.5 rounded-xl border text-xs text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] font-medium ring-1 ring-emerald-500/50'
                              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-850'
                          }`}
                        >
                          <span className="leading-snug">{opt}</span>
                          {isSelected && (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGenerateFromSurvey(true)}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-zinc-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Generando ruta adaptada...</span>
                </>
              ) : (
                <>
                  GENERAR RUTA DE TRABAJO 🚀
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGenerateFromSurvey(false)}
              className="w-full py-2.5 text-xs sm:text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors text-center cursor-pointer disabled:opacity-50"
            >
              Omitir y comenzar directo
            </button>
          </div>
        </motion.div>
      </div>
  );

  const renderLoginStage = () => (
    <GeminiHeroInput
      task={task}
      setTask={setTask}
      onSubmit={handleStart}
      isLoading={isLoading}
      isSurveyLoading={isSurveyLoading}
      workMode={workMode}
      setWorkMode={setWorkMode}
      sensitivity={sensitivity}
      setSensitivity={setSensitivity}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
    />
  );

  const renderBriefingStage = () => (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans tracking-tight p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full p-6 sm:p-8 rounded-3xl bg-zinc-900 shadow-2xl flex flex-col gap-6"
      >
        <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <BrainCircuit className="text-green-500" /> Afinando Detalles
          </h2>
        </div>

        <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto pr-2">
          {briefingMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-green-500/20 text-green-100 border border-green-500/30' : 'bg-zinc-800 text-zinc-300'}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleBriefingSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
            placeholder="Escribe tu respuesta..."
            value={briefingInput}
            onChange={e => setBriefingInput(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading} className="bg-zinc-800 p-3 rounded-xl hover:bg-zinc-700 transition">
            <Send className="w-4 h-4" />
          </button>
        </form>

        <button
          onClick={handleStartFocus}
          disabled={isLoading}
          className="w-full mt-2 py-4 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4 fill-black inline mr-1" /> Generar Pasos e Iniciar Sesión
            </>
          )}
        </button>
      </motion.div>
    </div>
  );

  const renderFocusStage = () => (
    <div className="lg:h-screen lg:overflow-hidden bg-zinc-950 text-zinc-300 font-sans p-4 xl:p-8 flex flex-col lg:flex-row gap-6 items-stretch">

      {/* LEFT PANEL: VIDEO, BIOMETRICS & CHAT - Staged GPU Entrance */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 w-full max-w-5xl flex flex-col gap-6 min-h-0"
      >

        {/* HUD Bars with TensorFlow.js Neural AI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest">
                <Target className="w-4 h-4 text-emerald-500" /> RENDIMIENTO (C.L.A.P.)
              </span>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center">
              <div
                ref={focusRef}
                className="h-full bg-emerald-500 w-full rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.6)]"
              />
            </div>
          </div>

          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest">
                <Activity className="w-4 h-4 text-rose-500" /> CARGA COGNITIVA
              </span>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center">
              <div
                ref={fatigueRef}
                className="h-full bg-rose-500 w-0 rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(244,63,94,0.6)]"
              />
            </div>
          </div>

          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest">
                <BrainCircuit className="w-4 h-4 text-cyan-400" /> RED NEURONAL IA
              </span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase tracking-wider">
                TF.js 4.22
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-white tracking-wide">
                {aiPrediction ? aiPrediction.className : (isAIBrainReady ? 'ENFOQUE' : 'CALIBRANDO')}
              </span>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                {aiPrediction ? `${(aiPrediction.confidence * 100).toFixed(0)}% Conf.` : (isAIBrainReady ? '100%' : 'Listo')}
              </span>
            </div>
            <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                style={{ width: `${aiPrediction ? Math.round(aiPrediction.confidence * 100) : (isAIBrainReady ? 100 : 50)}%` }}
              />
            </div>
          </div>
        </div>

        {/* WORKSPACE: Camera & Quick Chat */}
        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
          {/* FocusBud Viewport */}
          <div className="relative rounded-3xl overflow-hidden bg-zinc-950 flex-[3] flex flex-col items-center justify-center flex-1 w-full min-h-[420px] p-4 shadow-2xl border border-zinc-900">


            {/* Protagonista Visual: FocusBud Robot con Bocadillo Empático Estilizado */}
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full my-auto py-8">
              <FocusBudWidget
                state={currentFocusState}
                message={budMessage}
                isStreaming={isBudStreamingRef.current}
                isSpeaking={isBudSpeaking}
                isFlow={aiPrediction ? aiPrediction.classIndex === 1 : false}
                isFatigue={aiPrediction ? aiPrediction.classIndex === 3 : false}
                isDistress={aiPrediction ? aiPrediction.classIndex === 5 : false}
              />

            </div>

            {/* Barra Inferior: Estado de Inferencia, Postura y Botones */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 z-20 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md font-mono text-[10px] text-zinc-400 flex items-center gap-2 shadow-2xl border border-zinc-800">
                  <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`} /> {isPaused ? 'EN PAUSA' : 'INFERENCIA LOCAL (TF.js)'}
                </span>

                {/* Chip de Higiene Postural Edge (100% Determinista / Local) */}
                <span className={`px-2.5 py-1.5 rounded-md backdrop-blur-md font-mono text-[10px] flex items-center gap-1.5 shadow-2xl border transition-all duration-300 ${postureHygiene.bg} ${postureHygiene.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {postureHygiene.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerTestGrounding}
                  className="px-2.5 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-200 border border-emerald-800/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Simular descanso para probar ejercicios de grounding"
                >
                  <span>☕ </span> {timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK' ? 'VOLVER AL ENFOQUE' : 'PROBAR GROUNDING'}
                </button>

                <button
                  onClick={() => handleRecalibrate(false)}
                  className="px-2.5 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
                  title="Reiniciar calibración biométrica"
                >
                  <span>🔄</span> RECALIBRAR IA
                </button>
              </div>
            </div>

            {isPaused && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center pointer-events-none">
                <span className="text-3xl font-black tracking-[0.3em] text-blue-400 font-mono drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">PAUSADO</span>
              </div>
            )}
          </div>

          {/* Quick Info Chat */}
          <div className="rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800 flex-[2.5] flex flex-col overflow-hidden min-h-[350px]">
            {/* Header */}
            <div className="px-5 py-4 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2 shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <span className="font-mono text-sm tracking-widest text-zinc-300 font-semibold uppercase">Chat de Asistencia</span>
            </div>
            {/* Messages view */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar scroll-smooth">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm leading-relaxed font-sans ${msg.role === 'user'
                  ? 'bg-zinc-800 text-white self-end rounded-tr-sm border border-zinc-700'
                  : 'bg-emerald-500/10 text-emerald-50 self-start rounded-tl-sm border border-emerald-500/20'
                  }`}>
                  {msg.content}
                </div>
              ))}
              {isChatLoading && (
                <div className="bg-emerald-500/10 text-emerald-500 self-start rounded-tl-sm rounded-2xl px-5 py-3 border border-emerald-500/20 flex gap-2 items-center">
                  <span className="animate-pulse text-xs">●</span><span className="animate-pulse delay-75 text-xs">●</span><span className="animate-pulse delay-150 text-xs">●</span>
                </div>
              )}

              {proposedChange && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[95%] self-start bg-zinc-900 border-2 border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] tracking-widest text-emerald-500 uppercase font-bold">💡 Propuesta de Nueva Misión</span>
                    <h4 className="text-white font-semibold text-sm leading-snug">{proposedChange.proposedTask}</h4>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-zinc-800 pt-3">
                    <span className="font-mono text-[9px] tracking-wider text-zinc-500 uppercase">Micro-pasos de Acción:</span>
                    <ul className="text-xs text-zinc-400 space-y-1.5 mt-1 list-disc pl-4 leading-relaxed">
                      {proposedChange.proposedSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleAcceptProposal}
                      className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Aceptar Nueva Tarea
                    </button>
                    <button
                      onClick={() => setProposedChange(null)}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Descartar
                    </button>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
            {/* Input form */}
            <form onSubmit={handleSendChat} className="p-4 bg-zinc-950/30 border-t border-zinc-800 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Pregunta sin perder el foco..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 font-mono transition-shadow min-w-0"
                />
                <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="bg-emerald-500 text-black px-4 rounded-xl flex items-center justify-center hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-colors shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>

      {/* RIGHT PANEL: IA MENTOR DASHBOARD - Staged GPU Entrance */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="w-full lg:w-[450px] shrink-0 flex flex-col gap-6 lg:h-full min-h-0"
      >

        <div className="bg-zinc-900 rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl border border-zinc-900 min-h-[500px] relative">
          {/* Celebración Kawaii Anime Multivariada con Partículas 60 FPS */}
          <KawaiiRewardCelebration
            isVisible={isShowingReward}
            archetypeIndex={rewardArchetypeIdx}
            comboCount={currentStepIdx + 1}
          />

          <div className="p-6 pb-4 bg-zinc-900 flex justify-between items-center z-10 shadow-sm shadow-black/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <h2 className="text-white text-base sm:text-lg tracking-tight font-medium flex items-center gap-2">
                  Mentor IA Autónomo
                </h2>
                <p className="text-xs font-mono text-zinc-400 truncate max-w-[220px]" title={task}>
                  META: <span className="text-emerald-400 font-semibold">{task || 'Sesión de Enfoque'}</span>
                </p>
              </div>
            </div>
            {/* Timer & Pause Controls */}
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-lg border transition-colors cursor-pointer ${isPaused ? 'bg-blue-500 border-blue-400 text-black' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                  }`}
                title="Pausar / Reanudar (Tecla Q)"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>

              {/* HUD Pomodoro con Indicador de Estado */}
              <div className={`flex items-center gap-2 px-3 py-1.5 bg-black border rounded-xl transition-all ${
                timerMode === 'WORK'
                  ? isPaused ? 'border-zinc-800 opacity-60' : 'border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                  : 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              }`}>
                <div className="flex flex-col items-end leading-tight">
                  <span className={`text-[9px] font-mono font-bold tracking-wider uppercase flex items-center gap-1 ${
                    timerMode === 'WORK' ? 'text-green-400' : 'text-emerald-400'
                  }`}>
                    {timerMode === 'WORK' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        🟢 ENFOQUE | BLOQUE {Math.min(completedBlocks + 1, totalTargetBlocks)}/{totalTargetBlocks}
                      </>
                    ) : (
                      <>
                        ☕ DESCANSO
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Timer className={`w-4 h-4 ${timerMode === 'WORK' ? (isPaused ? 'text-zinc-600' : 'text-green-500 animate-pulse') : 'text-emerald-400 animate-pulse'}`} />
                    <span className={`font-mono text-lg tracking-[0.15em] font-bold ${
                      timerMode === 'WORK'
                        ? isPaused ? 'text-zinc-600' : 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                        : 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    }`}>
                      {formatTime(timerSecondsLeft)}
                    </span>
                  </div>
                </div>

                {/* Botón de configuración de bloques */}
                <button
                  onClick={() => setIsTimerConfigOpen(!isTimerConfigOpen)}
                  className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                  title="Ajustar minutos de enfoque / descanso"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Popover de Ajuste Rápido Pomodoro */}
              <AnimatePresence>
                {isTimerConfigOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute right-0 top-14 z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-3 shadow-2xl w-64 text-xs space-y-2 select-none"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                      <span>Calibrar Pomodoro</span>
                      <button onClick={() => setIsTimerConfigOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer">✕</button>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => {
                          setWorkDuration(25 * 60);
                          setBreakDuration(5 * 60);
                          if (timerMode === 'WORK') setTimerSecondsLeft(25 * 60);
                          else setTimerSecondsLeft(5 * 60);
                          setIsTimerConfigOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex justify-between items-center cursor-pointer ${
                          workDuration === 25 * 60 && breakDuration === 5 * 60
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'hover:bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">25 min / 5 min</div>
                          <div className="text-[10px] text-zinc-500">Pomodoro Clásico</div>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">25/5</span>
                      </button>
                      <button
                        onClick={() => {
                          setWorkDuration(40 * 60);
                          setBreakDuration(10 * 60);
                          if (timerMode === 'WORK') setTimerSecondsLeft(40 * 60);
                          else setTimerSecondsLeft(10 * 60);
                          setIsTimerConfigOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex justify-between items-center cursor-pointer ${
                          workDuration === 40 * 60 && breakDuration === 10 * 60
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'hover:bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">40 min / 10 min</div>
                          <div className="text-[10px] text-zinc-500">Deep Work Moderado</div>
                        </div>
                        <span className="text-[11px] font-mono text-cyan-400 font-bold">40/10</span>
                      </button>
                      <button
                        onClick={() => {
                          setWorkDuration(50 * 60);
                          setBreakDuration(10 * 60);
                          if (timerMode === 'WORK') setTimerSecondsLeft(50 * 60);
                          else setTimerSecondsLeft(10 * 60);
                          setIsTimerConfigOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex justify-between items-center cursor-pointer ${
                          workDuration === 50 * 60 && breakDuration === 10 * 60
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'hover:bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">50 min / 10 min</div>
                          <div className="text-[10px] text-zinc-500">Sprint Extendido</div>
                        </div>
                        <span className="text-[11px] font-mono text-purple-400 font-bold">50/10</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between overflow-y-auto custom-scrollbar">
            {timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK' ? (
              <GroundingBreak
                remainingSeconds={timerSecondsLeft}
                onSkipBreak={handleSkipBreak}
                formatTime={formatTime}
              />
            ) : currentStepIdx < steps.length ? (
              <div className="flex-1 flex flex-col justify-between">
                {/* a) Insignia de Progreso y Barra Delgada */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span className="font-semibold tracking-wider text-zinc-300">
                      PASO {currentStepIdx + 1} DE {steps.length}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {Math.round((currentStepIdx / steps.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round((currentStepIdx / steps.length) * 100))}%` }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* b) Tarjeta de Acción Única */}
                <div className="my-auto py-6 flex items-center justify-center flex-1 w-full min-h-[220px]">
                  <motion.div
                    key={`step-card-${currentStepIdx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={`w-full p-6 sm:p-8 rounded-3xl flex flex-col items-center justify-center text-center relative group transition-colors duration-200 ${
                      /^PAUSA(\s+SOMÁTICA)?/i.test(steps[currentStepIdx] || '')
                        ? 'bg-gradient-to-b from-amber-950/30 via-zinc-950/90 to-zinc-950 border border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
                        : 'bg-zinc-950 border border-zinc-800/80 shadow-2xl hover:border-emerald-500/30'
                    }`}
                  >
                    {/^PAUSA(\s+SOMÁTICA)?/i.test(steps[currentStepIdx] || '') ? (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-semibold uppercase tracking-wider mb-5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Pausa Somática / Biorregulación
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium uppercase tracking-wider mb-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Paso Activo
                      </div>
                    )}

                    <p className={`text-xl sm:text-2xl font-semibold leading-relaxed tracking-tight max-w-md break-words select-text ${
                      /^PAUSA(\s+SOMÁTICA)?/i.test(steps[currentStepIdx] || '') ? 'text-amber-100 font-medium' : 'text-white'
                    }`}>
                      {steps[currentStepIdx] || 'Cargando paso...'}
                    </p>
                  </motion.div>
                </div>

                {/* c) Botón de Completado */}
                <div className="pt-2 relative">
                  {/* Píldora de Recompensa de Dopamina y Gamificación */}
                  <div className="flex items-center justify-center mb-2.5">
                    <div className={`px-4 py-1.5 rounded-full border text-[11px] font-mono font-bold tracking-wider uppercase flex items-center gap-2 transition-all duration-300 ${
                      isShowingReward
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 scale-105 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                        : 'bg-zinc-950/80 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    }`}>
                      <Zap className={`w-3.5 h-3.5 ${isShowingReward ? 'animate-bounce text-amber-400' : 'text-emerald-400'}`} />
                      <span>ENERGÍA +100 CLAP • DOPAMINA</span>
                      <Sparkles className={`w-3.5 h-3.5 ${isShowingReward ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
                    </div>
                  </div>

                  <button
                    onClick={handleNextStep}
                    className={`w-full py-4 sm:py-5 font-black text-base sm:text-lg rounded-2xl transition-all flex items-center justify-center gap-2 relative group overflow-hidden active:scale-[0.99] cursor-pointer ${
                      isShowingReward
                        ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-zinc-950 shadow-[0_0_40px_rgba(52,211,153,0.5)] scale-[1.02]'
                        : /^PAUSA(\s+SOMÁTICA)?/i.test(steps[currentStepIdx] || '')
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                        : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_30px_rgba(34,197,94,0.25)]'
                    }`}
                  >
                    {isShowingReward ? "¡VAMOS CON TODO! 🚀" : /^PAUSA(\s+SOMÁTICA)?/i.test(steps[currentStepIdx] || '') ? "CONCLUIR PAUSA Y CONTINUAR ▶️" : "COMPLETAR PASO"}
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  </button>

                  {currentStepIdx + 1 < steps.length ? (
                    <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] font-mono text-zinc-400">
                      <span className="text-zinc-500 font-semibold">SIGUIENTE:</span>
                      <span className="truncate max-w-[280px] text-zinc-300 font-medium">
                        {steps[currentStepIdx + 1]}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider font-mono text-center text-emerald-400/80 mt-2.5 font-semibold">
                      ÚLTIMO PASO • META CASI ALCANZADA
                    </p>
                  )}
                </div>
              </div>
            ) : steps.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full max-w-md mx-auto my-auto p-5 sm:p-6 rounded-3xl bg-zinc-950 border border-emerald-500/30 text-center flex flex-col items-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none rounded-3xl" />

                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-0 shadow-[0_0_25px_rgba(16,185,129,0.25)] shrink-0">
                  <Sparkles className="w-6 h-6 animate-pulse text-emerald-400" />
                </div>

                <div className="space-y-0.5 shrink-0">
                  <h3 className="font-black text-2xl sm:text-3xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-teal-200">
                    ¡SESIÓN COMPLETADA!
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 font-medium truncate max-w-[320px]">
                    {task || "Sesión de Trabajo"}
                  </p>
                </div>

                {/* Métricas Resumen de la Sesión */}
                <div className="grid grid-cols-2 gap-2 w-full my-0.5 shrink-0">
                  <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-zinc-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-emerald-400" /> Tiempo:</span>
                    <strong className="text-white">{formatTime(elapsedTime)}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-zinc-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5 text-cyan-400" /> Foco Med:</span>
                    <strong className="text-white">
                      {focusSamplesRef.current.length > 0 
                        ? `${Math.round(focusSamplesRef.current.reduce((a, b) => a + b, 0) / focusSamplesRef.current.length)}%` 
                        : `${Math.round(metricsRef.current.nivel_clap)}%`}
                    </strong>
                  </div>
                </div>

                {/* Tarjeta de Debriefing Cognitivo con Meta Muse Spark en Baseten con scroll interno limpio */}
                <div className="w-full text-left p-3.5 rounded-2xl bg-zinc-900/90 border border-purple-500/30 shadow-inner space-y-1.5 max-h-36 sm:max-h-44 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between sticky top-0 bg-zinc-900/95 py-0.5 z-10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[10px] font-mono tracking-wider uppercase text-purple-300 font-bold">
                        Debriefing Cognitivo • Meta Muse Spark
                      </span>
                    </div>
                    {isDebriefLoading && (
                      <span className="text-[9px] font-mono text-zinc-400 animate-pulse">Sintetizando...</span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
                    {isDebriefLoading ? (
                      <span className="text-zinc-500 italic">Generando análisis cognitivo con Meta Muse Spark en Baseten...</span>
                    ) : (
                      sessionDebrief || "Excelente disciplina. Has mantenido estabilidad cognitiva y cerrado el ciclo de trabajo."
                    )}
                  </p>
                </div>

                {/* Botón Nueva Sesión siempre visible y clickeable */}
                <button
                  onClick={handleStartNewSession}
                  className="w-full mt-1 py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm sm:text-base rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-[0.99] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  INICIAR NUEVA SESIÓN
                </button>
              </motion.div>
            ) : null}

          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <>
      {/* Sensores de hardware permanentes (100% On-Device Zero-Latency) */}
      <video ref={videoRef} className="hidden" playsInline autoPlay muted />
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      {/* Pantalla Cinemática de Pre-Calentamiento de Hardware (Paso 1) */}
      <PreWarmupScreen
        isVisible={isPreWarmupVisible}
        steps={warmupSteps}
        progress={warmupProgress}
        onSkip={() => {
          setIsPreWarmupVisible(false);
          setIsAppLoading(false);
        }}
      />

      {/* Barra Lateral Colapsable Gemini / Android Workspace (Paso 5) */}
      <CollapsibleSidebar
        currentTask={task}
        onNewSession={handleStartNewSession}
        onSelectPastSession={handleSelectPastSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
        apiStatus={apiStatus}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isHeroStage={appStage === 'LOGIN'}
      />

      <div className="w-full min-h-screen relative bg-zinc-950 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {showSurvey && !isStarted ? (
            <motion.div
              key="stage-survey"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full min-h-screen"
            >
              {renderSurveyStage()}
            </motion.div>
          ) : appStage === 'LOGIN' ? (
            <motion.div
              key="stage-login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full min-h-screen"
            >
              {renderLoginStage()}
            </motion.div>
          ) : appStage === 'BRIEFING' ? (
            <motion.div
              key="stage-briefing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full min-h-screen"
            >
              {renderBriefingStage()}
            </motion.div>
          ) : (
            <motion.div
              key="stage-focus"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.14 } }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full min-h-screen"
            >
              {renderFocusStage()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {renderGlobalSettings()}
    </>
  );
}
