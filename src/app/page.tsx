'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { SettingsModal } from '@/components/SettingsModal';
import { LatencyBar } from '@/components/LatencyBar';
import { SessionSnapshot } from '@/components/SessionSnapshot';
import { ContinuationAssistant } from '@/components/ContinuationAssistant';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useChat } from '@/hooks/useChat';
import { useRollingSummary } from '@/hooks/useRollingSummary';
import { useSessionContinuity } from '@/hooks/useSessionContinuity';
import { useSettings } from '@/context/SettingsContext';
import { Suggestion, LatencyMetrics, DiscussionTopic } from '@/types';
import { exportSession, downloadJson, exportToMarkdown, exportToEmail } from '@/lib/utils';
import { generateMeetingReport, factCheckSegment } from '@/lib/groq';
import styles from './page.module.css';

export default function Home() {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(!settings.groqApiKey);
  const [factCheckMode, setFactCheckMode] = useState(false);
  const [summaryViewOpen, setSummaryViewOpen] = useState(false);
  // Session start time – captured once at mount via lazy useState init.
  // useRef is still used to hold it so it can be mutated on Clear without re-render.
  const [sessionStartTime] = useState<number>(() => Date.now());
  const sessionStartRef = useRef<number>(sessionStartTime);
  const lastFactCheckedId = useRef<string | null>(null);

  // ── Session Continuity ─────────────────────────────────────────────────────
  const {
    currentClientId,
    lastSnapshot,
    continuationQuestions,
    isLoading: snapshotLoading,
    dismissSnapshot,
    saveMeetingData,
  } = useSessionContinuity();

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
    updateSegment,
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

  // ── Session Continuity Handlers ────────────────────────────────────────────
  const handleResumeWithTopic = useCallback(
    (topic: DiscussionTopic | string) => {
      const topicStr = typeof topic === 'string' ? topic : topic.topic;
      const message = `Continue discussion on: ${topicStr}`;
      sendMessage(message, segments, summary);
      dismissSnapshot();
    },
    [segments, summary, sendMessage, dismissSnapshot]
  );

  const handleResumeTopic = useCallback(
    (question: string) => {
      sendMessage(question, segments, summary);
      dismissSnapshot();
    },
    [segments, summary, sendMessage, dismissSnapshot]
  );

  const handleStopRecording = useCallback(async () => {
    stopRecording();

    // Save meeting data if we have a client selected
    if (currentClientId && lastSnapshot) {
      try {
        // Generate a final report
        const fullTranscript = segments.map((s) => s.text).join('\n');
        const report = await generateMeetingReport(
          fullTranscript,
          settings.reportPrompt,
          settings.groqApiKey,
          settings.llmModel
        );

        // Save the meeting data for next time
        await saveMeetingData(fullTranscript, summary, report);
      } catch (err) {
        console.error('Failed to save meeting data:', err);
      }
    }
  }, [
    stopRecording,
    currentClientId,
    lastSnapshot,
    segments,
    summary,
    settings,
    saveMeetingData,
  ]);

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
    downloadJson(data, `convoiq-session-${ts}.json`);
  };

  const handleExportMarkdown = () => {
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
    exportToMarkdown(data);
  };

  const handleExportEmail = () => {
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
    window.location.href = exportToEmail(data);
  };

  const handleGenerateReport = async () => {
    if (segments.length === 0) return;
    const fullTranscript = segments.map(s => s.text).join('\n');
    try {
      const report = await generateMeetingReport(
        fullTranscript,
        settings.reportPrompt,
        settings.groqApiKey,
        settings.llmModel
      );
      
      // Build a formatted markdown report and send it directly to chat
      const reportMd = [
        '# 📊 Meeting Intelligence Report',
        '## Key Points',
        ...report.keyPoints.map(p => `- ${p}`),
        '',
        '## Decisions Made',
        ...report.decisions.map(d => `- ${d}`),
        '',
        '## Action Items',
        ...report.actionItems.map(a => `- **[${a.owner || 'Unassigned'}]** ${a.task}${a.deadline ? ` (Due: ${a.deadline})` : ''}`),
        '',
        '## Open Questions',
        ...report.openQuestions.map(q => `- ${q}`),
        '',
        '## Risks',
        ...report.risks.map(r => `- ${r}`)
      ].join('\n');

      // Send the pre-generated report as the chat message so users see it immediately
      handleSendMessage(reportMd);
    } catch (err) {
      console.error(err);
    }
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

  // ── Fact-Check Auto-Trigger ──────────────────────────────────────────────
  useEffect(() => {
    if (!factCheckMode || segments.length === 0) return;
    
    const latestSeg = segments[segments.length - 1];
    if (latestSeg.id !== lastFactCheckedId.current && !latestSeg.factChecks) {
      lastFactCheckedId.current = latestSeg.id;
      
      (async () => {
        try {
          const checks = await factCheckSegment(
            latestSeg.text,
            settings.factCheckPrompt,
            settings.groqApiKey,
            settings.llmModel
          );
          if (checks.length > 0) {
            updateSegment(latestSeg.id, { factChecks: checks });
          }
        } catch (err) {
          console.error('Auto fact-check failed:', err);
        }
      })();
    }
  }, [segments, factCheckMode, settings, updateSegment]);

  return (
    <>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className={styles.layout}>
        {/* ── Top Bar ────────────────────────────────────────────────────── */}
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <span className={styles.brandLogo}>🧠</span>
            <span className={styles.brandName}>ConvoIQ</span>
            <span className={styles.brandTag}>Live Copilot</span>
          </div>
          <div className={styles.topActions}>
            <button
              id="generate-report-btn"
              className={styles.actionBtn}
              onClick={handleGenerateReport}
              title="Generate full meeting report (Summary, Decisions, Action Items)"
              aria-label="Generate meeting report"
              disabled={segments.length === 0}
            >
              📊 Report
            </button>
            <div className={styles.exportGroup}>
              <button
                id="export-json-btn"
                className={styles.actionBtn}
                onClick={handleExport}
                title="Export as JSON"
                aria-label="Export JSON"
              >
                {/* icon for download */}
                <span className={styles.btnIcon}>📥</span> JSON
              </button>
              <button
                id="export-md-btn"
                className={styles.actionBtn}
                onClick={handleExportMarkdown}
                title="Export as Markdown"
                aria-label="Export Markdown"
              >
                <span className={styles.btnIcon}>📝</span> MD
              </button>
              <button
                id="export-email-btn"
                className={styles.actionBtn}
                onClick={handleExportEmail}
                title="Export as Email draft"
                aria-label="Export Email"
              >
                <span className={styles.btnIcon}>✉️</span> Draft
              </button>
            </div>
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
        {lastSnapshot && !summaryViewOpen && (
          <SessionSnapshot
            snapshot={lastSnapshot}
            continuationQuestions={continuationQuestions}
            isLoading={snapshotLoading}
            onViewSummary={() => setSummaryViewOpen(true)}
            onResumeTopic={handleResumeTopic}
            onDismiss={dismissSnapshot}
          />
        )}

        <main className={styles.columns}>
          <div className={styles.col}>
            <TranscriptPanel
              segments={segments}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              pendingChunks={pendingChunks}
              recordingDurationSec={recordingDurationSec}
              onStart={startRecording}
              onStop={handleStopRecording}
              onRefresh={handleManualRefresh}
              onAddDemo={handleDemoSegment}
              error={recorderError}
              factCheckMode={factCheckMode}
              onToggleFactCheck={() => setFactCheckMode(v => !v)}
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

      {/* ── Session Continuity Assistant Modal ──────────────────────────── */}
      {lastSnapshot && (
        <ContinuationAssistant
          snapshot={lastSnapshot}
          isOpen={summaryViewOpen}
          onClose={() => setSummaryViewOpen(false)}
          onSelectTopic={handleResumeWithTopic}
        />
      )}
    </>
  );
}
