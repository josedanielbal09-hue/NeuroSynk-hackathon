import React, { useEffect, useRef } from 'react';
import { FocusState } from '../../config/avatarConfig';
import { avatarBridge, BiometricAvatarFeed } from '../../services/avatarBridge';

export interface FocusBudLivingProps {
  state: FocusState;
  size?: number;
  gazeX?: number;
  gazeY?: number;
  headRoll?: number;
  isBlinkingManual?: boolean;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  isFlow?: boolean;
  isFatigue?: boolean;
  isDistress?: boolean;
  className?: string;
}

// Paleta de iluminación bioluminiscente según estado biocognitivo
const STATE_PALETTES: Record<
  FocusState,
  {
    coreGlow: string;
    rimColor: string;
    eyeColor: string;
    accentColor: string;
    breathingSpeed: number;
    floatingAmp: number;
  }
> = {
  ENFOQUE: {
    coreGlow: 'rgba(16, 185, 129, 0.40)',
    rimColor: '#10b981',
    eyeColor: '#34d399',
    accentColor: '#059669',
    breathingSpeed: 0.0018,
    floatingAmp: 3.5,
  },
  CELEBRACION: {
    coreGlow: 'rgba(52, 211, 153, 0.65)',
    rimColor: '#34d399',
    eyeColor: '#6ee7b7',
    accentColor: '#fbbf24',
    breathingSpeed: 0.0035,
    floatingAmp: 7.0,
  },
  ALERTA_SUAVE: {
    coreGlow: 'rgba(245, 158, 11, 0.42)',
    rimColor: '#f59e0b',
    eyeColor: '#fbbf24',
    accentColor: '#d97706',
    breathingSpeed: 0.0022,
    floatingAmp: 4.0,
  },
  FATIGA: {
    coreGlow: 'rgba(249, 115, 22, 0.32)',
    rimColor: '#f97316',
    eyeColor: '#fb923c',
    accentColor: '#ea580c',
    breathingSpeed: 0.0013,
    floatingAmp: 6.0,
  },
  PARALISIS: {
    coreGlow: 'rgba(168, 85, 247, 0.38)',
    rimColor: '#a855f7',
    eyeColor: '#c084fc',
    accentColor: '#9333ea',
    breathingSpeed: 0.0011,
    floatingAmp: 2.0,
  },
  PAUSA: {
    coreGlow: 'rgba(148, 163, 184, 0.25)',
    rimColor: '#94a3b8',
    eyeColor: '#cbd5e1',
    accentColor: '#64748b',
    breathingSpeed: 0.0015,
    floatingAmp: 3.0,
  },
};

/**
 * FocusBudLiving: Organismo biométrico vectorial de 0 KB de imágenes raster.
 * Optimizado para movimiento en TIEMPO REAL a 60 FPS mediante transforms DOM directos
 * y LERP adaptativo de alta velocidad (sin lag ni overhead de React setState en el loop).
 */
