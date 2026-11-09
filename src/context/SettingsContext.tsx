import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AppLanguage, TRANSLATIONS } from '../i18n/translations';
import { audioService } from '../services/audioService';

export interface NeuroSynkUserSettings {
  language: AppLanguage;
  voiceMode: 'continuous' | 'push_to_talk';
  ttsEnabled: boolean;
  earconsEnabled: boolean;
  defaultWorkMode: 'pantalla' | 'lectura' | 'flexible';
  defaultSensitivity: 'estricto' | 'normal' | 'relajado';
}

const STORAGE_KEY = 'neurosynk_settings_v4';

const DEFAULT_SETTINGS: NeuroSynkUserSettings = {
  language: 'es',
  voiceMode: 'continuous',
  ttsEnabled: true,
  earconsEnabled: true,
  defaultWorkMode: 'pantalla',
  defaultSensitivity: 'normal'
};

let currentAppLanguageSingleton: AppLanguage = 'es';

export function getCurrentAppLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.language === 'en' || parsed?.language === 'es') {
          currentAppLanguageSingleton = parsed.language;
          return parsed.language;
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return currentAppLanguageSingleton;
}

interface SettingsContextValue {
  settings: NeuroSynkUserSettings;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  updateSettings: (partial: Partial<NeuroSynkUserSettings>) => void;
  t: (typeof TRANSLATIONS)[AppLanguage];
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<NeuroSynkUserSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged: NeuroSynkUserSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          language: parsed?.language === 'en' ? 'en' : 'es'
        };
        currentAppLanguageSingleton = merged.language;
        return merged;
      }
    } catch (e) {
      console.warn('[SettingsContext] Failed to read settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    currentAppLanguageSingleton = settings.language;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SettingsContext] Failed to persist settings:', e);
    }
    // Sync language & mute preferences with AudioService
    audioService.setLanguage(settings.language);
    audioService.setTtsEnabled(settings.ttsEnabled);
    audioService.setEarconsEnabled(settings.earconsEnabled);
  }, [settings]);

  const setLanguage = (lang: AppLanguage) => {
    currentAppLanguageSingleton = lang;
    setSettings(prev => ({ ...prev, language: lang }));
  };

  const updateSettings = (partial: Partial<NeuroSynkUserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      currentAppLanguageSingleton = next.language;
      return next;
    });
  };

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      language: settings.language,
      setLanguage,
      updateSettings,
      t: TRANSLATIONS[settings.language]
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Fallback if used outside provider
    return {
      settings: DEFAULT_SETTINGS,
      language: currentAppLanguageSingleton,
      setLanguage: (lang: AppLanguage) => {
        currentAppLanguageSingleton = lang;
      },
      updateSettings: () => {},
      t: TRANSLATIONS[currentAppLanguageSingleton]
    };
  }
  return ctx;
}

