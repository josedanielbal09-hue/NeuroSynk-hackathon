import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  Globe,
  Sparkles,
  Mic,
  Volume2,
  Sliders,
  Eye,
  EyeOff,
  Check,
  X,
  Laptop,
  BookOpen,
  Shuffle,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { sanitizeApiKey, testGeminiConnection } from '../../services/metaModelClient';

interface NeuroSynkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  apiStatus: 'browser' | 'server' | 'none';
  setApiStatus: (status: 'browser' | 'server' | 'none') => void;
  workMode: 'pantalla' | 'lectura' | 'flexible';
  setWorkMode: (mode: 'pantalla' | 'lectura' | 'flexible') => void;
  sensitivity: 'estricto' | 'normal' | 'relajado';
  setSensitivity: (s: 'estricto' | 'normal' | 'relajado') => void;
  onRecalibrate?: () => void;
}

type SettingsTabId = 'general' | 'ai' | 'voice' | 'biometrics';

export const NeuroSynkSettingsModal: React.FC<NeuroSynkSettingsModalProps> = ({
  isOpen,
  onClose,
  geminiApiKey,
  setGeminiApiKey,
  apiStatus,
  setApiStatus,
  workMode,
  setWorkMode,
  sensitivity,
  setSensitivity,
  onRecalibrate
}) => {
  const { settings, language, setLanguage, updateSettings, t } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const handleSaveAll = () => {
    const cleanKey = sanitizeApiKey(geminiApiKey);
    setGeminiApiKey(cleanKey);
    try {
      localStorage.setItem('gemini_api_key', cleanKey);
      localStorage.removeItem('gemini_api_key_cleared');
      localStorage.setItem('gemini_confirmed_model', 'gemini-3.5-flash');
      setApiStatus(cleanKey ? 'browser' : 'server');
    } catch (e) {
      console.warn('Storage warning:', e);
    }
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 450);
  };

  const handleClearKey = () => {
    setGeminiApiKey('');
    try {
      localStorage.removeItem('gemini_api_key');
      localStorage.setItem('gemini_api_key_cleared', 'true');
    } catch {
      // ignore
    }
    setKeyTestResult(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-zinc-900 border border-zinc-800/90 rounded-3xl max-w-xl w-full shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/50">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Settings className="text-emerald-400 w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-white font-semibold text-base sm:text-lg tracking-tight">
                    {t.settingsModal.title}
                  </h3>
                  <span className="font-mono text-[10px] text-zinc-400 tracking-wider">
                    {t.settingsModal.subtitle}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title={t.common.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 sm:px-6 pt-3 bg-zinc-950/30 border-b border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'general' as const, label: t.settingsModal.tabs.general, icon: Globe },
                { id: 'ai' as const, label: t.settingsModal.tabs.ai, icon: Sparkles },
                { id: 'voice' as const, label: t.settingsModal.tabs.voice, icon: Mic },
                { id: 'biometrics' as const, label: t.settingsModal.tabs.biometrics, icon: Sliders }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Body */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[62vh] overflow-y-auto custom-scrollbar">
              {/* TAB 1: LANGUAGE & GENERAL */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">
                        {t.settingsModal.languageSectionTitle}
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {t.settingsModal.languageSectionDesc}
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setLanguage('es')}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                          language === 'es'
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                            : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold flex items-center gap-2">
                            🇪🇸 Español
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            Interfaz • Voz STT/TTS • IA
                          </span>
                        </div>
                        {language === 'es' && (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                          language === 'en'
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                            : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold flex items-center gap-2">
                            🇺🇸 English
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            UI • Voice STT/TTS • AI
                          </span>
                        </div>
                        {language === 'en' && (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{t.settingsModal.bilingualHint}</span>
                  </div>
                </div>
              )}

              {/* TAB 2: AI & API KEY */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
                        {t.settingsModal.aiCascadeLabel}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {apiStatus === 'browser' || apiStatus === 'server' ? t.common.active : t.common.offline}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                        <div className="text-[10px] text-zinc-400">1° Primary</div>
                        <div className="font-bold mt-0.5">gemini-3.5-flash</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                        <div className="text-[10px] text-zinc-400">2° Fallback</div>
                        <div className="font-bold mt-0.5">gemini-2.5-flash</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300">
                        <div className="text-[10px] text-zinc-400">3° Ultra-Fast</div>
                        <div className="font-bold mt-0.5">gemini-2.0-flash</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                      {t.settingsModal.apiKeyLabel}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t.settingsModal.apiKeyPlaceholder}
                        value={geminiApiKey}
                        onChange={e => {
                          setGeminiApiKey(e.target.value);
                          setKeyTestResult(null);
                        }}
                        className="w-full px-4 py-3 pr-11 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 font-mono text-xs shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                      >
                        {showApiKey ? (
                          <EyeOff className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] text-zinc-500">
                        {t.settingsModal.getKeyAt}{' '}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline font-medium"
                        >
                          Google AI Studio
                        </a>
                        .
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleClearKey}
                          className="text-[11px] font-mono px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors cursor-pointer"
                        >
                          {t.common.clear}
                        </button>
                        <button
                          type="button"
                          disabled={isTestingKey}
                          onClick={async () => {
                            setIsTestingKey(true);
                            setKeyTestResult(null);
                            const res = await testGeminiConnection(geminiApiKey);
                            setIsTestingKey(false);
                            setKeyTestResult(res);
                          }}
                          className="text-[11px] font-mono px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          {isTestingKey
                            ? t.settingsModal.testingConnection
                            : t.settingsModal.testConnection}
                        </button>
                      </div>
                    </div>

                    {keyTestResult && (
                      <div
                        className={`p-3 rounded-xl text-xs font-mono border mt-1 ${
                          keyTestResult.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                      >
                        {keyTestResult.success ? '✅ ' : '❌ '}
                        {keyTestResult.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: VOICE & MULTIMODAL AUDIO */}
              {activeTab === 'voice' && (
                <div className="space-y-4">
                  {/* TTS Toggle */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>{t.settingsModal.ttsToggleLabel}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {t.settingsModal.ttsToggleDesc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSettings({ ttsEnabled: !settings.ttsEnabled })}
                      className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
                        settings.ttsEnabled ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                          settings.ttsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Earcons Toggle */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span>{t.settingsModal.earconsToggleLabel}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {t.settingsModal.earconsToggleDesc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSettings({ earconsEnabled: !settings.earconsEnabled })}
                      className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
                        settings.earconsEnabled ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                          settings.earconsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Microphone Mode */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
                    <label className="text-xs font-mono uppercase text-zinc-400 tracking-wider block">
                      {t.settingsModal.micModeLabel}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => updateSettings({ voiceMode: 'continuous' })}
                        className={`p-3 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                          settings.voiceMode === 'continuous'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        🎙️ {t.settingsModal.micModeContinuous}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSettings({ voiceMode: 'push_to_talk' })}
                        className={`p-3 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                          settings.voiceMode === 'push_to_talk'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        ⌨️ {t.settingsModal.micModePush}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BIOMETRICS & CALIBRATION */}
              {activeTab === 'biometrics' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-mono uppercase text-zinc-400 tracking-wider block mb-2">
                      {t.hero.activityProfileLabel}
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'pantalla' as const, label: t.hero.workModes.pantalla, icon: Laptop },
                        { id: 'lectura' as const, label: t.hero.workModes.lectura, icon: BookOpen },
                        { id: 'flexible' as const, label: t.hero.workModes.flexible, icon: Shuffle }
                      ].map(item => {
                        const Icon = item.icon;
                        const isSelected = workMode === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setWorkMode(item.id);
                              updateSettings({ defaultWorkMode: item.id });
                            }}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
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

                  <div>
                    <label className="text-xs font-mono uppercase text-zinc-400 tracking-wider block mb-2">
                      {t.hero.alertToleranceLabel}
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        {
                          id: 'estricto' as const,
                          label: t.hero.sensitivities.estricto,
                          desc: t.hero.sensitivityDesc.estricto
                        },
                        {
                          id: 'normal' as const,
                          label: t.hero.sensitivities.normal,
                          desc: t.hero.sensitivityDesc.normal
                        },
                        {
                          id: 'relajado' as const,
                          label: t.hero.sensitivities.relajado,
                          desc: t.hero.sensitivityDesc.relajado
                        }
                      ].map(item => {
                        const isSelected = sensitivity === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSensitivity(item.id);
                              updateSettings({ defaultSensitivity: item.id });
                            }}
                            className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className="text-[10px] text-zinc-500 font-normal">
                              {item.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {onRecalibrate && (
                    <button
                      type="button"
                      onClick={() => {
                        onRecalibrate();
                        onClose();
                      }}
                      className="w-full py-3 px-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-emerald-400 transition-colors cursor-pointer"
                    >
                      {t.settingsModal.recalibrateBtn}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 sm:p-6 pt-4 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-3">
              {savedToast ? (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> {t.settingsModal.savedSuccess}
                </span>
              ) : (
                <span className="text-[11px] font-mono text-zinc-500">
                  {t.common.language}: <strong className="text-emerald-400 uppercase">{language}</strong>
                </span>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  {t.common.close}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-colors uppercase tracking-wider cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

