'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { SessionSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const STORAGE_KEY = 'convoiq_settings_v1';

interface SettingsContextValue {
  settings: SessionSettings;
  updateSettings: (patch: Partial<SessionSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SessionSettings>(() => {
    // Lazy initializer: read from localStorage synchronously at mount time
    // (safe here because useState initializer only runs once, not on every render)
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<SessionSettings>;
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch { /* ignore corrupt storage */ }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (patch: Partial<SessionSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}
