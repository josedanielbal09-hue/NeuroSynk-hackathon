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
  getDefaultGoogleApiKey,
  streamMuseSparkIntervention,
  sessionDebriefUniversal,
  celebrateStepUniversal,
  BiometricTelemetryPayload,
  SessionDebriefResult
} from './services/metaModelClient';
import { KawaiiRewardCelebration, REWARD_ARCHETYPES } from './components/rewards/KawaiiRewardCelebration';
import { NeuroSynkSettingsModal } from './components/settings/NeuroSynkSettingsModal';
import { useSettings } from './context/SettingsContext';


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
      {/* Circular dark body with neon green outline */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="#09090b"
        stroke="#22c55e"
        strokeWidth="4"
      />

      {/* Minimalist expressive eyes */}
      <g>
        {expression === 'normal' && (
          <>
            {/* Left eye */}
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
            {/* Right eye */}
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
    case 'DEEP FOCUS (FLOW)':
    case 'NORMAL STUDY / NEUTRAL':
    case 'FOCUS':
    case 'ENFOQUE PROFUNDO (FLOW)':
    case 'ESTUDIO NORMAL / NEUTRO':
    case 'ENFOQUE':
      return 'ENFOQUE';
    case 'DISTRACTION':
    case 'COGNITIVE DISTRACTION':
    case 'OVERSTIMULATION':
    case 'DISTRACCIÓN':
    case 'SOBREESTIMULACIÓN':
      return 'ALERTA_SUAVE';
    case 'FATIGUE':
    case 'EYE FATIGUE / DROWSINESS':
    case 'FATIGA':
      return 'FATIGA';
    case 'POSTURAL STRAIN':
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

const getDefaultSurveyQuestions = (lang: 'es' | 'en'): SurveyQuestion[] =>
  lang === 'es'
    ? [
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
          question: "¿Qué resultado tangible quieres lograr al terminar este bloque?",
          options: [
            "Comprender el concepto central",
            "Resolver un ejercicio o apartado",
            "Terminar un entregable concreto"
          ]
        },
        {
          id: "q3",
          question: "¿Cuál es tu nivel de preparación o familiaridad con el material?",
          options: [
            "Empezando completamente desde cero",
            "Tengo las bases y apuntes listos",
            "Domino el tema, listo para producir"
          ]
        },
        {
          id: "q4",
          question: "¿Cómo describirías tu energía y enfoque ahora mismo?",
          options: [
            "Energía alta y enfoque claro",
            "Energía moderada / neutral",
            "Mente dispersa o fatiga inicial"
          ]
        },
        {
          id: "q5",
          question: "¿En qué punto sueles sentir mayor bloqueo o fricción?",
          options: [
            "Romper la inercia inicial para arrancar",
            "A mitad del material técnico denso",
            "Al cerrar y pulir los detalles finales"
          ]
        }
      ]
    : [
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
      ];

type TimerMode = 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';

export default function App() {
  const { language, t } = useSettings();
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Dynamic Context Calibration Survey States
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [showSurvey, setShowSurvey] = useState<boolean>(false);
  const [isSurveyLoading, setIsSurveyLoading] = useState<boolean>(false);

  // Adaptive Pomodoro Timer
  const [workDuration, setWorkDuration] = useState<number>(25 * 60);
  const [breakDuration, setBreakDuration] = useState<number>(5 * 60);
  const [timerMode, setTimerMode] = useState<TimerMode>('WORK');
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [completedBlocks, setCompletedBlocks] = useState<number>(0);
  const [totalTargetBlocks, setTotalTargetBlocks] = useState<number>(2);

  // Audio configuration
  const [isBrownNoiseActive, setIsBrownNoiseActive] = useState<boolean>(false);
  const [noiseVolume, setNoiseVolume] = useState<number>(0.3);
  const [isTimerConfigOpen, setIsTimerConfigOpen] = useState<boolean>(false);

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isPreWarmupVisible, setIsPreWarmupVisible] = useState(true);
  const [warmupProgress, setWarmupProgress] = useState(25);
  const [warmupSteps, setWarmupSteps] = useState<WarmupStep[]>([
    { id: 'webgl', label: 'WebGL Neural Engine (TensorFlow.js)', status: 'loading', detail: 'COMPILING' },
    { id: 'mediapipe', label: 'Biomechanical Vision (MediaPipe Holistic)', status: 'pending' },
    { id: 'camera', label: 'Optical Sensor & Baseline Calibration', status: 'pending' }
  ]);
  const hasFirstLandmarkRef = useRef(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mascotExpression, setMascotExpression] = useState<'normal' | 'blink' | 'happy'>('normal');
  const [proposedChange, setProposedChange] = useState<{ proposedTask: string; proposedSteps: string[] } | null>(null);

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    const isCleared = localStorage.getItem('gemini_api_key_cleared') === 'true';
    const stored = (localStorage.getItem('gemini_api_key') || '').trim();
    // Purge any legacy Baseten API key that does not start with Google's "AIza" prefix
    if (stored && !stored.startsWith('AIza')) {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('baseten_api_key');
      const googleKey = getDefaultGoogleApiKey();
      localStorage.setItem('gemini_api_key', googleKey);
      return googleKey;
    }
    if (stored.startsWith('AIza')) return stored;
    if (isCleared) return '';
    const googleKey = getDefaultGoogleApiKey();
    localStorage.setItem('gemini_api_key', googleKey);
    return googleKey;
  });

  useEffect(() => {
    const stored = (localStorage.getItem('gemini_api_key') || '').trim();
    if (!stored || !stored.startsWith('AIza')) {
      const googleKey = getDefaultGoogleApiKey();
      localStorage.removeItem('baseten_api_key');
      localStorage.setItem('gemini_api_key', googleKey);
      setGeminiApiKey(googleKey);
    }
  }, []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);

  const handleStartNewSession = () => {
    // If previous session had progress, save it to local history
    if (currentSessionIdRef.current && (elapsedTimeRef.current > 15 || currentStepIdx > 0)) {
      const focusHistory = focusSamplesRef.current;
      const avgFocus = focusHistory.length > 0
        ? Math.round(focusHistory.reduce((a, b) => a + b, 0) / focusHistory.length)
        : Math.round(metricsRef.current.nivel_clap);
      saveSessionItem({
        id: currentSessionIdRef.current,
        task: task || 'Work Session',
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
  const [apiStatus, setApiStatus] = useState<'browser' | 'server' | 'none'>(() => {
    const isCleared = localStorage.getItem('gemini_api_key_cleared') === 'true';
    const stored = (localStorage.getItem('gemini_api_key') || '').trim();
    if (stored) return 'browser';
    if (isCleared) return 'none';
    const envKey = (typeof process !== 'undefined' && (process.env as any)?.GEMINI_API_KEY ? (process.env as any).GEMINI_API_KEY : '').trim();
    return envKey ? 'browser' : 'server';
  });

  useEffect(() => {
    let isMounted = true;
    const checkApiStatus = async () => {
      const currentKey = (geminiApiKey || localStorage.getItem('gemini_api_key') || (typeof process !== 'undefined' && (process.env as any)?.GEMINI_API_KEY ? (process.env as any).GEMINI_API_KEY : '')).trim();
      if (currentKey) {
        const res = await testGeminiConnection(currentKey);
        if (!isMounted) return;
        setKeyTestResult(res);
        if (res.success) {
          setApiStatus('browser');
          return;
        }
      }
      try {
        const response = await fetch('/api/api-status');
        if (response.ok) {
          const data = await response.json();
          if (data.keyValid) {
            if (isMounted) setApiStatus('server');
            return;
          }
        }
      } catch (e) {
        // Static deployment fallback
      }
      if (isMounted) setApiStatus('none');
    };
    checkApiStatus();
    return () => {
      isMounted = false;
    };
  }, [geminiApiKey]);


  // Chat States
  const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>(() => [
    {
      role: 'assistant',
      content: language === 'es'
        ? '¿Duda rápida? Pregúntame aquí sin romper tu flujo de enfoque.'
        : 'Quick question? Ask away without breaking your flow.'
    }
  ]);

  useEffect(() => {
    setChatMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [{
          role: 'assistant',
          content: language === 'es'
            ? '¿Duda rápida? Pregúntame aquí sin romper tu flujo de enfoque.'
            : 'Quick question? Ask away without breaking your flow.'
        }];
      }
      return prev;
    });
  }, [language]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // PDEF v1.0 Core State
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

    // Task subdivision
    subdivided_indexes: [] as number[],
    is_subdividing: false,

    // UI mapped properties
    nivel_clap: 100.0,
    nivel_carga: 0.0,
  });

  // TensorFlow.js Neural Network Engine State
  const [isAIBrainReady, setIsAIBrainReady] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResult | null>(null);
  const windowFramesRef = useRef<{ ear: number; yaw: number; pitch: number; frown: number; noseDelta: number; gazeVar: number; shoulder: number; mar: number; roll: number; t: number }[]>([]);
  const lastNoseRef = useRef<{ x: number; y: number } | null>(null);
  const lastAiUpdateRef = useRef<number>(0);
  const displayedClassRef = useRef<number>(0);
  const pendingClassRef = useRef<number | null>(null);
  const pendingClassSinceRef = useRef<number>(0);

  // Initial AI brain load & WebGL shader pre-compilation
  useEffect(() => {
    loadNeuroSynkBrain().then(res => {
      setIsAIBrainReady(res.isReady);
      if (res.isReady) {
        setWarmupSteps(prev => prev.map(s => s.id === 'webgl' ? { ...s, status: 'completed', detail: '60 FPS' } : (s.id === 'mediapipe' ? { ...s, status: 'loading', detail: 'WASM ACTIVE' } : s)));
        setWarmupProgress(prev => Math.max(prev, 50));
      }
    });
  }, []);

  // Deterministic local postural hygiene state (100% Edge Privacy)
  const [postureHygiene, setPostureHygiene] = useState<{
    status: 'OPTIMAL' | 'NECK_TILT' | 'SHOULDER_TENSION';
    label: string;
    color: string;
    bg: string;
  }>({
    status: 'OPTIMAL',
    label: 'Optimal Posture',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-800/40'
  });
  const lastPostureUpdateRef = useRef<number>(0);

  // Muse Spark streaming & voice micro-intervention to FocusBud
  const isBudStreamingRef = useRef<boolean>(false);
  const [isBudSpeaking, setIsBudSpeaking] = useState<boolean>(false);
  const isBudSpeakingAudioRef = useRef<boolean>(false);
  const lastSpokenTimeRef = useRef<number>(0);

  /**
   * Unified helper for FocusBud to speak autonomously with real English voice synthesis
   * while synchronizing its animated mouth and top speech bubble.
   */
  const speakFocusBud = (text: string, options?: { rate?: number; pitch?: number; force?: boolean }) => {
    if (!text || typeof window === 'undefined') return;
    const now = Date.now();
    // Prevent collisions or spam if already speaking (unless forced)
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


  // Accumulated metrics for post-session cognitive debrief
  const focusSamplesRef = useRef<number[]>([]);
  const flowSamplesCountRef = useRef<number>(0);
  const fatigueEventsCountRef = useRef<number>(0);
  const [sessionDebrief, setSessionDebrief] = useState<string | null>(null);
  const [isDebriefLoading, setIsDebriefLoading] = useState<boolean>(false);
  const debriefRequestedRef = useRef<boolean>(false);

  // Helper to extract anonymous local biometric telemetry for the AI Mentor
  const getBiometricTelemetry = (): BiometricTelemetryPayload => ({
    cognitiveState: aiPrediction?.className || 'NEUTRAL',
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
  const isStartedRef = useRef(false);
  const languageRef = useRef<'es' | 'en'>(language);
  const rewardTimeoutRef = useRef<number | null>(null);

  // Sync refs for MediaPipe callback
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isStartedRef.current = isStarted;
  }, [isStarted]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

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

      // Avoid subdividing an already subdivided sub-step (e.g. "3.1")
      const isAlreadySubStep = /\b\d+\.\d+\b/.test(parentStepText);
      if (isAlreadySubStep) {
        metrics.is_subdividing = false;
        return;
      }

      setIsChatLoading(true);
      const isEs = languageRef.current === 'es';
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: isEs
          ? `⚙️ Analizando dificultad del paso... Dividiendo "${parentStepText}" en 3 micro-hitos más sencillos.`
          : `⚙️ Analyzing current step difficulty... Breaking "${parentStepText}" down into smaller milestones.`
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
            content: isEs
              ? `💡 ¡Listo! Dividí este paso en 3 micro-acciones más ligeras:\n${data.subSteps.map((s: string) => `• ${s}`).join('\n')}\n\nEnfoquémonos en el primero. ¡Tú puedes!`
              : `💡 Done! I split this step into 3 simpler milestones:\n${data.subSteps.map((s: string) => `• ${s}`).join('\n')}\n\nLet's focus on the first sub-step. You've got this!`
          }]);
        } else {
          throw new Error("Invalid response");
        }
      } catch (err) {
        console.error("Error subdividing step:", err);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: isEs
            ? `⚠️ No se pudo subdividir el paso automáticamente, respira un momento si lo necesitas.`
            : `⚠️ Couldn't break the step down automatically, take a quick breath if you need one.`
        }]);
      } finally {
        setIsChatLoading(false);
        metrics.is_subdividing = false;
      }
    };
  }, [steps, task, isChatLoading, geminiApiKey]);

  // Keyboard Listener (Q to pause) — Shielded against INPUT, TEXTAREA & contentEditable elements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = (e.target as HTMLElement) || (document.activeElement as HTMLElement);
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
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

  // Trigger Post-Session Cognitive Debrief upon completing all steps
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
        task: task || 'Work Session',
        totalMinutes: totalMins,
        completedStepsCount: steps.length,
        totalStepsCount: steps.length,
        averageFocus: avgFocus,
        flowPercentage: flowPct,
        fatigueEventsCount: fatigueEventsCountRef.current
      }).then(res => {
        setSessionDebrief(res.debrief);

        // Save completed session with debrief to local history
        const finalSessionId = currentSessionIdRef.current || `session-${Date.now()}`;
        saveSessionItem({
          id: finalSessionId,
          task: task || 'Work Session',
          timestamp: Date.now(),
          durationMinutes: totalMins,
          completedSteps: steps.length,
          totalSteps: steps.length,
          avgFocus: avgFocus,
          debriefSummary: res.debrief,
          status: 'COMPLETADA'
        });

          // FocusBud synthesizes the debrief with empathetic voice in the active language (5 to 8 seconds)
        const spokenDebrief = languageRef.current === 'es'
          ? `¡Sesión completada con éxito! Terminaste todos los pasos de ${task || 'tu meta'}. Tu enfoque promedio fue de ${avgFocus} por ciento. ¡Excelente constancia!`
          : `Session completed successfully! You finished every step of ${task || 'your goal'}. Your average focus was ${avgFocus} percent. Outstanding consistency!`;
        speakFocusBud(spokenDebrief, { force: true, rate: 0.98 });
      }).catch(err => {
        console.warn("[Debrief Error]:", err);
        const fallback = languageRef.current === 'es'
          ? `SESIÓN COMPLETADA: Terminaste todos los pasos de "${task}". Tu enfoque promedio fue de ${avgFocus}%. Toma aire profundo y celebra este avance tangible.`
          : `SESSION COMPLETE: You finished all steps of "${task}". Your average focus was ${avgFocus}%. Take a deep breath and celebrate this tangible progress.`;
        setSessionDebrief(fallback);

        const finalSessionId = currentSessionIdRef.current || `session-${Date.now()}`;
        saveSessionItem({
          id: finalSessionId,
          task: task || 'Work Session',
          timestamp: Date.now(),
          durationMinutes: totalMins,
          completedSteps: steps.length,
          totalSteps: steps.length,
          avgFocus: avgFocus,
          debriefSummary: fallback,
          status: 'COMPLETADA'
        });

        const spokenFallback = languageRef.current === 'es'
          ? `¡Sesión completada! Excelente trabajo terminando todos tus pasos. Descansa la mente y estira un poco.`
          : `Session complete! Great job finishing all your steps. Rest your mind and stretch a bit.`;
        speakFocusBud(spokenFallback, { force: true, rate: 0.98 });
      }).finally(() => {
        setIsDebriefLoading(false);
      });

    }
  }, [currentStepIdx, steps.length, elapsedTime, task]);

  // Ambient Audio Controls (Brown Noise)
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
    // Toggle between break and work mode for testing grounding exercises
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

  // Adaptive Pomodoro Timer Loop
  useEffect(() => {
    let timerInterval: any = null;
    if (isStarted && isTimerRunning && !isPaused) {
      timerInterval = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
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

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      brownNoise.stop();
    };
  }, []);

  // UX states for Micro-rewards (Kawaii Anime 60 FPS Celebration)
  const [rewardKaomoji, setRewardKaomoji] = useState('');
  const [isShowingReward, setIsShowingReward] = useState(false);
  const [rewardArchetypeIdx, setRewardArchetypeIdx] = useState(0);
  const [isStateLocked] = useState(false);
  const mascotExpressionRef = useRef<'normal' | 'blink' | 'happy'>('normal');
  const KAOMOJIS = ["(๑˃̵ᴗ˂̵)و 🚀", "✨ STELLAR ✨", "🌸 FLOWING 🌸", "⚡️ ENERGY ⚡️", "(ง'̀-'́)ง ⚡️"];

  // FocusBud Contextual Notifications (Body Doubling)
  const stepDistractionsRef = useRef<number>(0);
  const prevAvatarStateRef = useRef<FocusState>('ENFOQUE');

  const isBreakActive = timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK';

  const currentFocusState: FocusState = (isBreakActive || isPaused)
    ? 'PAUSA'
    : isShowingReward
    ? 'CELEBRACION'
    : mapAIPredictionToAvatarState(aiPrediction?.className);

  // Direct biometric state emitted by the Neural Network (e.g. 'POSTURAL STRAIN', 'OVERSTIMULATION', 'ENFOQUE')
  const rawAIState = (isBreakActive || isPaused)
    ? 'PAUSA'
    : isShowingReward
    ? 'CELEBRACION'
    : (aiPrediction?.className || 'ENFOQUE');

  const currentActiveStep = steps[currentStepIdx] || '';
  const [budMessage, setBudMessage] = useState<string>(() =>
    getBudContextualMessage('ENFOQUE', { stepText: '', distractionCount: 0, lang: language })
  );

  useEffect(() => {
    if (isBudStreamingRef.current) return;
    if (isBreakActive) {
      setBudMessage(
        language === 'es'
          ? '¡Excelente trabajo! Bloque completado. Momento de un breve descanso.'
          : 'Great job. Block complete. Time for a short rest.'
      );
      return;
    }

    if (currentFocusState === 'ALERTA_SUAVE' && prevAvatarStateRef.current !== 'ALERTA_SUAVE') {
      stepDistractionsRef.current += 1;
    }
    prevAvatarStateRef.current = currentFocusState;

    const msg = getBudContextualMessage(rawAIState, {
      stepText: currentActiveStep,
      distractionCount: stepDistractionsRef.current,
      lang: language
    });
    setBudMessage(msg);
  }, [rawAIState, currentFocusState, currentStepIdx, steps, currentActiveStep, isBreakActive, language]);

  // Reset distraction counter when changing or completing a step
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
        steps[currentStepIdx] || 'General preparation',
        task || 'Study / Work',
        getBiometricTelemetry()
      );

      const replyText = typeof data.reply === 'string' ? data.reply : "⚠️ Neural decoding error.";

      setChatMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      if (data.proposal) {
        setProposedChange(data.proposal);
      }

      // FocusBud speaks the first sentence of the reply live (3-5 seconds)
      const firstSentence = replyText.split(/[.!?]\s+/)[0] || replyText;
      const cleanVoice = firstSentence.replace(/[*_#"`]/g, '').trim();
      if (cleanVoice.length > 4 && !cleanVoice.startsWith('⚠️')) {
        const spokenShort = cleanVoice.length > 85 ? cleanVoice.substring(0, 80) + '...' : cleanVoice;
        speakFocusBud(spokenShort, { force: true, rate: 1.04 });
      }

    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Unstable neural link.' }]);
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
          steps[currentStepIdx] || 'Work in progress',
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

  const handleStart = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalTask = task.trim() ? task : (language === 'es' ? 'Estudiar material general' : 'Study general material');
    setTask(finalTask);
    setIsSurveyLoading(true);

    try {
      const data = await taskSurveyUniversal(finalTask, geminiApiKey);
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setSurveyQuestions(data.questions);
      } else {
        setSurveyQuestions(getDefaultSurveyQuestions(language));
      }
    } catch (err) {
      console.error("Task survey fetch error:", err);
      setSurveyQuestions(getDefaultSurveyQuestions(language));
    } finally {
      setSurveyAnswers({});
      setShowSurvey(true);
      setIsSurveyLoading(false);
    }
  };

  const handleGenerateFromSurvey = async (useAnswers: boolean = true) => {
    setIsLoading(true);
    const answersToSend = useAnswers ? surveyAnswers : {};
    let resolvedSteps: string[] = [];

    try {
      const data = await splitTaskUniversal(
        task,
        answersToSend,
        `Work mode: ${workMode}, Sensitivity: ${sensitivity}`,
        geminiApiKey
      );

      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        resolvedSteps = data.steps.map((s: any) => String(typeof s === 'string' ? s : (s?.step || s?.text || s?.description || s?.action || s || '')).replace(/(Step \d+\.\d+:|Step \d+:|Paso \d+\.\d+:|Paso \d+:)/i, '').trim()).filter(Boolean);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error generating work roadmap:", err);
      resolvedSteps = language === 'es'
        ? [
            `DEFINE el objetivo concreto y alcance de '${task}'.`,
            `ORGANIZA los materiales o herramientas esenciales para comenzar.`,
            `DESARROLLA el primer bloque central con atención plena.`,
            `PAUSA SOMÁTICA: Aparta la vista de la pantalla, bebe agua y estira los brazos durante 3 minutos.`,
            `VERIFICA y consolida el avance logrado.`
          ]
        : [
            `DEFINE the core objective and scope of '${task}'.`,
            `ORGANIZE the essential materials or sources to get started.`,
            `DEVELOP the first central block with full focus.`,
            `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 3 minutes.`,
            `REVIEW and consolidate the progress achieved.`
          ];
    } finally {
      setSteps(resolvedSteps);

      // Synchronize with Duration Survey (surveyAnswers.q1)
      const q1Ans = surveyAnswers.q1 || '';
      let wDur = 25 * 60;
      let bDur = 5 * 60;
      let targetBlocks = 2;

      if (q1Ans.includes('30') || q1Ans.toLowerCase().includes('sprint')) {
        wDur = 25 * 60;
        bDur = 5 * 60;
        targetBlocks = 1;
      } else if (q1Ans.includes('60') || q1Ans.toLowerCase().includes('standard') || q1Ans.toLowerCase().includes('estándar') || q1Ans.toLowerCase().includes('estandar')) {
        wDur = 25 * 60;
        bDur = 5 * 60;
        targetBlocks = 2;
      } else if (q1Ans.includes('90') || q1Ans.includes('120') || q1Ans.toLowerCase().includes('deep') || q1Ans.toLowerCase().includes('profunda')) {
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

      // Start and log the new session in local history
      const sId = `session-${Date.now()}`;
      currentSessionIdRef.current = sId;
      saveSessionItem({
        id: sId,
        task: task || 'Work Session',
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
      const sysMsg = { role: 'system', content: `The user is in a briefing interview to set up their tasks. Current task: "${task}". Mode: ${workMode}. Ask another brief question in English if you need more context to create micro-steps, or encourage them if you have what you need.` };

      const data = await chatUniversal(
        [sysMsg, ...currentMsgs, { role: 'user', content: userMsg }],
        geminiApiKey,
        'Initial briefing',
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
    const contextStr = briefingMsgs.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
    let resolvedSteps: string[] = [];

    try {
      const data = await splitTaskUniversal(
        task,
        {},
        contextStr,
        geminiApiKey
      );

      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        resolvedSteps = data.steps.map((s: any) => String(typeof s === 'string' ? s : (s?.step || s?.text || s?.description || s?.action || s || '')).replace(/(Step \d+\.\d+:|Step \d+:|Paso \d+\.\d+:|Paso \d+:)/i, '').trim()).filter(Boolean);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      resolvedSteps = language === 'es'
        ? ['PREPARA tus materiales', 'INICIA la primera fase', 'REVISA tu avance', 'CONCLUYE y guarda']
        : ['PREPARE materials', 'START first phase', 'REVIEW progress', 'WRAP UP'];
    } finally {
      setSteps(resolvedSteps);
      setIsTimerRunning(true);
      setTimerSecondsLeft(workDuration);
      setTimerMode('WORK');
      setCompletedBlocks(0);
      setIsLoading(false);
      setIsStarted(true);
      setAppStage('FOCUS');

      // Start and log the new session in local history
      const sId = `session-${Date.now()}`;
      currentSessionIdRef.current = sId;
      saveSessionItem({
        id: sId,
        task: task || (language === 'es' ? 'Sesión de Trabajo' : 'Work Session'),
        timestamp: Date.now(),
        durationMinutes: 0,
        completedSteps: 0,
        totalSteps: resolvedSteps.length,
        avgFocus: 100,
        status: 'EN_PROGRESO'
      });

      // Autonomous FocusBud voice welcome (3-4 seconds) in active language
      setTimeout(() => {
        const welcomePhrases = languageRef.current === 'es'
          ? [
              `¡Todo listo! Iniciamos tu sesión de ${task || 'estudio'}. Estoy aquí contigo en cada paso.`,
              `¡Enfoque activado! Primer micro-paso en marcha. Avancemos a buen ritmo.`
            ]
          : [
              `All set! Starting your ${task || 'study'} session. I am right here with you every step of the way.`,
              `Focus activated! First micro-step underway. Let's move at our own steady pace.`
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
        // Wait for MediaPipe to be injected on window
        let waitCount = 0;
        while (!window.Holistic && waitCount < 30 && isComponentMounted) {
          await new Promise(r => setTimeout(r, 150));
          waitCount++;
        }

        if (!isComponentMounted) return;

        if (!window.Holistic) {
          console.warn("⚠️ MediaPipe CDN did not respond in time. Continuing in resilience mode...");
          setWarmupSteps(prev => prev.map(s => s.id === 'mediapipe' ? { ...s, status: 'completed', detail: 'CDN OFFLINE' } : s));
          setWarmupProgress(prev => Math.max(prev, 80));
          setTimeout(() => {
            setIsPreWarmupVisible(false);
            setIsAppLoading(false);
          }, 600);
          return;
        }

        try {
          // 1. Initialize Holistic in Lightweight Mode (Complexity 0)
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
            setWarmupSteps(prev => prev.map(s => s.id === 'mediapipe' ? { ...s, status: 'completed', detail: 'WASM ACTIVE' } : (s.id === 'camera' ? { ...s, status: 'loading', detail: 'ACCESSING' } : s)));
            setWarmupProgress(prev => Math.max(prev, 70));
          }

          // 2. Request native camera at 320x240 (1/4 RAM and USB/WASM bandwidth footprint)
          if (statusRef.current) statusRef.current.textContent = "REQUESTING CAMERA...";
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

            // 3. Throttled frame processing
            videoRef.current.onplaying = () => {
              if (isComponentMounted) {
                setWarmupSteps(prev => prev.map(s => s.id === 'camera' ? { ...s, status: 'completed', detail: 'STREAM ACTIVE' } : s));
                setWarmupProgress(prev => Math.max(prev, 90));
              }

              // Safety fallback: if no landmarks detected within 3.5s, unlock smoothly
              setTimeout(() => {
                if (!hasFirstLandmarkRef.current && isComponentMounted) {
                  hasFirstLandmarkRef.current = true;
                  setWarmupSteps(prev => prev.map(s => ({ ...s, status: 'completed', detail: s.detail || 'STREAM ACTIVE' })));
                  setWarmupProgress(100);
                  setTimeout(() => {
                    setIsPreWarmupVisible(false);
                    setIsAppLoading(false);
                  }, 400);
                }
              }, 3500);

              if (statusRef.current) statusRef.current.textContent = "ANALYZING BIOMETRICS...";

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
          console.warn("[Hardware Warmup] Camera access optional or blocked:", error);
          if (isComponentMounted) {
            setWarmupSteps(prev => prev.map(s => s.id === 'camera' ? { ...s, status: 'completed', detail: 'CAMERA-FREE MODE' } : s));
            setWarmupProgress(100);
            setTimeout(() => {
              setIsPreWarmupVisible(false);
              setIsAppLoading(false);
            }, 600);
          }
          if (statusRef.current) {
            statusRef.current.textContent = "LOCAL CAMERA-FREE MODE";
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
    // Synchronize first detected frame with PreWarmupScreen
    if (results.faceLandmarks && !hasFirstLandmarkRef.current) {
      hasFirstLandmarkRef.current = true;
      setWarmupSteps(prev => prev.map(s => ({ ...s, status: 'completed', detail: '60 FPS STABLE' })));
      setWarmupProgress(100);
      setTimeout(() => {
        setIsPreWarmupVisible(false);
        setIsAppLoading(false);
      }, 400);
    }

    // 60 FPS Optimization: Only render onto canvas when visible
    const canvas = canvasRef.current;
    if (canvas && !canvas.classList.contains('hidden') && canvas.offsetParent !== null) {
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx && videoRef.current) {
        const width = canvas.width;
        const height = canvas.height;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);

        // Flip horizontally to mirror
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
        statusRef.current.textContent = "SYSTEM PAUSED (PRESS 'Q')";
        statusRef.current.className = `px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 bg-blue-500/10 text-blue-400 border-blue-500/30 uppercase shadow-2xl backdrop-blur-md`;
      }
      return;
    }

    // ===========================================
    // P.D.E.F. v1.0 BIOMETRIC CORE
    // ===========================================
    let statusMsg = "IN FLOW STATE (ACTIVE FIXATION)";
    let statusColor = "text-green-500";
    let statusBg = "bg-green-500/10";
    let statusBorder = "border-green-500/30";

    const faces = results.faceLandmarks;
    if (faces) {
      const now = Date.now();
      const metrics = metricsRef.current;

      // Calibration Phase (15 seconds)
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

      // --- MESH EXTRACTION (PDEF) ---
      const pI = faces[468] || faces[159]; // Left Pupil/Eye
      const pD = faces[473] || faces[386]; // Right Pupil/Eye
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
      metrics.gaze_history = metrics.gaze_history.filter(p => now - p.t < 10000); // 10s window

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

      // --- KINEMATIC EXTRACTION (Postural Strain / Tension) ---
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

        // 1. Elbow angle (extended arm)
        const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);

        // 2. Shoulder-to-torso angle
        leftShoulderTorsoAngle = getAngle(leftElbow, leftShoulder, leftHip);
        rightShoulderTorsoAngle = getAngle(rightElbow, rightShoulder, rightHip);
        const isLeftArmRaisedUp = leftShoulderTorsoAngle > 135;
        const isRightArmRaisedUp = rightShoulderTorsoAngle > 135;

        // 3. Arm-to-opposite-shoulder angle
        leftArmShoulderAngle = getAngle(leftElbow, leftShoulder, rightShoulder);
        rightArmShoulderAngle = getAngle(rightElbow, rightShoulder, leftShoulder);
        const isLeftArmHorizontal = Math.abs(leftArmShoulderAngle - 180) < 35;
        const isRightArmHorizontal = Math.abs(rightArmShoulderAngle - 180) < 35;

        // 4. Hands (wrists) above torso/shoulders
        const isLeftHandAboveTorso = leftWrist.y < leftShoulder.y - 0.05;
        const isRightHandAboveTorso = rightWrist.y < rightShoulder.y - 0.05;

        // Combined strain/tension condition
        if (isLeftArmRaisedUp || isRightArmRaisedUp) {
          distressPosture = true;
          postureDetail = `Arms raised (L: ${leftShoulderTorsoAngle.toFixed(0)}°, R: ${rightShoulderTorsoAngle.toFixed(0)}°)`;
        } else if (isLeftArmHorizontal || isRightArmHorizontal) {
          distressPosture = true;
          postureDetail = `Arms straight (L: ${leftArmShoulderAngle.toFixed(0)}°, R: ${rightArmShoulderAngle.toFixed(0)}°)`;
        } else if (isLeftHandAboveTorso || isRightHandAboveTorso) {
          distressPosture = true;
          postureDetail = "Hands raised";
        }
      }

      // Compute real-time frame delta
      const delta = Math.min(1000, metrics.last_frame_time > 0 ? (now - metrics.last_frame_time) : 33);
      metrics.last_frame_time = now;

      // 1. Nasal displacement calculation (physical restlessness)
      let noseDelta = 0;
      if (lastNoseRef.current) {
        noseDelta = Math.hypot(nose.x - lastNoseRef.current.x, nose.y - lastNoseRef.current.y);
      }
      lastNoseRef.current = { x: nose.x, y: nose.y };

      // 2. Shoulder / Posture angle
      let shoulderAngle = 105;
      if (pose && pose[11] && pose[12] && pose[13]) {
        const rad = Math.atan2(pose[13].y - pose[11].y, pose[13].x - pose[11].x) - Math.atan2(pose[12].y - pose[11].y, pose[12].x - pose[11].x);
        shoulderAngle = Math.abs((rad * 180) / Math.PI);
      }

      // MAR (Mouth Aspect Ratio - Yawn / drowsy fatigue detection)
      const mouthTop = faces[13];
      const mouthBottom = faces[14];
      const mouthLeft = faces[61] || faces[78];
      const mouthRight = faces[291] || faces[308];
      const mouthHeight = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);
      const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
      const MAR = mouthWidth > 0 ? mouthHeight / mouthWidth : 0.05;

      // Lateral head tilt (Roll angle in degrees)
      const rollRad = Math.atan2(faces[263].y - faces[33].y, faces[263].x - faces[33].x);
      const rollAngle = rollRad * (180 / Math.PI);

      // 3. Rolling 2-second buffer for TensorFlow.js Neural Network (12 Dimensions)
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

      // Temporal normalization of nasal displacement (independent of browser FPS)
      const wDurationSec = Math.max(0.5, (wFrames[wFrames.length - 1].t - wFrames[0].t) / 1000);
      const rawNoseSum = wFrames.reduce((a, b) => a + b.noseDelta, 0);
      const noseDeltaSum = (rawNoseSum / wDurationSec) * 2.0;

      const gazeVarMean = gazes.reduce((a, b) => a + b, 0) / wCount;
      const shoulderMean = shoulders.reduce((a, b) => a + b, 0) / wCount;
      const marMean = mars.reduce((a, b) => a + b, 0) / wCount;
      const rollMean = rolls.reduce((a, b) => a + b, 0) / wCount;

      // 4. TRAINED TENSORFLOW.JS NEURAL NETWORK INFERENCE (<2ms)
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

      // 1200ms temporal hysteresis for clinical on-screen class stabilization
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
        'NORMAL STUDY / NEUTRAL',
        'DEEP FOCUS (FLOW)',
        'DISTRACTION',
        'FATIGUE',
        'OVERSTIMULATION',
        'POSTURAL STRAIN'
      ];

      const stabilizedResult: AIPredictionResult = {
        ...aiResult,
        classIndex: displayedClassRef.current,
        className: CLASS_NAMES[displayedClassRef.current] || aiResult.className
      };

      // Smart state update: Only update React state when cognitive class changes or confidence shifts >= 4%
      if (now - lastAiUpdateRef.current >= 250) {
        lastAiUpdateRef.current = now;

        // Log anonymous metrics in active session for cognitive debrief (bounded 300-sample circular buffer)
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

      // Direct C.L.A.P. & Cognitive Load control with organic exponential smoothing
      const targetFocus = aiResult.focusScore;
      const targetLoad = aiResult.stressLevel;

      metrics.nivel_clap = Math.max(5, Math.min(100, metrics.nivel_clap * 0.94 + targetFocus * 0.06));
      metrics.nivel_carga = Math.max(0, Math.min(100, metrics.nivel_carga * 0.94 + targetLoad * 0.06));

      // Live Bio-Cognitive Telemetry routing to FocusBud (60 FPS, Zero Latency)
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




      // Autonomous task subdivision ONLY when focus session is actively running
      if (
        isStartedRef.current &&
        !isPausedRef.current &&
        (metrics.nivel_clap < 40 || displayedClassRef.current === 3 || aiResult.perclos >= 25) &&
        !metrics.is_subdividing &&
        !metrics.subdivided_indexes.includes(currentStepIdxRef.current)
      ) {
        subdivideCurrentStepRef.current(currentStepIdxRef.current);
      }

      // Deterministic Local Postural Hygiene (100% Edge Privacy, zero image/video uploads)
      const pFatiga = aiResult.probabilities[3] || 0;
      const pAgobio = aiResult.probabilities[5] || 0;
      const isEs = languageRef.current === 'es';

      if (now - lastPostureUpdateRef.current >= 600) {
        lastPostureUpdateRef.current = now;
        let pStatus: 'OPTIMAL' | 'NECK_TILT' | 'SHOULDER_TENSION' = 'OPTIMAL';
        let pLabel = isEs ? 'Postura Óptima' : 'Optimal Posture';
        let pColor = 'text-emerald-400';
        let pBg = 'bg-emerald-950/40 border-emerald-800/40';

        if (pitchMean > 0.62) {
          pStatus = 'NECK_TILT';
          pLabel = isEs ? 'Alineación de Cuello' : 'Neck Alignment';
          pColor = 'text-amber-400';
          pBg = 'bg-amber-950/40 border-amber-800/40';
        } else if (pAgobio > 0.55 || Math.abs(rollMean) > 22) {
          pStatus = 'SHOULDER_TENSION';
          pLabel = isEs ? 'Tensión Postural' : 'Postural Tension';
          pColor = 'text-rose-400';
          pBg = 'bg-rose-950/40 border-rose-800/40';
        }

        setPostureHygiene(prev => {
          if (prev.status === pStatus && prev.label === pLabel) return prev;
          return { status: pStatus, label: pLabel, color: pColor, bg: pBg };
        });
      }

      // Proactive Streaming Intervention to FocusBud ONLY when a Focus Session is actively running!
      if (
        isStartedRef.current &&
        !isPausedRef.current &&
        (pAgobio > 0.65 || pFatiga > 0.65 || metrics.nivel_carga > 75) &&
        (now - metrics.last_auto_chat > 45000)
      ) {
        metrics.last_auto_chat = now;
        fatigueEventsCountRef.current += 1;

        isBudStreamingRef.current = true;
        let streamAccumulator = "";

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
            currentTask: steps[currentStepIdxRef.current] || task || 'Work in progress',
            sessionMinutes: Math.round(elapsedTimeRef.current / 60),
            cognitiveClass: stabilizedResult.className
          },
          (chunk: string) => {
            streamAccumulator += chunk;
          },
          () => {
            let fullText = streamAccumulator.trim();
            fullText = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#"`]/g, '').trim();
            if (/Starts with an? uppercase|Need to consider:|Count:\s*\d|User prompt:/i.test(fullText)) {
              fullText = "";
            }

            let voiceSummary = "";
            let speechRate = 0.95;
            const activeEs = languageRef.current === 'es';

            if (severity >= 70 || pFatiga > 0.65) {
              voiceSummary = activeEs
                ? "Detecto sobrecarga en tu ritmo. Cierra los ojos y respira profundo cinco segundos."
                : "Detecting overload in your pace. Close your eyes and take a deep five-second breath.";
              speechRate = 0.88;
            } else if (pAgobio > 0.65) {
              voiceSummary = activeEs
                ? "Cero presión. Respira profundo y da un solo paso a la vez."
                : "Zero pressure. Take a deep breath and make just one click at a time.";
              speechRate = 0.90;
            } else if (metrics.nivel_carga > 45) {
              voiceSummary = activeEs
                ? "Cuida tu postura: eleva la barbilla y relaja los hombros."
                : "Check your posture: lift your chin and relax your shoulders.";
              speechRate = 1.0;
            } else {
              voiceSummary = fullText || (activeEs ? "Mantenemos un ritmo constante. Un paso a la vez." : "Keeping a steady pace. One step at a time.");
              speechRate = 0.95;
            }

            const wordsCount = fullText.split(/\s+/).filter(Boolean).length;
            if (fullText && wordsCount <= 12 && !/Starts with an? uppercase|Need to consider:/i.test(fullText)) {
              voiceSummary = fullText;
            }

            // 1. Show micro-summary in FocusBud speech bubble
            setBudMessage(voiceSummary);

            // 2. Post full advice in Support Chat
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: `🤖 [FocusBud]: ${fullText || voiceSummary}`
            }]);

            // 3. Synthesize live voice ONLY if Focus Session is still active
            if (isStartedRef.current && !isPausedRef.current) {
              audioService.speak(voiceSummary, {
                rate: speechRate,
                pitch: 1.08,
                lang: activeEs ? 'es' : 'en',
                onStart: () => setIsBudSpeaking(true),
                onEnd: () => {
                  setIsBudSpeaking(false);
                  setTimeout(() => {
                    setBudMessage("");
                  }, 2500);
                }
              });
            }

            setTimeout(() => {
              isBudStreamingRef.current = false;
            }, 6000);
          }
        );
      }

      statusMsg = `🧠 AI: ${stabilizedResult.className} (${(stabilizedResult.confidence * 100).toFixed(0)}%) • ${stabilizedResult.statusMessage}`;
      statusColor = stabilizedResult.badgeColor;
      statusBg = stabilizedResult.badgeBg;
      statusBorder = stabilizedResult.badgeBorder;
    } else {
      statusMsg = "FACE OUT OF FRAME";
      statusColor = "text-zinc-600";
      statusBg = "bg-zinc-800/10";
      statusBorder = "border-zinc-800/30";
    }

    // Direct DOM bar updates for 60 FPS performance
    if (focusRef.current) {
      focusRef.current.style.width = `${Math.round(metricsRef.current.nivel_clap)}%`;
    }
    if (fatigueRef.current) {
      fatigueRef.current.style.width = `${Math.round(metricsRef.current.nivel_carga)}%`;
    }
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
      const isEs = languageRef.current === 'es';
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: isEs
          ? '🔄 Reiniciando sensores biométricos. Mantén una postura cómoda y expresión neutral durante 15 segundos para recalibrar.'
          : '🔄 Restarting biometric sensors. Please maintain a comfortable posture and neutral expression for 15 seconds to recalibrate.'
      }]);
      speakFocusBud(
        isEs
          ? "Recalibrando sensores. Mantén una postura cómoda y expresión neutral durante quince segundos."
          : "Recalibrating sensors. Keep a neutral expression and comfortable posture for fifteen seconds.",
        { force: true, rate: 0.98 }
      );
    }

  };

  const handleAcceptProposal = () => {
    if (!proposedChange) return;

    const newSteps = proposedChange.proposedSteps.map((s: string) => s.replace(/(Step \d+\.\d+:|Step \d+:|Paso \d+\.\d+:|Paso \d+:)/i, '').trim());
    setTask(proposedChange.proposedTask);
    setSteps(newSteps);
    setCurrentStepIdx(0);
    elapsedTimeRef.current = 0;
    setElapsedTime(0);

    metricsRef.current.subdivided_indexes = [];
    setProposedChange(null);

    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: language === 'es'
        ? `🚀 ¡Misión actualizada con éxito! Tu nueva meta es: "${proposedChange.proposedTask}".`
        : `🚀 Mission updated successfully! Your new goal is: "${proposedChange.proposedTask}".`
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

      // Trigger Kawaii Anime Reward Celebration (Varied rotation across 10 archetypes)
      const nextArchetype = nextIdx >= steps.length 
        ? 5 // APEX VICTORY (TOTAL MASTERY! 👑 ＼(＾▽＾)／ 👑) on final step
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

      // Defer localStorage persistence by 250ms so frame 0 of the animation is instant (pure 60 FPS)
      if (currentSessionIdRef.current) {
        const sessionId = currentSessionIdRef.current;
        const currentTaskTitle = task || 'Work Session';
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
        // FocusBud vocalization upon completing the step connected live to Google Gemini /api/step-celebration
        const nextStepText = steps[nextIdx] || '';
        const isNextSomatic = /^(SOMATIC\s+(PAUSE|BREAK)|PAUSA(\s+SOMÁTICA)?)/i.test(nextStepText);
        if (isNextSomatic) {
          speakFocusBud(
            languageRef.current === 'es'
              ? "Paso completado. Entramos en pausa somática. Inhala profundo y relaja los hombros."
              : "Step completed. Entering a somatic pause now. Inhale deeply and relax your shoulders.",
            { force: true }
          );
        } else {
          celebrateStepUniversal(completedStepText, nextStepText, task)
            .then(aiPhrase => {
              speakFocusBud(aiPhrase, { force: true, rate: 1.03 });
            })
            .catch(() => {
              speakFocusBud(
                languageRef.current === 'es'
                  ? "¡Paso dominado! Mantén tu enfoque firme en el siguiente."
                  : "Step mastered! Keep your focus steady on the next one.",
                { force: true, rate: 1.02 }
              );
            });
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
          {/* Ambient Audio Toggle (Brown Noise) */}
          <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
            <button
              onClick={toggleBrownNoise}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                isBrownNoiseActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-700/50'
              }`}
              title={isBrownNoiseActive ? (language === 'es' ? 'Desactivar Ruido Marrón' : 'Disable Brown Noise') : (language === 'es' ? 'Activar Ruido Marrón' : 'Enable Brown Noise')}
            >
              <Headphones className={`w-3.5 h-3.5 ${isBrownNoiseActive ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline font-semibold">{language === 'es' ? 'Ruido Marrón:' : 'Brown Noise:'}</span>
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
                  title={`Volume: ${Math.round(noiseVolume * 100)}%`}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title={keyTestResult?.message || (language === 'es' ? 'Ver estado de API Key de Google Gemini' : 'View Google Gemini API Key status')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border transition-all cursor-pointer ${
              apiStatus === 'browser' || apiStatus === 'server'
                ? 'border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:border-emerald-500/60'
                : 'border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:border-amber-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              apiStatus === 'browser' || apiStatus === 'server'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
            }`} />
            <span className={`font-mono text-[9px] tracking-wider uppercase font-semibold ${
              apiStatus === 'browser' || apiStatus === 'server' ? 'text-emerald-400' : 'text-amber-300'
            }`}>
              {apiStatus === 'browser' || apiStatus === 'server'
                ? (language === 'es' ? 'Google Gemini Activo' : 'Google Gemini Active')
                : (language === 'es' ? 'Motor Local Activo • Cambiar Key' : 'Local Engine Active • Update Key')}
            </span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-emerald-400 text-zinc-300 rounded-xl border border-zinc-800 transition-all cursor-pointer text-xs font-medium"
            title={t.common.settings}
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">{t.common.settings}</span>
          </button>
        </div>

        {/* COMPREHENSIVE BILINGUAL SETTINGS MODAL */}
        <NeuroSynkSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          geminiApiKey={geminiApiKey}
          setGeminiApiKey={setGeminiApiKey}
          apiStatus={apiStatus}
          setApiStatus={setApiStatus}
          workMode={workMode}
          setWorkMode={setWorkMode}
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          onRecalibrate={() => handleRecalibrate(false)}
        />
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
                  {language === 'es' ? 'Personalicemos tu sesión' : "Let's personalize your session"}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  {language === 'es' ? 'Meta:' : 'Goal:'} <span className="text-emerald-400 font-medium font-mono">"{task}"</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSurvey(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer"
              title={language === 'es' ? 'Editar meta' : 'Edit goal'}
            >
              {language === 'es' ? '← Editar meta' : '← Edit goal'}
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
                    {(Array.isArray(q.options) ? q.options : ["Option A", "Option B", "Option C"]).map((opt, oIdx) => {
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
                  <span>{language === 'es' ? 'Generando ruta de trabajo a medida...' : 'Generating tailored roadmap...'}</span>
                </>
              ) : (
                <>
                  {language === 'es' ? 'GENERAR RUTA DE TRABAJO 🚀' : 'GENERATE WORK ROADMAP 🚀'}
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGenerateFromSurvey(false)}
              className="w-full py-2.5 text-xs sm:text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors text-center cursor-pointer disabled:opacity-50"
            >
              {language === 'es' ? 'Omitir y comenzar de inmediato' : 'Skip and start right away'}
            </button>
          </div>
        </motion.div>
      </div>
  );

  const handleLaunchFromStudio = async (
    finalTask: string,
    customSteps?: string[],
    contextSummary?: string
  ) => {
    const resolvedTask = finalTask.trim() ? finalTask.trim() : (task.trim() || 'Study general material');
    setTask(resolvedTask);

    if (customSteps && customSteps.length > 0) {
      setSteps(customSteps);
      const wDur = 25 * 60;
      const bDur = 5 * 60;
      setWorkDuration(wDur);
      setBreakDuration(bDur);
      setTotalTargetBlocks(2);
      setCompletedBlocks(0);
      setTimerMode('WORK');
      setTimerSecondsLeft(wDur);
      setIsTimerRunning(true);
      setCurrentStepIdx(0);
      setIsLoading(false);
      setShowSurvey(false);
      setIsStarted(true);
      setAppStage('FOCUS');

      const sId = `session-${Date.now()}`;
      currentSessionIdRef.current = sId;
      saveSessionItem({
        id: sId,
        task: resolvedTask,
        timestamp: Date.now(),
        durationMinutes: 0,
        completedSteps: 0,
        totalSteps: customSteps.length,
        avgFocus: 100,
        status: 'EN_PROGRESO'
      });
      return;
    }

    setIsLoading(true);
    let resolvedSteps: string[] = [];
    try {
      const data = await splitTaskUniversal(
        resolvedTask,
        surveyAnswers,
        `Work mode: ${workMode}, Sensitivity: ${sensitivity}${contextSummary ? ` | Context: ${contextSummary}` : ''}`,
        geminiApiKey
      );
      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        resolvedSteps = data.steps
          .map((s: any) =>
            String(typeof s === 'string' ? s : s?.step || s?.text || s?.description || s?.action || s || '')
              .replace(/(Step \d+\.\d+:|Step \d+:|Paso \d+\.\d+:|Paso \d+:)/i, '')
              .trim()
          )
          .filter(Boolean);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error generating work roadmap from Studio:', err);
      resolvedSteps = language === 'es'
        ? [
            `DEFINE el objetivo concreto y alcance de '${resolvedTask}'.`,
            `ORGANIZA los materiales o herramientas esenciales para comenzar.`,
            `DESARROLLA el primer bloque central con atención plena.`,
            `PAUSA SOMÁTICA: Aparta la vista de la pantalla, bebe agua y estira los brazos durante 3 minutos.`,
            `VERIFICA y consolida el avance logrado en la sesión.`
          ]
        : [
            `DEFINE the core objective and scope of '${resolvedTask}'.`,
            `ORGANIZE the essential materials or sources to get started.`,
            `DEVELOP the first central block with full focus.`,
            `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 3 minutes.`,
            `REVIEW and consolidate the progress achieved.`
          ];
    } finally {
      setSteps(resolvedSteps);
      const wDur = 25 * 60;
      const bDur = 5 * 60;
      setWorkDuration(wDur);
      setBreakDuration(bDur);
      setTotalTargetBlocks(2);
      setCompletedBlocks(0);
      setTimerMode('WORK');
      setTimerSecondsLeft(wDur);
      setIsTimerRunning(true);
      setCurrentStepIdx(0);
      setIsLoading(false);
      setShowSurvey(false);
      setIsStarted(true);
      setAppStage('FOCUS');

      const sId = `session-${Date.now()}`;
      currentSessionIdRef.current = sId;
      saveSessionItem({
        id: sId,
        task: resolvedTask,
        timestamp: Date.now(),
        durationMinutes: 0,
        completedSteps: 0,
        totalSteps: resolvedSteps.length,
        avgFocus: 100,
        status: 'EN_PROGRESO'
      });
    }
  };

  const renderLoginStage = () => (
    <GeminiHeroInput
      task={task}
      setTask={setTask}
      onSubmit={handleStart}
      onLaunchFocusSession={handleLaunchFromStudio}
      geminiApiKey={geminiApiKey}
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
            <BrainCircuit className="text-green-500" /> Refining Details
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
            placeholder="Type your answer..."
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
              <Play className="w-4 h-4 fill-black inline mr-1" /> Generate Steps & Start Session
            </>
          )}
        </button>
      </motion.div>
    </div>
  );

  const translateAIClassName = (rawClass?: string) => {
    if (!rawClass) return isAIBrainReady ? (language === 'es' ? 'ENFOQUE' : 'FOCUS') : (language === 'es' ? 'CALIBRANDO' : 'CALIBRATING');
    if (language !== 'es') return rawClass;
    const upper = rawClass.toUpperCase();
    if (upper.includes('NORMAL') || upper.includes('NEUTRAL')) return 'ESTUDIO NORMAL / NEUTRO';
    if (upper.includes('FLOW') || upper.includes('DEEP')) return 'ENFOQUE PROFUNDO (FLOW)';
    if (upper.includes('DISTRAC')) return 'DISTRACCIÓN COGNITIVA';
    if (upper.includes('FATIG')) return 'FATIGA VISUAL';
    if (upper.includes('OVERSTIM')) return 'SOBREESTIMULACIÓN';
    if (upper.includes('STRAIN') || upper.includes('POSTUR')) return 'TENSIÓN POSTURAL';
    return rawClass;
  };

  const renderFocusStage = () => (
    <div className="lg:h-screen lg:overflow-hidden bg-zinc-950 text-zinc-300 font-sans pt-16 sm:pt-20 pb-4 px-4 xl:px-8 flex flex-col lg:flex-row gap-5 items-stretch">

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
                <Target className="w-4 h-4 text-emerald-500" /> {language === 'es' ? 'RENDIMIENTO (C.L.A.P.)' : 'PERFORMANCE (C.L.A.P.)'}
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
                <Activity className="w-4 h-4 text-rose-500" /> {language === 'es' ? 'CARGA COGNITIVA' : 'COGNITIVE LOAD'}
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
                <BrainCircuit className="w-4 h-4 text-cyan-400" /> {language === 'es' ? 'RED NEURONAL IA' : 'AI NEURAL NETWORK'}
              </span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase tracking-wider">
                TF.js 4.22
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-white tracking-wide">
                {translateAIClassName(aiPrediction?.className)}
              </span>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                {aiPrediction ? `${(aiPrediction.confidence * 100).toFixed(0)}% Conf.` : (isAIBrainReady ? '100%' : 'Ready')}
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


            {/* Visual Protagonist: FocusBud Robot with Styled Empathetic Speech Bubble */}
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

            {/* Bottom Bar: Inference Status, Posture & Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 z-20 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md font-mono text-[10px] text-zinc-400 flex items-center gap-2 shadow-2xl border border-zinc-800">
                  <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`} /> {isPaused ? (language === 'es' ? 'PAUSADO' : 'PAUSED') : (language === 'es' ? 'INFERENCIA LOCAL (TF.js)' : 'LOCAL INFERENCE (TF.js)')}
                </span>

                {/* Edge Postural Hygiene Chip (100% Deterministic / Local) */}
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
                  title={language === 'es' ? 'Simular pausa para ejercicios de regulación' : 'Simulate break to test grounding exercises'}
                >
                  <span>☕ </span> {timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK' ? (language === 'es' ? 'VOLVER AL ENFOQUE' : 'BACK TO FOCUS') : (language === 'es' ? 'PAUSA SOMÁTICA' : 'TEST GROUNDING')}
                </button>

                <button
                  onClick={() => handleRecalibrate(false)}
                  className="px-2.5 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
                  title={language === 'es' ? 'Reiniciar calibración biométrica' : 'Restart biometric calibration'}
                >
                  <span>🔄</span> {language === 'es' ? 'RECALIBRAR IA' : 'RECALIBRATE AI'}
                </button>
              </div>
            </div>

            {isPaused && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center pointer-events-none">
                <span className="text-3xl font-black tracking-[0.3em] text-blue-400 font-mono drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">{language === 'es' ? 'PAUSADO' : 'PAUSED'}</span>
              </div>
            )}
          </div>

          {/* Quick Info Chat */}
          <div className="rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800 flex-[2.5] flex flex-col overflow-hidden min-h-[350px]">
            {/* Header */}
            <div className="px-5 py-4 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2 shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <span className="font-mono text-sm tracking-widest text-zinc-300 font-semibold uppercase">{language === 'es' ? 'Chat de Apoyo' : 'Support Chat'}</span>
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
                    <span className="font-mono text-[10px] tracking-widest text-emerald-500 uppercase font-bold">{language === 'es' ? '💡 Nueva Propuesta de Misión' : '💡 New Mission Proposal'}</span>
                    <h4 className="text-white font-semibold text-sm leading-snug">{proposedChange.proposedTask}</h4>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-zinc-800 pt-3">
                    <span className="font-mono text-[9px] tracking-wider text-zinc-500 uppercase">{language === 'es' ? 'Micro-Pasos de Acción:' : 'Action Micro-Steps:'}</span>
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
                      {language === 'es' ? 'Aceptar Nueva Tarea' : 'Accept New Task'}
                    </button>
                    <button
                      onClick={() => setProposedChange(null)}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      {language === 'es' ? 'Descartar' : 'Dismiss'}
                    </button>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
            {/* Quick In-Chat Studio Functions inside Focus Mode */}
            <div className="px-4 py-2 bg-zinc-950/60 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isChatLoading}
                onClick={() => subdivideCurrentStepRef.current(currentStepIdx)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono cursor-pointer transition-colors"
              >
                {language === 'es' ? '✂️ Subdividir paso actual' : '✂️ Subdivide active step'}
              </button>
              <button
                type="button"
                disabled={isChatLoading}
                onClick={() => {
                  const activeStep = steps[currentStepIdx] || task;
                  const tracyMsg = language === 'es'
                    ? `💡 Ideas rápidas (Brian Tracy) para "${activeStep}":\n1. Regla de 2 min: escribe solo la primera línea o fórmula.\n2. Pareto 80/20: resuelve primero el caso central.\n3. Feynman: explícalo en voz alta en 60 segundos.`
                    : `💡 Quick Brian Tracy ideas for "${activeStep}":\n1. 2-Min Rule: write just the first line or formula.\n2. Pareto 80/20: solve the core case first.\n3. Feynman: explain it out loud in 60 seconds.`;
                  setChatMessages(prev => [...prev, { role: 'assistant', content: tracyMsg }]);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-mono cursor-pointer transition-colors"
              >
                {language === 'es' ? '💡 Ideas Brian Tracy' : '💡 Brian Tracy Ideas'}
              </button>
            </div>
            {/* Input form */}
            <form onSubmit={handleSendChat} className="p-4 bg-zinc-950/30 border-t border-zinc-800 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={language === 'es' ? 'Pregunta sin perder tu enfoque...' : 'Ask without losing focus...'}
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

      {/* RIGHT PANEL: AI MENTOR DASHBOARD - Staged GPU Entrance */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="w-full lg:w-[450px] shrink-0 flex flex-col gap-6 lg:h-full min-h-0"
      >

        <div className="bg-zinc-900 rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl border border-zinc-900 min-h-[500px] relative">
          {/* Multivariate Kawaii Anime Celebration with 60 FPS Particles */}
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
                  {language === 'es' ? 'Mentor IA Autónomo' : 'Autonomous AI Mentor'}
                </h2>
                <p className="text-xs font-mono text-zinc-400 truncate max-w-[220px]" title={task}>
                  {language === 'es' ? 'META:' : 'GOAL:'} <span className="text-emerald-400 font-semibold">{task || (language === 'es' ? 'Sesión de Enfoque' : 'Focus Session')}</span>
                </p>
              </div>
            </div>
            {/* Timer & Pause Controls */}
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-lg border transition-colors cursor-pointer ${isPaused ? 'bg-blue-500 border-blue-400 text-black' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                  }`}
                title={language === 'es' ? 'Pausar / Reanudar (Tecla Q)' : 'Pause / Resume (Press Q)'}
              >
                {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>

              {/* Pomodoro HUD with Status Indicator */}
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
                        {language === 'es' ? `🟢 ENFOQUE | BLOQUE ${Math.min(completedBlocks + 1, totalTargetBlocks)}/${totalTargetBlocks}` : `🟢 FOCUS | BLOCK ${Math.min(completedBlocks + 1, totalTargetBlocks)}/${totalTargetBlocks}`}
                      </>
                    ) : (
                      <>
                        {language === 'es' ? '☕ DESCANSO' : '☕ BREAK'}
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

                {/* Block configuration button */}
                <button
                  onClick={() => setIsTimerConfigOpen(!isTimerConfigOpen)}
                  className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                  title="Adjust focus / break minutes"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Pomodoro Quick Adjustment Popover */}
              <AnimatePresence>
                {isTimerConfigOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute right-0 top-14 z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-3 shadow-2xl w-64 text-xs space-y-2 select-none"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                      <span>{language === 'es' ? 'Calibrar Pomodoro' : 'Calibrate Pomodoro'}</span>
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
                          <div className="text-[10px] text-zinc-500">{language === 'es' ? 'Pomodoro Clásico' : 'Classic Pomodoro'}</div>
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
                          <div className="text-[10px] text-zinc-500">{language === 'es' ? 'Trabajo Profundo Moderado' : 'Moderate Deep Work'}</div>
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
                          <div className="text-[10px] text-zinc-500">{language === 'es' ? 'Sprint Extendido' : 'Extended Sprint'}</div>
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
                {/* a) Progress Badge & Slim Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span className="font-semibold tracking-wider text-zinc-300">
                      {language === 'es' ? `PASO ${currentStepIdx + 1} DE ${steps.length}` : `STEP ${currentStepIdx + 1} OF ${steps.length}`}
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

                {/* b) Single Action Card */}
                <div className="my-auto py-3 flex items-center justify-center flex-1 w-full min-h-[145px]">
                  <motion.div
                    key={`step-card-${currentStepIdx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={`w-full p-5 sm:p-6 rounded-3xl flex flex-col items-center justify-center text-center relative group transition-colors duration-200 ${
                      /^(SOMATIC\s+(PAUSE|BREAK)|PAUSA(\s+SOMÁTICA)?)/i.test(steps[currentStepIdx] || '')
                        ? 'bg-gradient-to-b from-amber-950/30 via-zinc-950/90 to-zinc-950 border border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
                        : 'bg-zinc-950 border border-zinc-800/80 shadow-2xl hover:border-emerald-500/30'
                    }`}
                  >
                    {/^(SOMATIC\s+(PAUSE|BREAK)|PAUSA(\s+SOMÁTICA)?)/i.test(steps[currentStepIdx] || '') ? (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-semibold uppercase tracking-wider mb-5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        {language === 'es' ? 'Pausa Somática / Bio-Regulación' : 'Somatic Pause / Bio-Regulation'}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium uppercase tracking-wider mb-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {language === 'es' ? 'Paso Activo' : 'Active Step'}
                      </div>
                    )}

                    <p className={`text-xl sm:text-2xl font-semibold leading-relaxed tracking-tight max-w-md break-words select-text ${
                      /^(SOMATIC\s+(PAUSE|BREAK)|PAUSA(\s+SOMÁTICA)?)/i.test(steps[currentStepIdx] || '') ? 'text-amber-100 font-medium' : 'text-white'
                    }`}>
                      {steps[currentStepIdx] || (language === 'es' ? 'Cargando paso...' : 'Loading step...')}
                    </p>
                  </motion.div>
                </div>

                {/* c) Complete Step Button */}
                <div className="pt-2 relative">
                  {/* Dopamine & Gamification Reward Pill */}
                  <div className="flex items-center justify-center mb-2.5">
                    <div className={`px-4 py-1.5 rounded-full border text-[11px] font-mono font-bold tracking-wider uppercase flex items-center gap-2 transition-all duration-300 ${
                      isShowingReward
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 scale-105 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                        : 'bg-zinc-950/80 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    }`}>
                      <Zap className={`w-3.5 h-3.5 ${isShowingReward ? 'animate-bounce text-amber-400' : 'text-emerald-400'}`} />
                      <span>{language === 'es' ? 'ENERGÍA +100 CLAP • DOPAMINA' : 'ENERGY +100 CLAP • DOPAMINE'}</span>
                      <Sparkles className={`w-3.5 h-3.5 ${isShowingReward ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
                    </div>
                  </div>

                  <button
                    onClick={handleNextStep}
                    className={`w-full py-4 sm:py-5 font-black text-base sm:text-lg rounded-2xl transition-all flex items-center justify-center gap-2 relative group overflow-hidden active:scale-[0.99] cursor-pointer ${
                      isShowingReward
                        ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-zinc-950 shadow-[0_0_40px_rgba(52,211,153,0.5)] scale-[1.02]'
                        : /^(SOMATIC\s+(PAUSE|BREAK)|PAUSA(\s+SOMÁTICA)?)/i.test(steps[currentStepIdx] || '')
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                        : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_30px_rgba(34,197,94,0.25)]'
                    }`}
                  >
                    {isShowingReward
                      ? (language === 'es' ? '¡IMPULSO TOTAL! 🚀' : 'FULL MOMENTUM! 🚀')
                      : /^(SOMATIC\s+(PAUSE|BREAK)|PAUSA(\s+SOMÁTICA)?)/i.test(steps[currentStepIdx] || '')
                      ? (language === 'es' ? 'TERMINAR PAUSA Y CONTINUAR ▶️' : 'FINISH PAUSE & CONTINUE ▶️')
                      : (language === 'es' ? 'COMPLETAR PASO' : 'COMPLETE STEP')}
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  </button>

                  {currentStepIdx + 1 < steps.length ? (
                    <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] font-mono text-zinc-400">
                      <span className="text-zinc-500 font-semibold">{language === 'es' ? 'SIGUIENTE:' : 'NEXT:'}</span>
                      <span className="truncate max-w-[280px] text-zinc-300 font-medium">
                        {steps[currentStepIdx + 1]}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider font-mono text-center text-emerald-400/80 mt-2.5 font-semibold">
                      {language === 'es' ? 'PASO FINAL • META CASI ALCANZADA' : 'FINAL STEP • GOAL ALMOST REACHED'}
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
                    {language === 'es' ? '¡SESIÓN COMPLETADA!' : 'SESSION COMPLETED!'}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 font-medium truncate max-w-[320px]">
                    {task || (language === 'es' ? 'Sesión de Trabajo' : 'Work Session')}
                  </p>
                </div>

                {/* Session Summary Metrics */}
                <div className="grid grid-cols-2 gap-2 w-full my-0.5 shrink-0">
                  <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-zinc-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-emerald-400" /> {language === 'es' ? 'Tiempo:' : 'Time:'}</span>
                    <strong className="text-white">{formatTime(elapsedTime)}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-zinc-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5 text-cyan-400" /> {language === 'es' ? 'Enfoque:' : 'Avg Focus:'}</span>
                    <strong className="text-white">
                      {focusSamplesRef.current.length > 0 
                        ? `${Math.round(focusSamplesRef.current.reduce((a, b) => a + b, 0) / focusSamplesRef.current.length)}%` 
                        : `${Math.round(metricsRef.current.nivel_clap)}%`}
                    </strong>
                  </div>
                </div>

                {/* Cognitive Debrief Card with Google Gemini */}
                <div className="w-full text-left p-3.5 rounded-2xl bg-zinc-900/90 border border-purple-500/30 shadow-inner space-y-1.5 max-h-36 sm:max-h-44 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between sticky top-0 bg-zinc-900/95 py-0.5 z-10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[10px] font-mono tracking-wider uppercase text-purple-300 font-bold">
                        {language === 'es' ? 'Debrief Cognitivo • Google Gemini' : 'Cognitive Debrief • Google Gemini'}
                      </span>
                    </div>
                    {isDebriefLoading && (
                      <span className="text-[9px] font-mono text-zinc-400 animate-pulse">{language === 'es' ? 'Sintetizando...' : 'Synthesizing...'}</span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
                    {isDebriefLoading ? (
                      <span className="text-zinc-500 italic">{language === 'es' ? 'Generando análisis cognitivo con Google Gemini...' : 'Generating cognitive analysis with Google Gemini...'}</span>
                    ) : (
                      sessionDebrief || (language === 'es' ? 'Excelente disciplina. Mantuviste tu estabilidad cognitiva y cerraste tu ciclo de trabajo.' : 'Outstanding discipline. You maintained cognitive stability and closed your work cycle.')
                    )}
                  </p>
                </div>

                {/* New Session Button always visible and clickable */}
                <button
                  onClick={handleStartNewSession}
                  className="w-full mt-1 py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm sm:text-base rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-[0.99] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {language === 'es' ? 'INICIAR NUEVA SESIÓN' : 'START NEW SESSION'}
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
      {/* Permanent hardware sensors (100% On-Device Zero-Latency) */}
      <video ref={videoRef} className="hidden" playsInline autoPlay muted />
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      {/* Cinematic Hardware Pre-Warmup Screen */}
      <PreWarmupScreen
        isVisible={isPreWarmupVisible}
        steps={warmupSteps}
        progress={warmupProgress}
        onSkip={() => {
          setIsPreWarmupVisible(false);
          setIsAppLoading(false);
        }}
      />

      {/* Collapsible Sidebar Workspace */}
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
