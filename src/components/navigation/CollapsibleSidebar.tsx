import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Sparkles,
  Settings,
  Trash2,
  Activity,
  BookOpen,
  User,
  RotateCcw,
  X,
  Menu
} from 'lucide-react';

export interface SavedSessionItem {
  id: string;
  task: string;
  timestamp: number;
  durationMinutes: number;
  completedSteps: number;
  totalSteps: number;
  avgFocus: number;
  debriefSummary?: string;
}

interface CollapsibleSidebarProps {
  currentTask?: string;
  onNewSession: () => void;
  onSelectPastSession?: (session: SavedSessionItem) => void;
  onOpenSettings: () => void;
  apiStatus: 'browser' | 'server' | 'none';
  isOpen: boolean;
  setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isHeroStage?: boolean;
}

const STORAGE_KEY = 'neurosynk_session_history';

const SEED_SESSIONS: SavedSessionItem[] = [
  {
    id: 'seed-1',
    task: 'Estudio de Biología Celular y Fotosíntesis',
    timestamp: Date.now() - 3600 * 1000 * 3,
    durationMinutes: 48,
    completedSteps: 6,
    totalSteps: 6,
    avgFocus: 88,
    debriefSummary: 'Completaste con éxito los 6 pasos. Gran retención en el ciclo de Calvin y disipación de fatiga oportuna.'
  },
  {
    id: 'seed-2',
    task: 'Diseño de Arquitectura y Shaders WebGL',
    timestamp: Date.now() - 3600 * 1000 * 24,
    durationMinutes: 35,
    completedSteps: 4,
    totalSteps: 5,
    avgFocus: 82,
    debriefSummary: 'Sprint productivo. Estructuraste los tensores y mantuviste postura erguida el 85% del tiempo.'
  }
];

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  currentTask,
  onNewSession,
  onSelectPastSession,
  onOpenSettings,
  apiStatus,
  isOpen,
  setIsOpen,
  isHeroStage = false
}) => {
  const [sessions, setSessions] = useState<SavedSessionItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load session history:', e);
    }
    return SEED_SESSIONS;
  });

  const [selectedSession, setSelectedSession] = useState<SavedSessionItem | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [quickNote, setQuickNote] = useState(() => {
    try {
      return localStorage.getItem('neurosynk_quick_notes') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  }, [sessions]);

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selectedSession?.id === id) {
      setSelectedSession(null);
    }
  };

  const handleSaveNote = (text: string) => {
    setQuickNote(text);
    try {
      localStorage.setItem('neurosynk_quick_notes', text);
    } catch (e) {
      console.warn('Storage error:', e);
    }
  };

  const formatRelativeTime = (ts: number): string => {
    const diffHours = Math.round((Date.now() - ts) / (1000 * 3600));
    if (diffHours < 1) return 'Hace un momento';
    if (diffHours < 24) return `Hoy hace ${diffHours}h`;
    const days = Math.round(diffHours / 24);
    if (days === 1) return 'Ayer';
    return `Hace ${days} días`;
  };

  return (
    <>
      {/* Persistent Floating Toggle Trigger (top-left) when closed and not on hero stage */}
      {!isOpen && !isHeroStage && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-40 p-2.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 shadow-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer group"
          title="Abrir Menú & Historial (Gemini Workspace)"
        >
          <Menu className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline font-mono text-[11px] font-medium text-zinc-400 group-hover:text-zinc-200">
            Menú
          </span>
        </button>
      )}

      {/* Backdrop overlay for drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
          />
        )}
      </AnimatePresence>

      {/* Hardware-Accelerated Sliding Drawer (GPU Translate, 0 Layout Thrashing) */}
      <aside
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          willChange: 'transform'
        }}
        className="fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-80 bg-zinc-950 border-r border-zinc-800/90 shadow-[20px_0_60px_rgba(0,0,0,0.8)] flex flex-col justify-between select-none overflow-hidden transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* TOP SECTION: Header & Actions */}
        <div className="flex flex-col p-4 gap-3 shrink-0 border-b border-zinc-900/80">
          <div className="flex items-center justify-between h-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-white text-sm tracking-tight leading-none whitespace-nowrap">
                  NeuroSynk
                </span>
                <span className="text-[10px] text-zinc-500 font-mono tracking-wider whitespace-nowrap mt-0.5">
                  Workspace
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Cerrar barra lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* "+ Nueva Sesión" Button */}
          <button
            type="button"
            onClick={() => {
              onNewSession();
              setIsOpen(false);
            }}
            className="w-full mt-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-teal-500/15 border border-emerald-500/40 hover:border-emerald-500/80 text-emerald-300 font-medium text-sm flex items-center gap-3 transition-all duration-200 cursor-pointer active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.12)] group"
            title="Iniciar Nueva Sesión"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="whitespace-nowrap font-semibold tracking-wide">Nueva Sesión</span>
          </button>
        </div>

        {/* MIDDLE SECTION: Recent Sessions & Tools */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          {/* Recent Sessions List */}
          <div className="space-y-1.5">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Sesiones Recientes
              </span>
              <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded-md">
                {sessions.length}
              </span>
            </div>

            <div className="space-y-1">
              {sessions.map(item => {
                const isSelected = selectedSession?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSession(item)}
                    className={`group relative flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-zinc-900 border-emerald-500/40 text-emerald-300 shadow-md'
                        : 'bg-zinc-950/60 hover:bg-zinc-900/90 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium truncate text-zinc-200 group-hover:text-white whitespace-nowrap">
                          {item.task}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5 whitespace-nowrap">
                          <span>{formatRelativeTime(item.timestamp)}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{item.avgFocus}% Foco</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all cursor-pointer shrink-0 ml-1"
                      title="Eliminar de historial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {sessions.length === 0 && (
                <div className="p-4 text-center text-xs text-zinc-600 italic bg-zinc-900/40 rounded-xl border border-zinc-900">
                  Sin sesiones grabadas aún.
                </div>
              )}
            </div>
          </div>

          {/* Tools Hub */}
          <div className="space-y-1.5 pt-3 border-t border-zinc-900">
            <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Herramientas
            </div>

            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <span className="whitespace-nowrap">Cuaderno de Notas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="whitespace-nowrap">Ajustes & Enlace IA</span>
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: Status & Profile */}
        <div className="p-4 border-t border-zinc-900 flex flex-col gap-2.5 bg-zinc-950 shrink-0">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-300">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                apiStatus === 'server' || apiStatus === 'browser'
                  ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-red-500'
              }`} />
              <span className="truncate whitespace-nowrap font-medium">
                {apiStatus === 'server' ? 'Meta Muse • Live' : (apiStatus === 'browser' ? 'Meta Web' : 'IA Offline')}
              </span>
            </div>
            <span className="text-[9px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 font-semibold uppercase">
              60 FPS
            </span>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/20 via-zinc-800 to-zinc-900 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-zinc-200 truncate whitespace-nowrap">
                Usuario Focus
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate whitespace-nowrap">
                GPU On-Device
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* SESSION DETAILS MODAL */}
      <AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-left relative"
            >
              <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Resumen de Sesión</h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      {new Date(selectedSession.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <span className="text-xs font-mono uppercase text-zinc-400 tracking-wider">Objetivo:</span>
                <p className="text-sm font-semibold text-white mt-1">"{selectedSession.task}"</p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 py-1">
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-mono text-zinc-400">Duración</span>
                  <span className="text-base font-bold text-white mt-0.5">{selectedSession.durationMinutes}m</span>
                </div>
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-mono text-zinc-400">Pasos</span>
                  <span className="text-base font-bold text-emerald-400 mt-0.5">
                    {selectedSession.completedSteps}/{selectedSession.totalSteps}
                  </span>
                </div>
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-mono text-zinc-400">Enfoque</span>
                  <span className="text-base font-bold text-cyan-400 mt-0.5">{selectedSession.avgFocus}%</span>
                </div>
              </div>

              {selectedSession.debriefSummary && (
                <div className="p-3.5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold block mb-1">
                    Debriefing Cognitivo IA:
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {selectedSession.debriefSummary}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    onSelectPastSession?.(selectedSession);
                    setSelectedSession(null);
                    setIsOpen(false);
                  }}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Repetir / Continuar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK NOTES MODAL */}
      <AnimatePresence>
        {showNotesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 text-left relative"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <h3 className="text-white font-semibold text-sm">Cuaderno Cognitivo Rápido</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={quickNote}
                onChange={e => handleSaveNote(e.target.value)}
                placeholder="Apunta ideas repentinas, dudas o reflexiones para no romper tu estado de flujo..."
                className="w-full h-44 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Guardado automático en tu navegador</span>
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
