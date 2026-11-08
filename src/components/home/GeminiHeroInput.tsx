import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, ShieldCheck, Sliders, Check, Laptop, BookOpen, Shuffle, Zap, Target, Layers, Menu } from 'lucide-react';
import { FocusBudLiving } from '../avatar/FocusBudLiving';

interface GeminiHeroInputProps {
  task: string;
  setTask: (t: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  isSurveyLoading: boolean;
  workMode: 'pantalla' | 'lectura' | 'flexible';
  setWorkMode: (m: 'pantalla' | 'lectura' | 'flexible') => void;
  sensitivity: 'estricto' | 'normal' | 'relajado';
  setSensitivity: (s: 'estricto' | 'normal' | 'relajado') => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
}

const WORK_MODE_LABELS: Record<'pantalla' | 'lectura' | 'flexible', string> = {
  pantalla: 'Screen',
  lectura: 'Reading',
  flexible: 'Flexible'
};

const SENSITIVITY_LABELS: Record<'estricto' | 'normal' | 'relajado', string> = {
  estricto: 'Strict',
  normal: 'Balanced',
  relajado: 'Relaxed'
};

const QUICK_PROMPTS = [
  {
    icon: Target,
    label: "Focus Mode",
    text: "Complete my top priority deliverable for today",
    color: "from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/30"
  },
  {
    icon: Zap,
    label: "25m Sprint",
    text: "25-minute distraction-free focus sprint",
    color: "from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/30"
  },
  {
    icon: Layers,
    label: "Atomic Breakdown",
    text: "Structure and break down a complex topic into micro-steps",
    color: "from-purple-500/20 to-purple-500/5 text-purple-300 border-purple-500/30"
  },
  {
    icon: BookOpen,
    label: "Deep Reading",
    text: "Critical reading and synthesis of technical notes",
    color: "from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-500/30"
  }
];

export const GeminiHeroInput: React.FC<GeminiHeroInputProps> = ({
  task,
  setTask,
  onSubmit,
  isLoading,
  isSurveyLoading,
  workMode,
  setWorkMode,
  sensitivity,
  setSensitivity,
  onOpenSettings,
  onToggleSidebar
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim() || isLoading || isSurveyLoading) return;
    onSubmit(e);
  };

  const handleChipClick = (presetText: string) => {
    setTask(presetText);
  };

