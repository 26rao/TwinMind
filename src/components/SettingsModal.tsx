'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { SessionSettings } from '@/types';
import { DEFAULT_SETTINGS, AVAILABLE_LLM_MODELS, AVAILABLE_TRANSCRIPTION_MODELS } from '@/lib/defaults';
import styles from './SettingsModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Outer component controls visibility; inner component owns state so it
// re-initialises cleanly from `settings` every time the modal is opened.
export function SettingsModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  return <SettingsModalContent onClose={onClose} />;
}

function SettingsModalContent({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useSettings();
  // Draft is initialised from current settings when the modal mounts (i.e. when it opens).
  // No useEffect sync needed because the inner component is unmounted/remounted on each open.
  const [draft, setDraft] = useState<SessionSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'prompts'>('general');

  // Keyboard shortcut — legitimate external-system subscription, not a state sync.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  };

  const handleReset = () => {
    setDraft(DEFAULT_SETTINGS);
    resetSettings();
  };

  const set = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⚙️ Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        {/* Tab bar */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'prompts' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            Prompts
          </button>
        </div>

        <div className={styles.scrollBody}>

          {activeTab === 'general' && (
            <>
              {/* API Key */}
              <Section title="Groq API Key">
                <div className={styles.keyRow}>
                  <input
                    id="settings-api-key"
                    className={styles.input}
                    type={showKey ? 'text' : 'password'}
                    value={draft.groqApiKey}
                    onChange={(e) => set('groqApiKey', e.target.value)}
                    placeholder="gsk_..."
                  />
                  <button className={styles.eyeBtn} onClick={() => setShowKey(!showKey)} aria-label="Toggle visibility">
                    {showKey ? '🙈' : '👁'}
                  </button>
                </div>
                <p className={styles.hint}>Stored in your browser only — never sent to our servers. Get one at <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className={styles.link}>console.groq.com</a></p>
              </Section>

              {/* Model Selection */}
              <Section title="Models">
                <label className={styles.label}>
                  Language Model (suggestions + chat)
                  <select
                    id="settings-llm-model"
                    className={styles.select}
                    value={draft.llmModel}
                    onChange={(e) => set('llmModel', e.target.value)}
                  >
                    {AVAILABLE_LLM_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  Transcription Model
                  <select
                    id="settings-transcription-model"
                    className={styles.select}
                    value={draft.transcriptionModel}
                    onChange={(e) => set('transcriptionModel', e.target.value)}
                  >
                    {AVAILABLE_TRANSCRIPTION_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
              </Section>

              {/* Timing */}
              <Section title="Timing">
                <label className={styles.label}>
                  Auto-refresh interval: <strong>{draft.autoRefreshInterval}s</strong>
                  <input
                    id="settings-refresh-interval"
                    className={styles.slider}
                    type="range"
                    min={10}
                    max={120}
                    step={5}
                    value={draft.autoRefreshInterval}
                    onChange={(e) => set('autoRefreshInterval', Number(e.target.value))}
                  />
                  <div className={styles.sliderLabels}><span>10s</span><span>120s</span></div>
                </label>
              </Section>

              {/* Context Windows */}
              <Section title="Context Windows">
                <label className={styles.label}>
                  Recent chunks used raw (for suggestions): <strong>{draft.recentChunksForSuggestions} chunks</strong>
                  <input
                    id="settings-recent-chunks"
                    className={styles.slider}
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={draft.recentChunksForSuggestions}
                    onChange={(e) => set('recentChunksForSuggestions', Number(e.target.value))}
                  />
                  <div className={styles.sliderLabels}><span>1</span><span>10</span></div>
                  <p className={styles.hint}>Older chunks are compressed into a rolling summary.</p>
                </label>
                <label className={styles.label}>
                  Suggestion context window: <strong>{(draft.suggestionContextWindow / 1000).toFixed(1)}k chars</strong>
                  <input
                    id="settings-suggestion-context"
                    className={styles.slider}
                    type="range"
                    min={500}
                    max={12000}
                    step={500}
                    value={draft.suggestionContextWindow}
                    onChange={(e) => set('suggestionContextWindow', Number(e.target.value))}
                  />
                  <div className={styles.sliderLabels}><span>500</span><span>12k</span></div>
                </label>
                <label className={styles.label}>
                  Chat context window: <strong>{(draft.chatContextWindow / 1000).toFixed(1)}k chars</strong>
                  <input
                    id="settings-chat-context"
                    className={styles.slider}
                    type="range"
                    min={2000}
                    max={50000}
                    step={1000}
                    value={draft.chatContextWindow}
                    onChange={(e) => set('chatContextWindow', Number(e.target.value))}
                  />
                  <div className={styles.sliderLabels}><span>2k</span><span>50k</span></div>
                </label>
              </Section>
            </>
          )}

          {activeTab === 'prompts' && (
            <>
              <Section title="Live Suggestion Prompt">
                <p className={styles.hint}>
                  Variables: <code>{'{recentChunks}'}</code> (raw recent text), <code>{'{summary}'}</code> (compressed older history).
                  Must return JSON with a <code>suggestions</code> array of exactly 3 items.
                </p>
                <textarea
                  id="settings-suggestion-prompt"
                  className={styles.textarea}
                  value={draft.suggestionPrompt}
                  onChange={(e) => set('suggestionPrompt', e.target.value)}
                  rows={12}
                />
              </Section>

              <Section title="Rolling Summary Prompt">
                <p className={styles.hint}>
                  Variable: <code>{'{transcript}'}</code>. Compresses older transcript chunks into a short summary.
                </p>
                <textarea
                  id="settings-summary-prompt"
                  className={styles.textarea}
                  value={draft.summaryPrompt}
                  onChange={(e) => set('summaryPrompt', e.target.value)}
                  rows={6}
                />
              </Section>

              <Section title="Detailed Answer Prompt">
                <p className={styles.hint}>
                  Variables: <code>{'{type}'}</code>, <code>{'{preview}'}</code>, <code>{'{summary}'}</code>, <code>{'{recentTranscript}'}</code>.
                </p>
                <textarea
                  id="settings-detailed-prompt"
                  className={styles.textarea}
                  value={draft.detailedAnswerPrompt}
                  onChange={(e) => set('detailedAnswerPrompt', e.target.value)}
                  rows={9}
                />
              </Section>

              <Section title="Chat System Prompt">
                <p className={styles.hint}>
                  Full transcript and summary are injected automatically. This sets the assistant&apos;s persona and behavior.
                </p>
                <textarea
                  id="settings-chat-prompt"
                  className={styles.textarea}
                  value={draft.chatSystemPrompt}
                  onChange={(e) => set('chatSystemPrompt', e.target.value)}
                  rows={6}
                />
              </Section>

              <Section title="Follow-Up Questions Prompt">
                <p className={styles.hint}>
                  Variables: <code>{'{response}'}</code> (the AI&apos;s answer), <code>{'{summary}'}</code> (meeting summary). Generated after each chat response. Must return JSON: <code>{'{ "questions": ["q1", "q2", "q3"] }'}</code>.
                </p>
                <textarea
                  id="settings-followup-prompt"
                  className={styles.textarea}
                  value={draft.followUpQuestionsPrompt}
                  onChange={(e) => set('followUpQuestionsPrompt', e.target.value)}
                  rows={8}
                />
              </Section>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.resetBtn} onClick={handleReset}>Reset to Defaults</button>
          <button
            className={`${styles.saveBtn} ${saved ? styles.savedBtn : ''}`}
            onClick={handleSave}
          >
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}
