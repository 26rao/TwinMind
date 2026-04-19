'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SessionSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const STORAGE_KEY = 'twinmind_settings_v2'; // bumped version to clear stale keys

interface SettingsContextValue {
  settings: SessionSettings;
  updateSettings: (patch: Partial<SessionSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);

  // Hydrate from localStorage on mount, merging with defaults to handle new fields
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SessionSettings>;
        // Deep merge: new fields from DEFAULT_SETTINGS are included
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore corrupt storage */ }
  }, []);

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