export const FocusBudLiving: React.FC<FocusBudLivingProps> = React.memo(({
  state,
  size = 280,
  gazeX,
  gazeY,
  headRoll,
  isBlinkingManual = false,
  isStreaming = false,
  isSpeaking = false,
  isFlow: isFlowProp,
  isFatigue: isFatigueProp,
  isDistress: isDistressProp,
  className = '',
}) => {
  const currentEyeVariantRef = useRef<string>('enfoque');
  const internalBlinkRef = useRef<boolean>(false);
  const isDeepRestingRef = useRef<boolean>(false);
  const animFrameRef = useRef<number>(0);

  // Referencias a nodos DOM directos para animación a 60 FPS sin React re-renders
  const svgRootRef = useRef<SVGSVGElement>(null);
  const bodyGroupRef = useRef<SVGGElement>(null);
  const visorGroupRef = useRef<SVGGElement>(null);
  const eyesGroupRef = useRef<SVGGElement>(null);
  const leftHandRef = useRef<SVGGElement>(null);
  const rightHandRef = useRef<SVGGElement>(null);
  const mouthWaveRef = useRef<SVGPathElement>(null);
  const flowRingRef = useRef<SVGCircleElement>(null);
  const ambientAuraRef = useRef<SVGCircleElement>(null);

  // Referencias directas a las variantes de ojos (control DOM directo = 0 re-renders de React)
  const eyeEnfoqueRef = useRef<SVGGElement>(null);
  const eyeCelebrationRef = useRef<SVGGElement>(null);
  const eyeBlinkRef = useRef<SVGGElement>(null);
  const eyeZenRef = useRef<SVGGElement>(null);
  const eyeAlertaRef = useRef<SVGGElement>(null);
  const eyeFatigaRef = useRef<SVGGElement>(null);
  const eyeParalisisRef = useRef<SVGGElement>(null);

  const palette = STATE_PALETTES[state] || STATE_PALETTES.ENFOQUE;

  // Mutable propsRef to avoid restarting requestAnimationFrame on prop changes
  const propsRef = useRef({
    state,
    size,
    gazeX,
    gazeY,
    headRoll,
    isBlinkingManual,
    isStreaming,
    isSpeaking,
    isFlow: isFlowProp,
    isFatigue: isFatigueProp,
    isDistress: isDistressProp,
    palette,
  });

  propsRef.current = {
    state,
    size,
    gazeX,
    gazeY,
    headRoll,
    isBlinkingManual,
    isStreaming,
    isSpeaking,
    isFlow: isFlowProp,
    isFatigue: isFatigueProp,
    isDistress: isDistressProp,
    palette,
  };

  // Telemetría en vivo recibida a 60 FPS por avatarBridge
  const telemetryRef = useRef<BiometricAvatarFeed>({
    gazeX: gazeX ?? 0,
    gazeY: gazeY ?? 0,
    headRoll: headRoll ?? 0,
    isBlinking: isBlinkingManual,
    isFlow: isFlowProp ?? false,
    isFatigue: isFatigueProp ?? false,
    isDistress: isDistressProp ?? false,
    ear: 0.25,
    focusScore: 100,
  });

  // Filtros de suavizado continuo LERP ultra-responsivo
  const smoothGazeX = useRef<number>(0);
  const smoothGazeY = useRef<number>(0);
  const smoothRoll = useRef<number>(0);
  const blinkDurationRef = useRef<number>(0);

  // Suscripción al bus de telemetría de MediaPipe / TF.js en tiempo real
  useEffect(() => {
    const unsubscribe = avatarBridge.subscribe((feed) => {
      telemetryRef.current = feed;
    });
    return () => unsubscribe();
  }, []);

  // Ciclo autónomo de parpadeo biológico de respaldo
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    let resetTimeout: NodeJS.Timeout;

    const scheduleNextBlink = () => {
      const delay = Math.random() * 2400 + 2800;
      blinkTimeout = setTimeout(() => {
        internalBlinkRef.current = true;
        resetTimeout = setTimeout(() => {
          internalBlinkRef.current = false;
          scheduleNextBlink();
        }, 120);
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(resetTimeout);
    };
  }, []);

  // Función ultra-rápida de alternancia de ojos por manipulación directa del DOM (0 CPU lag)
  const applyEyeVariantDOM = (variant: string) => {
    const variants = [
      { key: 'enfoque', ref: eyeEnfoqueRef },
      { key: 'celebration', ref: eyeCelebrationRef },
      { key: 'blink', ref: eyeBlinkRef },
      { key: 'zen', ref: eyeZenRef },
      { key: 'alerta', ref: eyeAlertaRef },
      { key: 'fatiga', ref: eyeFatigaRef },
      { key: 'paralisis', ref: eyeParalisisRef },
    ];
    for (let i = 0; i < variants.length; i++) {
      const el = variants[i].ref.current;
      if (el) {
        el.style.display = variants[i].key === variant ? 'inline' : 'none';
      }
    }
  };

  // Motor Físico Continuo a 60 FPS con manipulación de transforms DOM directos
  useEffect(() => {
    let startTime = performance.now();
    let lastFrameTime = startTime;

    const loop = (currentTime: number) => {
      const dt = Math.min(100, currentTime - lastFrameTime);
      lastFrameTime = currentTime;
      const elapsed = currentTime - startTime;

      const feed = telemetryRef.current;
      const p = propsRef.current;
      const curPalette = p.palette;

      // 1. LERP Ultra-Responsivo (Factor 0.36 para seguimiento instantáneo en tiempo real)
      const targetGazeX = p.gazeX !== undefined ? p.gazeX : feed.gazeX;
      const targetGazeY = p.gazeY !== undefined ? p.gazeY : feed.gazeY;
      const targetRoll = p.headRoll !== undefined ? p.headRoll : feed.headRoll;

      smoothGazeX.current += (targetGazeX - smoothGazeX.current) * 0.36;
      smoothGazeY.current += (targetGazeY - smoothGazeY.current) * 0.36;
      smoothRoll.current += (targetRoll - smoothRoll.current) * 0.28;

      const curGazeX = smoothGazeX.current;
      const curGazeY = smoothGazeY.current;
      const curRoll = smoothRoll.current;

      // 2. Parallax 2.5D pronunciado (mirada clara y viva)
      const eyeShiftX = curGazeX * 15.0;
      const eyeShiftY = curGazeY * 11.0;
      const visorShiftX = curGazeX * 7.5;
      const visorShiftY = curGazeY * 5.0;
      const sphereShiftX = curGazeX * 4.0;
      const sphereShiftY = curGazeY * 3.0;

      // 3. Parpadeo Simpático y Descanso Profundo
      if (feed.isBlinking || p.isBlinkingManual) {
        blinkDurationRef.current += dt;
        if (blinkDurationRef.current > 380) {
          isDeepRestingRef.current = true;
        }
      } else {
        blinkDurationRef.current = 0;
        isDeepRestingRef.current = false;
      }

      // Sincronización del estado de ojos con cambio condicional
      let computedVariant = 'enfoque';
      if (isDeepRestingRef.current || p.state === 'PAUSA') {
        computedVariant = 'zen';
      } else if (p.isBlinkingManual || internalBlinkRef.current || feed.isBlinking) {
        computedVariant = 'blink';
      } else if (p.state === 'CELEBRACION') {
        computedVariant = 'celebration';
      } else if (p.state === 'FATIGA') {
        computedVariant = 'fatiga';
      } else if (p.state === 'ALERTA_SUAVE') {
        computedVariant = 'alerta';
      } else if (p.state === 'PARALISIS') {
        computedVariant = 'paralisis';
      }

      if (computedVariant !== currentEyeVariantRef.current) {
        currentEyeVariantRef.current = computedVariant;
        applyEyeVariantDOM(computedVariant);
      }

      // 4. Modulación de Estados de Flow, Celebración y Somáticos
      const isCelebrating = p.state === 'CELEBRACION';
      const isFlowActive = (p.isFlow ?? feed.isFlow) || (p.state === 'ENFOQUE' && feed.focusScore >= 75);
      const isFatigueActive = (p.isFatigue ?? feed.isFatigue) || p.state === 'FATIGA';
      const isDistressActive = (p.isDistress ?? feed.isDistress);

      let speed = curPalette.breathingSpeed;
      let amp = curPalette.floatingAmp;
      let empatheticTilt = 0;

      if (isFlowActive) {
        speed = 0.0020;
        amp = 2.2;
      } else if (isFatigueActive || isDistressActive) {
        speed = 0.0014;
        amp = 7.0;
        empatheticTilt = isDistressActive ? 5.5 : 3.5;
      }

      // Respiración armónica vertical del cuerpo + Celebración Jump (Física Squash & Stretch Anime)
      let bodyFloatY = Math.sin(elapsed * speed) * amp;
      let bodyScaleX = 1;
      let bodyScaleY = 1;

      if (isCelebrating) {
        // Salto dinámico alegre con rebote de squash & stretch
        const hopCycle = (elapsed * 0.008) % (Math.PI * 2);
        const hopVal = Math.sin(hopCycle);
        if (hopVal > 0) {
          bodyFloatY = -hopVal * 26; // Salto vibrante de 26px
          bodyScaleX = 0.94;
          bodyScaleY = 1.10;
        } else {
          bodyFloatY = 0;
          bodyScaleX = 1.06;
          bodyScaleY = 0.95;
        }
      }

      const finalTilt = Math.sin(elapsed * (speed * 0.75)) * 1.8 + (curRoll * 0.55) + (curGazeX * 4.0) + empatheticTilt;

      // Manitas orbitando con perspectiva 3D (en celebración se mueven festivamente arriba)
      const handOffsetCeleb = isCelebrating ? -22 : (isFatigueActive ? 8 : 0);
      const leftHandY = isCelebrating
        ? -22 + Math.sin(elapsed * 0.016) * 9
        : Math.sin(elapsed * (speed * 1.15) + 0.6) * (amp * 1.1) + handOffsetCeleb;
      const rightHandY = isCelebrating
        ? -22 + Math.cos(elapsed * 0.016) * 9
        : Math.sin(elapsed * (speed * 1.15) + 2.2) * (amp * 1.1) + handOffsetCeleb;

      // Escala 3D de manos según la dirección a la que mira la cabeza
      const leftHandScale = Math.max(0.82, Math.min(1.18, 1 - curGazeX * 0.16));
      const rightHandScale = Math.max(0.82, Math.min(1.18, 1 + curGazeX * 0.16));
      const handShiftX = curGazeX * 6.0;

      // Pulsación por streaming/voz o modo flow
      const streamPulse = (p.isStreaming || p.isSpeaking) ? 1 + Math.sin(elapsed * 0.02) * 0.04 : 1;
      const speakingWave = p.isSpeaking ? Math.sin(elapsed * 0.03) * 4.0 : 0;
      const flowPulse = isFlowActive ? Math.sin(elapsed * 0.0022) * 0.5 + 0.5 : 0;
      const celebAuraScale = isCelebrating ? 1.25 + Math.sin(elapsed * 0.01) * 0.15 : 1 + flowPulse * 0.08;

      // --- APLICACIÓN DIRECTA A DOM REFS (CERO LAG, 60 FPS PUROS) ---
      if (svgRootRef.current) {
        svgRootRef.current.style.transform = `translate3d(0, ${bodyFloatY}px, 0) scale(${streamPulse})`;
      }

      if (bodyGroupRef.current) {
        bodyGroupRef.current.style.transform = `translate3d(${sphereShiftX}px, ${sphereShiftY}px, 0) scale(${bodyScaleX}, ${bodyScaleY}) rotate(${finalTilt}deg)`;
      }

      if (visorGroupRef.current) {
        visorGroupRef.current.style.transform = `translate3d(${visorShiftX}px, ${visorShiftY}px, 0)`;
      }

      if (eyesGroupRef.current) {
        eyesGroupRef.current.style.transform = `translate3d(${eyeShiftX}px, ${eyeShiftY}px, 0)`;
      }

      if (leftHandRef.current) {
        leftHandRef.current.style.transform = `translate3d(${handShiftX}px, ${leftHandY}px, 0) scale(${leftHandScale})`;
      }

      if (rightHandRef.current) {
        rightHandRef.current.style.transform = `translate3d(${handShiftX}px, ${rightHandY}px, 0) scale(${rightHandScale})`;
      }

      if (mouthWaveRef.current) {
        mouthWaveRef.current.setAttribute(
          'd',
          `M ${120 - 12 + eyeShiftX * 0.25} ${124 + 16 + eyeShiftY * 0.25} Q ${120 + eyeShiftX * 0.25} ${124 + 16 + speakingWave + eyeShiftY * 0.25} ${120 + 12 + eyeShiftX * 0.25} ${124 + 16 + eyeShiftY * 0.25}`
        );
      }

      if (flowRingRef.current) {
        flowRingRef.current.setAttribute('r', `${52 + 18 + flowPulse * 10}`);
        flowRingRef.current.setAttribute('stroke-opacity', `${0.2 + flowPulse * 0.35}`);
      }

      if (ambientAuraRef.current) {
        ambientAuraRef.current.style.transform = `scale(${celebAuraScale})`;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Coordenadas base fijas dentro del viewBox 240x240
  const centerX = 120;
  const centerY = 124;
  const sphereR = 52;

  // Ojos centrados
  const leftEyeBaseX = 101;
  const rightEyeBaseX = 139;
  const eyeBaseY = 118;

  const isFlowActive = (isFlowProp ?? telemetryRef.current.isFlow) || (state === 'ENFOQUE' && telemetryRef.current.focusScore >= 75);

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px`, maxWidth: '100%' }}
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
    >
      <svg
        ref={svgRootRef}
        viewBox="0 0 240 240"
        className="w-full h-full overflow-visible will-change-transform"
      >
        <defs>
          {/* Filtro de resplandor atómico para los ojos */}
          <filter id="eyeGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradiente de Aura Bioluminiscente (100% acelerado por hardware sin filtros CPU pesados) */}
          <radialGradient id="ambientAuraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.coreGlow} stopOpacity="0.80" />
            <stop offset="45%" stopColor={palette.coreGlow} stopOpacity="0.30" />
            <stop offset="100%" stopColor={palette.coreGlow} stopOpacity="0" />
          </radialGradient>

          {/* Filtro de resonancia para Modo Flow */}
          <filter id="flowAuraFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" />
          </filter>

          {/* Gradiente del cuerpo esférico (Obsidiana con reflejos) */}
          <radialGradient id="sphereGrad" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#2e2e33" />
            <stop offset="35%" stopColor="#1a1a1e" />
            <stop offset="70%" stopColor="#111114" />
            <stop offset="100%" stopColor="#08080a" />
          </radialGradient>

          {/* Iluminación de contorno bioluminiscente (Rim Light) */}
          <linearGradient id="rimLighting" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={palette.rimColor} stopOpacity="0.85" />
            <stop offset="50%" stopColor={palette.rimColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          {/* Gradiente de las manitas orbitales */}
          <radialGradient id="handGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#2a2a2e" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
        </defs>

        {/* 1. Halo Ondulatorio de Resonancia en Modo Flow */}
        {isFlowActive && (
          <circle
            ref={flowRingRef}
            cx={centerX}
            cy={centerY}
            r={sphereR + 18}
            fill="none"
            stroke={palette.rimColor}
            strokeWidth="1.5"
            strokeOpacity="0.35"
            filter="url(#flowAuraFilter)"
          />
        )}

        {/* 2. Aura Atmosférica Pulsante Trasera con RadialGradient Puro (Zero CPU blur pass) */}
        <circle
          ref={ambientAuraRef}
          cx={centerX}
          cy={centerY}
          r={sphereR + 24}
          fill="url(#ambientAuraGrad)"
          style={{ transformOrigin: `${centerX}px ${centerY}px` }}
        />

        {/* 3. Manita Izquierda Orbital */}
        <g
          ref={leftHandRef}
          style={{ transformOrigin: '54px 132px' }}
        >
          <ellipse
            cx={54}
            cy={132}
            rx="10"
            ry="14"
            transform="rotate(-15 54 132)"
            fill="url(#handGrad)"
            stroke={palette.rimColor}
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />
          <circle cx={52} cy={128} r="2.5" fill="#ffffff" opacity="0.25" />
        </g>

        {/* 4. Manita Derecha Orbital */}
        <g
          ref={rightHandRef}
          style={{ transformOrigin: '186px 132px' }}
        >
          <ellipse
            cx={186}
            cy={132}
            rx="10"
            ry="14"
            transform="rotate(15 186 132)"
            fill="url(#handGrad)"
            stroke={palette.rimColor}
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />
          <circle cx={184} cy={128} r="2.5" fill="#ffffff" opacity="0.25" />
        </g>

        {/* 5. Chasis Esférico Central con Inclinación Orgánica (Cuello + Gaze) */}
        <g
          ref={bodyGroupRef}
          style={{ transformOrigin: `${centerX}px ${centerY}px` }}
        >
          <circle
            cx={centerX}
            cy={centerY}
            r={sphereR}
            fill="url(#sphereGrad)"
            stroke="url(#rimLighting)"
            strokeWidth="2"
          />

          {/* Reflejo de vidrio cóncavo superior */}
          <path
            d={`M ${centerX - 34} ${centerY - 22} Q ${centerX} ${centerY - 44} ${centerX + 34} ${centerY - 22} Q ${centerX} ${centerY - 35} ${centerX - 34} ${centerY - 22} Z`}
            fill="#ffffff"
            opacity="0.12"
          />

          {/* Visor Facial Sutil con Parallax reactivo al Gaze */}
          <g ref={visorGroupRef} style={{ transformOrigin: `${centerX}px ${centerY}px` }}>
            <ellipse
              cx={centerX}
              cy={centerY - 2}
              rx={38}
              ry={28}
              fill="#050507"
              opacity="0.85"
              stroke="#18181b"
              strokeWidth="1"
            />
          </g>

          {/* 6. Ojos Procedurales Expresivos Controlados Directamente por DOM Refs (Cero React re-renders) */}
          <g ref={eyesGroupRef} style={{ transformOrigin: `${centerX}px ${centerY}px` }}>
            {/* a) ENFOQUE (Default) */}
            <g ref={eyeEnfoqueRef} style={{ display: 'inline' }} filter="url(#eyeGlowFilter)">
              <rect x={leftEyeBaseX - 6} y={eyeBaseY - 8} width="12" height="17" rx="6" fill={palette.eyeColor} />
              <rect x={rightEyeBaseX - 6} y={eyeBaseY - 8} width="12" height="17" rx="6" fill={palette.eyeColor} />
              <circle cx={leftEyeBaseX - 2} cy={eyeBaseY - 4} r="2.2" fill="#ffffff" opacity="0.95" />
              <circle cx={rightEyeBaseX - 2} cy={eyeBaseY - 4} r="2.2" fill="#ffffff" opacity="0.95" />
            </g>

            {/* b) CELEBRACION (^ ^ con mejillas sonrojadas) */}
            <g ref={eyeCelebrationRef} style={{ display: 'none' }} filter="url(#eyeGlowFilter)">
              <path d={`M ${leftEyeBaseX - 9} ${eyeBaseY + 3} Q ${leftEyeBaseX} ${eyeBaseY - 9} ${leftEyeBaseX + 9} ${eyeBaseY + 3}`} stroke={palette.eyeColor} strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d={`M ${rightEyeBaseX - 9} ${eyeBaseY + 3} Q ${rightEyeBaseX} ${eyeBaseY - 9} ${rightEyeBaseX + 9} ${eyeBaseY + 3}`} stroke={palette.eyeColor} strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <ellipse cx={leftEyeBaseX - 11} cy={eyeBaseY + 11} rx="4" ry="2" fill={palette.accentColor} opacity="0.75" />
              <ellipse cx={rightEyeBaseX + 11} cy={eyeBaseY + 11} rx="4" ry="2" fill={palette.accentColor} opacity="0.75" />
            </g>

            {/* c) BLINK (Parpadeo) */}
            <g ref={eyeBlinkRef} style={{ display: 'none' }} stroke={palette.eyeColor} strokeWidth="3" strokeLinecap="round" filter="url(#eyeGlowFilter)">
              <path d={`M ${leftEyeBaseX - 8} ${eyeBaseY} Q ${leftEyeBaseX} ${eyeBaseY + 2} ${leftEyeBaseX + 8} ${eyeBaseY}`} />
              <path d={`M ${rightEyeBaseX - 8} ${eyeBaseY} Q ${rightEyeBaseX} ${eyeBaseY + 2} ${rightEyeBaseX + 8} ${eyeBaseY}`} />
            </g>

            {/* d) ZEN (Ojos curvos relajados) */}
            <g ref={eyeZenRef} style={{ display: 'none' }} stroke={palette.eyeColor} strokeWidth="3.2" strokeLinecap="round" fill="none" filter="url(#eyeGlowFilter)" opacity="0.95">
              <path d={`M ${leftEyeBaseX - 8} ${eyeBaseY - 1} Q ${leftEyeBaseX} ${eyeBaseY + 7} ${leftEyeBaseX + 8} ${eyeBaseY - 1}`} />
              <path d={`M ${rightEyeBaseX - 8} ${eyeBaseY - 1} Q ${rightEyeBaseX} ${eyeBaseY + 7} ${rightEyeBaseX + 8} ${eyeBaseY - 1}`} />
            </g>

            {/* e) ALERTA (Ojos abiertos curiosos) */}
            <g ref={eyeAlertaRef} style={{ display: 'none' }} filter="url(#eyeGlowFilter)">
              <ellipse cx={leftEyeBaseX} cy={eyeBaseY} rx="8" ry="9" fill={palette.eyeColor} />
              <ellipse cx={rightEyeBaseX} cy={eyeBaseY} rx="8" ry="9" fill={palette.eyeColor} />
              <circle cx={leftEyeBaseX + 2} cy={eyeBaseY - 3} r="2.2" fill="#ffffff" />
              <circle cx={rightEyeBaseX + 2} cy={eyeBaseY - 3} r="2.2" fill="#ffffff" />
            </g>

            {/* f) FATIGA (Párpados pesados) */}
            <g ref={eyeFatigaRef} style={{ display: 'none' }} filter="url(#eyeGlowFilter)" opacity="0.88">
              <rect x={leftEyeBaseX - 6} y={eyeBaseY - 5} width="12" height="13" rx="5" fill={palette.eyeColor} />
              <rect x={rightEyeBaseX - 6} y={eyeBaseY - 5} width="12" height="13" rx="5" fill={palette.eyeColor} />
              <path d={`M ${leftEyeBaseX - 8} ${eyeBaseY - 7} Q ${leftEyeBaseX} ${eyeBaseY - 1} ${leftEyeBaseX + 8} ${eyeBaseY - 7} Z`} fill="#09090b" />
              <path d={`M ${rightEyeBaseX - 8} ${eyeBaseY - 7} Q ${rightEyeBaseX} ${eyeBaseY - 1} ${rightEyeBaseX + 8} ${eyeBaseY - 7} Z`} fill="#09090b" />
            </g>

            {/* g) PARALISIS (Pupilas contraídas en tensión) */}
            <g ref={eyeParalisisRef} style={{ display: 'none' }} filter="url(#eyeGlowFilter)">
              <rect x={leftEyeBaseX - 5} y={eyeBaseY - 7} width="10" height="14" rx="4" fill={palette.eyeColor} />
              <rect x={rightEyeBaseX - 5} y={eyeBaseY - 7} width="10" height="14" rx="4" fill={palette.eyeColor} />
              <circle cx={leftEyeBaseX} cy={eyeBaseY} r="2" fill="#09090b" />
              <circle cx={rightEyeBaseX} cy={eyeBaseY} r="2" fill="#09090b" />
            </g>
          </g>

          {/* 7. Onda Orgánica de Voz / Boca cuando FocusBud está hablando */}
          {isSpeaking && (
            <path
              ref={mouthWaveRef}
              d={`M ${centerX - 12} ${centerY + 16} Q ${centerX} ${centerY + 16} ${centerX + 12} ${centerY + 16}`}
              stroke={palette.eyeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#eyeGlowFilter)"
            />
          )}

          {/* 8. Indicador de Pulso Frontal Sutil (Corazón Biométrico) */}
          <circle
            cx={centerX}
            cy={centerY + 32}
            r={isFlowActive ? "3.5" : "3"}
            fill={palette.rimColor}
            opacity={0.7}
            filter="url(#eyeGlowFilter)"
          />
        </g>
      </svg>
    </div>
  );
});

FocusBudLiving.displayName = 'FocusBudLiving';

export default FocusBudLiving;
