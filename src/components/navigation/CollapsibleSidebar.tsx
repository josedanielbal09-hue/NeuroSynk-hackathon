import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  PanelLeftClose,
  Clock,
  Sparkles,
  Settings,
  Trash2,
  Activity,
  BookOpen,
  User,
  RotateCcw,
  X,
  Menu,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  SavedSessionItem,
  getSessionHistory,
  deleteSessionItem,
  clearSessionHistory,
  exportSessionHistory,
  importSessionHistory
} from '../../services/sessionHistoryService';

export type { SavedSessionItem };

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
  const [sessions, setSessions] = useState<SavedSessionItem[]>(() => getSessionHistory());
  const [selectedSession, setSelectedSession] = useState<SavedSessionItem | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [quickNote, setQuickNote] = useState(() => {
    try {
      return localStorage.getItem('neurosynk_quick_notes') || '';
    } catch {
      return '';
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSessions(getSessionHistory());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      setSessions(getSessionHistory());
    };
    window.addEventListener('neurosynk_session_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('neurosynk_session_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSessionItem(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selectedSession?.id === id) {
      setSelectedSession(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Do you want to clear all saved session history on this computer? This action cannot be undone.')) {
      clearSessionHistory();
      setSessions([]);
      setSelectedSession(null);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content && importSessionHistory(content)) {
        setSessions(getSessionHistory());
        alert('Session history imported successfully!');
      } else {
        alert('Invalid NeuroSynk JSON file format.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
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
    const diffMins = Math.round((Date.now() - ts) / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `Today, ${diffHours}h ago`;
    const days = Math.round(diffHours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Floating Toggle Trigger */}
      {!isOpen && !isHeroStage && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-40 p-2.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 shadow-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer group"
          title="Open Menu & History"
        >
          <Menu className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline font-mono text-[11px] font-medium text-zinc-400 group-hover:text-zinc-200">
            Menu
          </span>
          {sessions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      )}

      {/* Backdrop */}
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

      {/* Drawer */}
      <aside
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          willChange: 'transform'
        }}
        className="fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-84 bg-zinc-950 border-r border-zinc-800/90 shadow-[20px_0_60px_rgba(0,0,0,0.8)] flex flex-col justify-between select-none overflow-hidden transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
                  Local Workspace
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* "+ New Session" Button */}
          <button
            type="button"
            onClick={() => {
              onNewSession();
              setIsOpen(false);
            }}
            className="w-full mt-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-teal-500/15 border border-emerald-500/40 hover:border-emerald-500/80 text-emerald-300 font-medium text-sm flex items-center gap-3 transition-all duration-200 cursor-pointer active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.12)] group"
            title="Start New Session"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="whitespace-nowrap font-semibold tracking-wide">New Session</span>
          </button>
        </div>

        {/* MIDDLE SECTION: Recent Sessions & Tools */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          {/* Recent Sessions List */}
          <div className="space-y-1.5">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Saved Sessions
              </span>
              <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 font-mono">
                {sessions.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {sessions.map(item => {
                const isSelected = selectedSession?.id === item.id;
                const isCompleted = item.status === 'COMPLETADA' || (item.completedSteps >= item.totalSteps && item.totalSteps > 0);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSession(item)}
                    className={`group relative flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-zinc-900 border-emerald-500/50 text-emerald-300 shadow-md'
                        : 'bg-zinc-950/70 hover:bg-zinc-900/90 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                      }`} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium truncate text-zinc-200 group-hover:text-white">
                          {item.task}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                          <span>{formatRelativeTime(item.timestamp)}</span>
                          <span>•</span>
                          <span className={isCompleted ? 'text-emerald-400' : 'text-amber-400'}>
                            {item.completedSteps}/{item.totalSteps} steps
                          </span>
                          <span>•</span>
                          <span className="text-cyan-400 font-medium">{item.avgFocus}% Focus</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all cursor-pointer shrink-0 ml-1"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {sessions.length === 0 && (
                <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-900/80 space-y-1">
                  <p className="font-semibold text-zinc-400">No recorded sessions yet</p>
                  <p className="text-[11px] text-zinc-600">Every session you start will be saved automatically on your computer.</p>
                </div>
              )}
            </div>
          </div>

          {/* Tools Hub */}
          <div className="space-y-1.5 pt-3 border-t border-zinc-900">
            <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Tools & Data
            </div>

            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <span className="whitespace-nowrap">Quick Notebook</span>
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
              <span className="whitespace-nowrap">Settings & AI Link</span>
            </button>

            <button
              type="button"
              onClick={exportSessionHistory}
              disabled={sessions.length === 0}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900/90 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
              title="Download JSON backup"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="whitespace-nowrap">Export Records (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
              title="Restore records from JSON file"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Upload className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="whitespace-nowrap">Import Records</span>
            </button>

            {sessions.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="w-full flex items-center gap-3 p-2 rounded-xl text-[11px] font-medium text-zinc-500 hover:text-rose-400 hover:bg-zinc-900/50 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0 text-zinc-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
                <span>Clear Local History</span>
              </button>
            )}
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
                {apiStatus === 'server' ? 'Meta Muse • Live' : (apiStatus === 'browser' ? 'Meta Web' : 'AI Offline')}
              </span>
            </div>
            <span className="text-[9px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 font-semibold uppercase">
              100% On-Device
            </span>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/20 via-zinc-800 to-zinc-900 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-zinc-200 truncate whitespace-nowrap">
                Focus User
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate whitespace-nowrap">
                Private Local Storage
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
                    <h3 className="text-white font-semibold text-sm">Session Summary</h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      {new Date(selectedSession.timestamp).toLocaleDateString()} • {new Date(selectedSession.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                <span className="text-xs font-mono uppercase text-zinc-400 tracking-wider">Goal:</span>
                <p className="text-sm font-semibold text-white mt-1">"{selectedSession.task}"</p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 py-1">
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-mono text-zinc-400">Duration</span>
                  <span className="text-base font-bold text-white mt-0.5">{selectedSession.durationMinutes}m</span>
                </div>
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-mono text-zinc-400">Steps</span>
                  <span className="text-base font-bold text-emerald-400 mt-0.5">
                    {selectedSession.completedSteps}/{selectedSession.totalSteps}
                  </span>
                </div>
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-mono text-zinc-400">Focus</span>
                  <span className="text-base font-bold text-cyan-400 mt-0.5">{selectedSession.avgFocus}%</span>
                </div>
              </div>

              {selectedSession.debriefSummary && (
                <div className="p-3.5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold block mb-1">
                    AI Cognitive Debrief:
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
                  <RotateCcw className="w-3.5 h-3.5" /> Resume / Repeat
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
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
                  <h3 className="text-white font-semibold text-sm">Quick Cognitive Notebook</h3>
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
                placeholder="Jot down sudden ideas, questions, or thoughts without breaking your flow state..."
                className="w-full h-44 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Auto-saved in your browser</span>
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
