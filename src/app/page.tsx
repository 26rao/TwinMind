'use client';

import { useState, useCallback, useRef } from 'react';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { SettingsModal } from '@/components/SettingsModal';
import { LatencyBar } from '@/components/LatencyBar';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useChat } from '@/hooks/useChat';
import { useRollingSummary } from '@/hooks/useRollingSummary';
import { useSettings } from '@/context/SettingsContext';
import { Suggestion, LatencyMetrics } from '@/types';
import { exportSession, downloadJson } from '@/lib/utils';
import styles from './page.module.css';

export default function Home() {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(!settings.groqApiKey);
  const sessionStartRef = useRef(Date.now());

  // ── Core hooks ────────────────────────────────────────────────────────────
  const {
    isRecording,
    segments,
    recordingDurationSec,
    startRecording,
    stopRecording,
    addDemoSegment,
    clearTranscript,
    error: recorderError,
    isTranscribing,
    pendingChunks,
  } = useAudioRecorder();

  const { summary, getRecentChunksText, updateSummary, isSummarizing, clearSummary } =
    useRollingSummary();

  const {
    batches,
    isLoading: suggestionsLoading,
    error: suggestionsError,
    latencyMetrics: suggestionLatency,
    refresh: refreshSuggestions,
    clearBatches,
  } = useSuggestions(segments, isRecording, summary, getRecentChunksText);

  const {
    messages,
    isStreaming,
    error: chatError,
    latencyMetrics: chatLatency,
    sendMessage,
    expandSuggestion,
    clearChat,
  } = useChat();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleManualRefresh = useCallback(async () => {
    // 1. Trigger rolling summary update for older chunks
    await updateSummary(segments);
    // 2. Then generate new suggestions with fresh context
    const recentText = getRecentChunksText(segments);
    await refreshSuggestions(segments, summary, recentText);
  }, [segments, summary, updateSummary, getRecentChunksText, refreshSuggestions]);

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      expandSuggestion(suggestion, segments, summary);
    },
    [expandSuggestion, segments, summary]
  );

  const handleSendMessage = useCallback(
    (text: string) => {
      sendMessage(text, segments, summary);
    },
    [sendMessage, segments, summary]
  );

  const handleDemoSegment = useCallback(
    (text: string) => {
      addDemoSegment(text);
    },
    [addDemoSegment]
  );

  const handleExport = () => {
    const combinedLatency: LatencyMetrics = {
      lastSuggestionLatencyMs: suggestionLatency.lastSuggestionLatencyMs,
      lastChatFirstTokenMs: chatLatency.lastChatFirstTokenMs,
      avgSuggestionLatencyMs: suggestionLatency.avgSuggestionLatencyMs,
    };
    const data = exportSession(
      segments,
      batches,
      messages,
      summary,
      combinedLatency,
      sessionStartRef.current
    );
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(data, `twinmind-session-${ts}.json`);
  };

  const handleClearSession = () => {
    clearTranscript();
    clearBatches();
    clearChat();
    clearSummary();
    sessionStartRef.current = Date.now();
  };

  const combinedMetrics: LatencyMetrics = {
    lastSuggestionLatencyMs: suggestionLatency.lastSuggestionLatencyMs,
    lastChatFirstTokenMs: chatLatency.lastChatFirstTokenMs,
    avgSuggestionLatencyMs: suggestionLatency.avgSuggestionLatencyMs,
  };

  return (
    <>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className={styles.layout}>
        {/* ── Top Bar ────────────────────────────────────────────────────── */}
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <span className={styles.brandLogo}>🧠</span>
            <span className={styles.brandName}>TwinMind</span>
            <span className={styles.brandTag}>Live Copilot</span>
          </div>
          <div className={styles.topActions}>
            <button
              id="export-btn"
              className={styles.actionBtn}
              onClick={handleExport}
              title="Export full session (transcript + suggestions + chat) as JSON"
              aria-label="Export session"
            >
              ↓ Export
            </button>
            <button
              id="clear-session-btn"
              className={styles.actionBtn}
              onClick={handleClearSession}
              title="Clear all session data"
              aria-label="Clear session data"
            >
              ✕ Clear
            </button>
            <button
              id="settings-btn"
              className={`${styles.actionBtn} ${styles.settingsBtn} ${!settings.groqApiKey ? styles.settingsBtnAlert : ''}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
            >
              ⚙ Settings
              {!settings.groqApiKey && <span className={styles.alertDot} />}
            </button>
          </div>
        </header>

        {/* ── 3-Column Layout ────────────────────────────────────────────── */}
        <main className={styles.columns}>
          <div className={styles.col}>
            <TranscriptPanel
              segments={segments}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              pendingChunks={pendingChunks}
              recordingDurationSec={recordingDurationSec}
              onStart={startRecording}
              onStop={stopRecording}
              onRefresh={handleManualRefresh}
              onAddDemo={handleDemoSegment}
              error={recorderError}
            />
          </div>
          <div className={styles.col}>
            <SuggestionsPanel
              batches={batches}
              isLoading={suggestionsLoading}
              error={suggestionsError}
              onSuggestionClick={handleSuggestionClick}
              onRefresh={handleManualRefresh}
            />
          </div>
          <div className={styles.col}>
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              error={chatError}
              onSendMessage={handleSendMessage}
            />
          </div>
        </main>

        {/* ── Latency Bar ────────────────────────────────────────────────── */}
        <LatencyBar metrics={combinedMetrics} isSummarizing={isSummarizing} />
      </div>
    </>
  );
}