  const isBusy = isLoading || isSurveyLoading;

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col justify-between items-center px-4 py-8 sm:py-12 overflow-hidden select-none">
      {/* Dynamic Background Glow Effect (Zero-Blur Radial Gradients for 60 FPS GPU Compositing) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 65% 45% at 50% 22%, rgba(16, 185, 129, 0.11), rgba(168, 85, 247, 0.04) 45%, transparent 80%)'
        }}
      />

      {/* Top Bar Minimalist */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 px-2 sm:px-4">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="Open Menu & History"
            >
              <Menu className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline font-mono text-[11px] text-zinc-400 font-medium">Menu</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/30 to-emerald-400/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
              NeuroSynk <span className="text-zinc-500 text-xs font-normal font-mono">Workspace</span>
            </span>
          </div>

          {/* Quick Calibration Popover Trigger */}
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-300 font-medium transition-all shadow-sm hover:border-zinc-700 cursor-pointer active:scale-95"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mode: {WORK_MODE_LABELS[workMode] || workMode} • {SENSITIVITY_LABELS[sensitivity] || sensitivity}</span>
          </button>
        </div>

        {/* Right spacer for fixed global controls (Brown Noise & AI Status) */}
        <div className="w-64 hidden sm:block" />
      </header>

      {/* Central Hero Section */}
      <main className="w-full max-w-3xl flex flex-col items-center justify-center my-auto z-10 text-center px-2 sm:px-4">
        {/* Animated Living Mascot Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex flex-col items-center justify-center relative"
        >
          <div className="relative group cursor-pointer" onClick={() => onOpenSettings?.()}>
            <FocusBudLiving
              size={124}
              state={isBusy ? "CELEBRACION" : "ENFOQUE"}
              isStreaming={isBusy}
              isSpeaking={false}
              isFlow={!isBusy}
            />
          </div>
        </motion.div>

        {/* Hero Title and Subtitle with Morphing Out Effect */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: isBusy ? 0 : 1,
            y: isBusy ? -20 : 0,
            scale: isBusy ? 0.95 : 1
          }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3"
        >
          Where should we{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            start today?
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: isBusy ? 0 : 1,
            y: isBusy ? -16 : 0
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm sm:text-base text-zinc-400 max-w-lg mb-8 font-normal leading-relaxed"
        >
          Enter your study or work goal. FocusBud and Google Gemini will break your session into guided blocks with live biometrics.
        </motion.p>

        {/* Main Capsule Input Form */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{
            opacity: 1,
            y: isBusy ? -36 : 0,
            scale: isBusy ? 0.98 : 1
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={handleSubmit}
          className="w-full relative group"
        >
          <div className="relative flex items-center w-full rounded-2xl sm:rounded-3xl bg-zinc-900/95 border border-zinc-800/90 hover:border-zinc-700/80 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:shadow-[0_0_35px_rgba(16,185,129,0.14)] transition-colors duration-200 p-2 sm:p-2.5">
            <div className="pl-3 sm:pl-4 pr-2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors">
              <Sparkles className="w-5 h-5" />
            </div>

            <input
              type="text"
              autoFocus
              spellCheck={false}
              disabled={isBusy}
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="Enter your goal, exam, reading, or project..."
              className="w-full bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base px-2 py-3 focus:outline-none font-sans font-normal"
            />

            <button
              type="submit"
              disabled={!task.trim() || isBusy}
              className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                task.trim() && !isBusy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              title="Calibrate & Start Session"
            >
              {isBusy ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 font-bold" />
              )}
            </button>
          </div>

          {/* Morphing Feedback Indicator */}
          {isBusy && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 flex items-center justify-center gap-2.5 text-xs font-mono text-emerald-400 font-medium select-none"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Syncing biometrics and structuring your focus roadmap...</span>
            </motion.div>
          )}
        </motion.form>

        {/* Quick Suggestion Chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: isBusy ? 0 : 1,
            y: isBusy ? 16 : 0,
            pointerEvents: isBusy ? 'none' : 'auto'
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-5"
        >
          {QUICK_PROMPTS.map((prompt, idx) => {
            const Icon = prompt.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(prompt.text)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-gradient-to-b border transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer shadow-sm ${prompt.color}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{prompt.label}</span>
              </button>
            );
          })}
        </motion.div>
      </main>

      {/* Footer Minimalist */}
      <footer className="w-full max-w-3xl flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 font-mono gap-3 z-10 border-t border-zinc-900/80 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
          <span>100% GPU-processed local biometrics • On-Device Privacy</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Google Gemini 3.5 / 2.5 / 2.0 Flash
          </span>
        </div>
      </footer>

      {/* Preferences Modal (Work Mode & Sensitivity) */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-5 text-left"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-white font-semibold text-sm">Environment Calibration</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="text-zinc-500 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>

              {/* Work Mode Selector */}
              <div>
                <label className="text-xs font-mono uppercase text-zinc-400 tracking-wider block mb-2">
                  Activity Profile:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pantalla', label: 'Screen', icon: Laptop },
                    { id: 'lectura', label: 'Reading', icon: BookOpen },
                    { id: 'flexible', label: 'Flexible', icon: Shuffle }
                  ].map(item => {
                    const Icon = item.icon;
                    const isSelected = workMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setWorkMode(item.id as any)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sensitivity Selector */}
              <div>
                <label className="text-xs font-mono uppercase text-zinc-400 tracking-wider block mb-2">
                  AI Alert Tolerance:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'estricto', label: 'Strict', desc: 'Fast' },
                    { id: 'normal', label: 'Balanced', desc: 'Standard' },
                    { id: 'relajado', label: 'Relaxed', desc: 'Gentle' }
                  ].map(item => {
                    const isSelected = sensitivity === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSensitivity(item.id as any)}
                        className={`flex flex-col items-center justify-center gap-0.5 p-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-[10px] text-zinc-500 font-normal">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer"
              >
                Confirm Settings
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
