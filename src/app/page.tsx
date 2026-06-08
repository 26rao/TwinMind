'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptPanel }        from '@/components/TranscriptPanel';
import { SuggestionsPanel }       from '@/components/SuggestionsPanel';
import { ChatPanel }              from '@/components/ChatPanel';
import { SettingsModal }          from '@/components/SettingsModal';
import { SessionHeader }          from '@/components/SessionHeader';
import { SessionBanner }          from '@/components/SessionBanner';
import { PerformanceMetrics }     from '@/components/PerformanceMetrics';
import { ContinuationAssistant }  from '@/components/ContinuationAssistant';
import { LoginScreen }            from '@/components/LoginScreen';
import { SessionUploadModal }     from '@/components/SessionUploadModal';
import { useAudioRecorder }       from '@/hooks/useAudioRecorder';
import { useSuggestions }         from '@/hooks/useSuggestions';
import { useChat }                from '@/hooks/useChat';
import { useRollingSummary }      from '@/hooks/useRollingSummary';
import { useSessionContinuity }   from '@/hooks/useSessionContinuity';
import { useSettings }            from '@/context/SettingsContext';
import { Suggestion, LatencyMetrics, DiscussionTopic, SessionExport } from '@/types';
import {
  exportSession, downloadJson,
  exportToMarkdown, exportToEmail, exportToPDF,
} from '@/lib/utils';
import { generateMeetingReport, factCheckSegment } from '@/lib/groq';
import styles from './page.module.css';

const USER_STORAGE_KEY = 'convoiq_user_v1';

