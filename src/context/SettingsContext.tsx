'use client';

import { createContext, useContext, useSyncExternalStore, ReactNode } from 'react';
import { SessionSettings } from '@/types';
import { DEFAULT_SETTINGS, AVAILABLE_LLM_MODELS, AVAILABLE_TRANSCRIPTION_MODELS } from '@/lib/defaults';

const STORAGE_KEY = 'convoiq_settings_v1';

interface SettingsContextValue {
  settings: SessionSettings;
  updateSettings: (patch: Partial<SessionSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const listeners = new Set<() => void>();

// Cache the last-read settings object so useSyncExternalStore gets a stable
// reference between calls (avoids the "getSnapshot should be cached" infinite loop).
let cachedSettings: SessionSettings | null = null;

const CURRENT_PROMPT_VERSION = 3;

function readStoredSettings(): SessionSettings {
  if (cachedSettings !== null) return cachedSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      let parsed = JSON.parse(stored) as Partial<SessionSettings>;
      let needsWrite = false;

      // Migrate prompt version
      if (!parsed.promptVersion || parsed.promptVersion < CURRENT_PROMPT_VERSION) {
        parsed = {
          ...parsed,
          chatSystemPrompt: DEFAULT_SETTINGS.chatSystemPrompt,
          detailedAnswerPrompt: DEFAULT_SETTINGS.detailedAnswerPrompt,
          promptVersion: CURRENT_PROMPT_VERSION,
        };
        needsWrite = true;
      }

      const isValidLlm = AVAILABLE_LLM_MODELS.some((m) => m.id === parsed.llmModel);
      const isValidTrans = AVAILABLE_TRANSCRIPTION_MODELS.some((m) => m.id === parsed.transcriptionModel);

      if (!isValidLlm) {
        parsed.llmModel = DEFAULT_SETTINGS.llmModel;
        needsWrite = true;
      }
      if (!isValidTrans) {
        parsed.transcriptionModel = DEFAULT_SETTINGS.transcriptionModel;
        needsWrite = true;
      }

      cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };

      if (needsWrite) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
        } catch { /* ignore */ }
      }
      return cachedSettings;
    }
  } catch { /* ignore corrupt storage */ }
  cachedSettings = { ...DEFAULT_SETTINGS, promptVersion: CURRENT_PROMPT_VERSION };
  return cachedSettings;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySettingsChanged() {
  // Invalidate cache so the next getSnapshot call re-reads from localStorage
  cachedSettings = null;
  listeners.forEach((listener) => listener());
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(subscribe, readStoredSettings, () => DEFAULT_SETTINGS);

  const updateSettings = (patch: Partial<SessionSettings>) => {
    const next = { ...settings, ...patch };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    notifySettingsChanged();
  };

  const resetSettings = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    notifySettingsChanged();
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
