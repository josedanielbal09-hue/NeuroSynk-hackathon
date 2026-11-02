import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, Cpu, Camera, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

export interface WarmupStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  detail?: string;
}

interface PreWarmupScreenProps {
  isVisible: boolean;
  steps: WarmupStep[];
  progress: number;
  onSkip?: () => void;
}

export const PreWarmupScreen: React.FC<PreWarmupScreenProps> = ({
  isVisible,
  steps,
  progress,
  onSkip
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="prewarmup-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden"
        >
          {/* Fondo Atmosférico con Glow Radial Procedural */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_120%,rgba(6,182,212,0.12),rgba(255,255,255,0))] pointer-events-none" />

          {/* Barra de Progreso Superior Cinemática */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-900/60 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>

          {/* Contenedor Central */}
          <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center space-y-8">
            
            {/* Núcleo Holográfico Animado */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Anillo exterior rotatorio */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-dashed border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              />

              {/* Anillo concéntrico pulsante */}
              <motion.div
                animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                className="absolute inset-3 rounded-full border border-teal-400/50"
              />

              {/* Núcleo de cristal con icono */}
              <div className="relative w-16 h-16 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 backdrop-blur-md flex items-center justify-center shadow-2xl">
                <BrainCircuit className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Título de Branding e Identidad Comercial */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] tracking-widest uppercase">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Calibración de Hardware en Tiempo Real</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Iniciando NeuroSynk
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed font-sans">
                Optimizando aceleración por GPU y compilando sensores biométricos a 60 FPS{dots}
              </p>
            </div>

            {/* Lista de Fases de Hardware Reales */}
            <div className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-md space-y-3 shadow-xl">
              {steps.map(step => {
                const isDone = step.status === 'completed';
                const isLoading = step.status === 'loading';
                const isError = step.status === 'error';

                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between text-xs font-mono transition-all duration-300"
                  >
                    <div className="flex items-center gap-2.5">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : isLoading ? (
                        <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin flex-shrink-0" />
                      ) : isError ? (
                        <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-zinc-700 flex-shrink-0" />
                      )}
                      <span className={isDone ? 'text-zinc-200' : isLoading ? 'text-emerald-300 font-bold' : 'text-zinc-500'}>
                        {step.label}
                      </span>
                    </div>

                    <span className="text-[10px] text-zinc-500 tracking-wider">
                      {step.detail || (isDone ? 'OK' : isLoading ? 'CARGANDO' : 'PENDIENTE')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Garantía de Privacidad Edge & Botón de Escape */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Edge Privacy: 100% On-Device (0 imágenes a la nube)</span>
              </div>

              {onSkip && progress > 40 && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 font-mono underline transition-colors cursor-pointer pt-1"
                >
                  Continuar sin esperar calibración completa →
                </button>
              )}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