export default function Home() {
  const { settings } = useSettings();

  /* ── Auth state ───────────────────────────────────────────────────────── */
  const [userName, setUserName] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    setUserName(stored);
    setAuthChecked(true);
  }, []);

  const handleLogin = useCallback((name: string) => {
    localStorage.setItem(USER_STORAGE_KEY, name);
    setUserName(name);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUserName(null);
    uploadShownRef.current = false;
  }, []);


  /* ── Upload previous session modal ────────────────────────────────────── */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadedContext, setUploadedContext] = useState<SessionExport | null>(null);

  // Open upload modal once on first login
  const uploadShownRef = useRef(false);
  useEffect(() => {
    if (userName && !uploadShownRef.current) {
      uploadShownRef.current = true;
      setUploadOpen(true);
    }
  }, [userName]);

  const handleLoadSession = useCallback((session: SessionExport) => {
    setUploadedContext(session);
    setUploadOpen(false);
  }, []);

  /* ── Settings modal ───────────────────────────────────────────────────── */
  const [settingsManuallyOpen, setSettingsManuallyOpen] = useState(false);
  const [settingsDismissed,    setSettingsDismissed]    = useState(false);
  const settingsOpen  = settingsManuallyOpen || (!settings.groqApiKey && !settingsDismissed);
  const closeSettings = useCallback(() => { setSettingsManuallyOpen(false); setSettingsDismissed(true); }, []);
  const openSettings  = useCallback(() => { setSettingsDismissed(false); setSettingsManuallyOpen(true); }, []);

  /* ── Misc UI state ────────────────────────────────────────────────────── */
  const [factCheckMode,     setFactCheckMode]    = useState(false);
  const [summaryViewOpen,   setSummaryViewOpen]  = useState(false);
  const [activePriority,    setActivePriority]   = useState<'high' | 'medium' | 'insights'>('high');
  const [activeContextPill, setActiveContextPill] = useState<string | null>(null);

  const sessionStartRef    = useRef<number>(Date.now());
  const lastFactCheckedId  = useRef<string | null>(null);

  /* ── Session continuity ───────────────────────────────────────────────── */
  const {
    currentClientId, lastSnapshot,
    dismissSnapshot, saveMeetingData,
  } = useSessionContinuity();

  /* ── Audio / transcription ────────────────────────────────────────────── */
  const {
    isRecording, segments, recordingDurationSec,
    startRecording, stopRecording,
    addDemoSegment, clearTranscript,
    error: recorderError, isTranscribing, pendingChunks, updateSegment,
  } = useAudioRecorder();

  /* ── Rolling summary ──────────────────────────────────────────────────── */
  const { summary, getRecentChunksText, updateSummary, seedSummary, clearSummary } = useRollingSummary();

  /* ── Inject uploaded context into both rolling summary and chat ─────────── */
  useEffect(() => {
    if (!uploadedContext) return;

    // 1. Seed the rolling summary so ALL suggestion tiers see the prior session
    if (uploadedContext.rollingSummary) {
      const priorTranscriptExcerpt = uploadedContext.transcript
        .slice(-5)
        .map(t => t.text)
        .join('\n');
      const seededSummary = [
        '[PRIOR SESSION CONTEXT]',
        uploadedContext.rollingSummary,
        priorTranscriptExcerpt ? `\nLast discussed:\n${priorTranscriptExcerpt}` : '',
      ].join('\n');
      seedSummary(seededSummary);

      // 2. Also inform the chat copilot about the prior session
      sendMessage(
        `[Previous session context loaded]\n\nSummary: ${uploadedContext.rollingSummary}\n\nTranscript excerpt:\n${priorTranscriptExcerpt}`,
        [], seededSummary,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedContext]);

  /* ── Suggestions ──────────────────────────────────────────────────────── */
  const {
    tierBatches, tierLoading, isLoading: suggestionsLoading,
    error: suggestionsError, latencyMetrics: suggestionLatency,
    refresh: refreshSuggestions, clearBatches,
  } = useSuggestions(segments, isRecording, summary, getRecentChunksText);

  // Map lowercase page state → uppercase SuggestionTier
  const activeTier = activePriority.toUpperCase() as 'HIGH' | 'MEDIUM' | 'INSIGHTS';

  /* ── Chat ─────────────────────────────────────────────────────────────── */
  const {
    messages, isStreaming, error: chatError,
    latencyMetrics: chatLatency, sendMessage, expandSuggestion, clearChat,
  } = useChat();

  /* ── Export helpers ───────────────────────────────────────────────────── */
  const buildLatency = (): LatencyMetrics => ({
    lastSuggestionLatencyMs: suggestionLatency.lastSuggestionLatencyMs,
    lastChatFirstTokenMs:    chatLatency.lastChatFirstTokenMs,
    avgSuggestionLatencyMs:  suggestionLatency.avgSuggestionLatencyMs,
  });

  const buildExport = () =>
    exportSession(segments, tierBatches.HIGH, messages, summary, buildLatency(), sessionStartRef.current);

  const sessionDateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const handleExportJSON = useCallback(() => {
    if (segments.length === 0) { alert('Nothing to export yet — start recording first.'); return; }
    downloadJson(buildExport(), `meeting_report_${sessionDateStr}.json`);
  }, [segments, tierBatches, messages, summary, suggestionLatency, chatLatency]); // eslint-disable-line

  const handleExportMarkdown = useCallback(() => {
    if (segments.length === 0) { alert('Nothing to export yet — start recording first.'); return; }
    exportToMarkdown(buildExport());
  }, [segments, tierBatches, messages, summary, suggestionLatency, chatLatency]); // eslint-disable-line

  const handleExportPDF = useCallback(() => {
    if (segments.length === 0) { alert('Nothing to export yet — start recording first.'); return; }
    exportToPDF(buildExport());
  }, [segments, tierBatches, messages, summary, suggestionLatency, chatLatency]); // eslint-disable-line


  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleManualRefresh = useCallback(async () => {
    await updateSummary(segments);
    await refreshSuggestions(segments, summary, getRecentChunksText(segments));
  }, [segments, summary, updateSummary, getRecentChunksText, refreshSuggestions]);

  const handleSuggestionClick = useCallback(
    (s: Suggestion) => expandSuggestion(s, segments, summary),
    [expandSuggestion, segments, summary],
  );

  const handleSendMessage = useCallback(
    (text: string) => sendMessage(text, segments, summary),
    [sendMessage, segments, summary],
  );

  const handleResumeWithTopic = useCallback(
    (topic: DiscussionTopic | string) => {
      const t = typeof topic === 'string' ? topic : topic.topic;
      sendMessage(`Continue discussion on: ${t}`, segments, summary);
      dismissSnapshot();
    },
    [segments, summary, sendMessage, dismissSnapshot],
  );

  const handleStopRecording = useCallback(async () => {
    stopRecording();
    if (currentClientId && lastSnapshot) {
      try {
        const txt = segments.map(s => s.text).join('\n');
        const report = await generateMeetingReport(txt, settings.reportPrompt, settings.groqApiKey, settings.llmModel);
        await saveMeetingData(txt, summary, report);
      } catch (err) { console.error('Save meeting:', err); }
    }
  }, [stopRecording, currentClientId, lastSnapshot, segments, summary, settings, saveMeetingData]);

  const handleContextPill = useCallback((pill: string) => {
    setActiveContextPill(pill);
    const prompts: Record<string, string> = {
      Summary:          'Give me a concise bullet-point summary of the meeting so far.',
      Risks:            'What are the top risks or blockers identified in this meeting?',
      'Action Items':   'List all action items with owners and deadlines from this meeting.',
      'Open Questions': 'What questions are still unresolved from this meeting?',
      'Key Metrics':    'What key numbers, KPIs, or metrics were mentioned?',
    };
    if (prompts[pill]) sendMessage(prompts[pill], segments, summary);
  }, [sendMessage, segments, summary]);

  const handleClearSession = () => {
    clearTranscript(); clearBatches(); clearChat(); clearSummary();
    sessionStartRef.current = Date.now();
  };

  /* ── Auto fact-check ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!factCheckMode || segments.length === 0) return;
    const seg = segments[segments.length - 1];
    if (seg.id !== lastFactCheckedId.current && !seg.factChecks) {
      lastFactCheckedId.current = seg.id;
      (async () => {
        try {
          const checks = await factCheckSegment(seg.text, settings.factCheckPrompt, settings.groqApiKey, settings.llmModel);
          if (checks.length > 0) updateSegment(seg.id, { factChecks: checks });
        } catch (err) { console.error('Fact-check:', err); }
      })();
    }
  }, [segments, factCheckMode, settings, updateSegment]);

  /* ── Gate: wait for localStorage read, then show login if no user ─────── */
  if (!authChecked) return null;   // prevent flash
  if (!userName) {
    return <LoginScreen onLogin={handleLogin} />;
  }


  /* ── Render dashboard ─────────────────────────────────────────────────── */
  return (
    <>
      <SettingsModal isOpen={settingsOpen} onClose={closeSettings} />

      <SessionUploadModal
        isOpen={uploadOpen}
        userName={userName}
        onClose={() => setUploadOpen(false)}
        onLoad={handleLoadSession}
        onSkip={() => setUploadOpen(false)}
      />

      <div className={styles.dashboardContainer}>

        {/* ROW 1 — Header */}
        <div className={styles.headerWrapper}>
          <SessionHeader
            isRecording={isRecording}
            recordingDurationSec={recordingDurationSec}
            userName={userName}
            onStartRecording={startRecording}
            onStopRecording={handleStopRecording}
            onSettings={openSettings}
            onExportJSON={handleExportJSON}
            onExportMarkdown={handleExportMarkdown}
            onExportPDF={handleExportPDF}
            onLogout={handleLogout}
          />
        </div>

        {/* ROW 2 — Session Banner */}
        {lastSnapshot && !summaryViewOpen && (
          <div className={styles.bannerWrapper}>
            <SessionBanner
              clientName={currentClientId || undefined}
              unresolvedDecisions={lastSnapshot.unresolvedDecisions?.length || 0}
              pendingActions={lastSnapshot.pendingTasks?.length || 0}
              risks={lastSnapshot.risks?.length || 0}
              onResume={() => setSummaryViewOpen(true)}
              onViewSummary={() => setSummaryViewOpen(true)}
              isVisible={true}
            />
          </div>
        )}

        {/* ── COLUMN 1 — LIVE FEED ──────────────────────────────────────── */}
        <div className={styles.liveFeedColumn}>
          <div className={styles.liveFeedHeader}>
            <h2 className={styles.liveFeedTitle}>Live Feed</h2>
            {isRecording && <span className={styles.recBadge}>● REC</span>}
          </div>
          <div className={styles.liveFeedContent}>
            <TranscriptPanel
              segments={segments}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              pendingChunks={pendingChunks}
              recordingDurationSec={recordingDurationSec}
              onStart={startRecording}
              onStop={handleStopRecording}
              onRefresh={handleManualRefresh}
              onAddDemo={addDemoSegment}
              error={recorderError}
              factCheckMode={factCheckMode}
              onToggleFactCheck={() => setFactCheckMode(v => !v)}
            />
          </div>
        </div>

        {/* ── COLUMN 2 — INTELLIGENCE CENTER ───────────────────────────── */}
        <div className={styles.intelligenceColumn}>
          <div className={styles.intelligenceHeader}>
            <h2 className={styles.intelligenceTitle}>Intelligence</h2>
            <div className={styles.intelligencePriorities}>
              {(['high', 'medium', 'insights'] as const).map(p => (
                <button
                  key={p}
                  className={`${styles.priorityTab} ${activePriority === p ? styles.active : ''}`}
                  onClick={() => setActivePriority(p)}
                >
                  {p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Insights'}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.intelligenceContent}>
            <SuggestionsPanel
              batches={tierBatches[activeTier]}
              isLoading={tierLoading[activeTier]}
              error={suggestionsError}
              activeTier={activeTier}
              onSuggestionClick={handleSuggestionClick}
              onRefresh={handleManualRefresh}
            />
          </div>
        </div>

        {/* ── COLUMN 3 — AI COPILOT ─────────────────────────────────────── */}
        <div className={styles.copilotColumn}>
          <div className={styles.copilotHeader}>
            <h2 className={styles.copilotTitle}>AI Copilot</h2>
          </div>
          <div className={styles.copilotContent}>
            <div className={styles.quickContextPills}>
              {['Summary', 'Risks', 'Action Items', 'Open Questions', 'Key Metrics'].map(pill => (
                <button
                  key={pill}
                  className={`${styles.quickContextPill} ${activeContextPill === pill ? styles.activePill : ''}`}
                  onClick={() => handleContextPill(pill)}
                >
                  {pill}
                </button>
              ))}
            </div>
            <div className={styles.copilotChatArea}>
              <ChatPanel
                messages={messages}
                isStreaming={isStreaming}
                error={chatError}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        </div>

        {/* ROW 4 — Footer metrics */}
        <div className={styles.footerWrapper}>
          <PerformanceMetrics
            whisperLatency={segments.length > 0 ? segments[segments.length - 1].latency || 0 : 0}
            factCheckLatency={250}
            chatLatency={chatLatency.lastChatFirstTokenMs || 0}
            tokenThroughput={218}
            engineModel={settings.llmModel || 'GPT-OSS 120B'}
          />
        </div>
      </div>

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
