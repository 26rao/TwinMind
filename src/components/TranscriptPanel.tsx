'use client';

import { useEffect, useRef, useState } from 'react';
import { TranscriptSegment } from '@/types';
import { DEMO_SCENARIOS } from '@/lib/defaults';
import { formatTimestamp, formatDuration } from '@/lib/utils';
import styles from './TranscriptPanel.module.css';

interface Props {
  segments: TranscriptSegment[];
  isRecording: boolean;
  isTranscribing: boolean;
  pendingChunks: number;
  recordingDurationSec: number;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  onAddDemo: (text: string) => void;
  error: string | null;
}

export function TranscriptPanel({
  segments,
  isRecording,
  isTranscribing,
  pendingChunks,
  recordingDurationSec,
  onStart,
  onStop,
  onRefresh,
  onAddDemo,
  error,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [demoText, setDemoText] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [injectingIdx, setInjectingIdx] = useState<number | null>(null);

  // Auto-scroll to latest segment
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  const handleDemoSubmit = () => {
    if (demoText.trim()) {
      onAddDemo(demoText.trim());
      setDemoText('');
    }
  };

  // Load a scenario: inject its chunks one by one with a small delay
  const handleLoadScenario = async (scenarioId: string) => {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;

    setActiveScenarioId(scenarioId);
    setInjectingIdx(0);

    for (let i = 0; i < scenario.chunks.length; i++) {
      setInjectingIdx(i);
      onAddDemo(scenario.chunks[i]);
      if (i < scenario.chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 400)); // slight delay for visual effect
      }
    }
    setInjectingIdx(null);
  };

  const isInjecting = injectingIdx !== null;

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.icon}>🎙️</span>
          <h2 className={styles.title}>Transcript</h2>
          {isRecording && (
            <span className={styles.livePill}>
              <span className={styles.liveDot} />
              {formatDuration(recordingDurationSec)}
            </span>
          )}
        </div>

        <div className={styles.controls}>
          <button
            id="mic-toggle-btn"
            className={`${styles.micBtn} ${isRecording ? styles.micBtnStop : styles.micBtnStart}`}
            onClick={isRecording ? onStop : onStart}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? '⏹ Stop' : '● Start'}
          </button>
          <button
            id="transcript-refresh-btn"
            className={styles.iconBtn}
            onClick={onRefresh}
            title="Manual refresh: finalize chunk + generate suggestions"
            aria-label="Refresh transcript and suggestions"
            disabled={segments.length === 0}
          >
            ↻
          </button>
          <button
            id="demo-mode-btn"
            className={`${styles.iconBtn} ${showDemo ? styles.iconBtnActive : ''}`}
            onClick={() => setShowDemo((v) => !v)}
            title="Demo mode: inject sample transcripts"
            aria-label="Toggle demo mode"
          >
            📝
          </button>
        </div>

        {/* Demo mode panel */}
        {showDemo && (
          <div className={styles.demoArea}>
            {/* Quick-load scenario buttons */}
            <div className={styles.scenarioRow}>
              <span className={styles.scenarioLabel}>Quick scenarios:</span>
              <div className={styles.scenarioBtns}>
                {DEMO_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    id={`demo-scenario-${scenario.id}`}
                    className={`${styles.scenarioBtn} ${activeScenarioId === scenario.id ? styles.scenarioBtnActive : ''}`}
                    onClick={() => handleLoadScenario(scenario.id)}
                    disabled={isInjecting}
                    title={scenario.label}
                    aria-label={`Load ${scenario.label} demo`}
                  >
                    {scenario.emoji} {scenario.label}
                    {activeScenarioId === scenario.id && isInjecting && (
                      <span className={styles.injectingDot} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual text input */}
            <textarea
              className={styles.demoInput}
              value={demoText}
              onChange={(e) => setDemoText(e.target.value)}
              placeholder="Or type/paste your own transcript chunk here…"
              rows={3}
              aria-label="Custom demo transcript input"
            />
            <button
              id="demo-submit-btn"
              className={styles.demoSubmitBtn}
              onClick={handleDemoSubmit}
              disabled={!demoText.trim()}
            >
              ＋ Add Chunk
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.scrollArea}>
        {segments.length === 0 && !isRecording && !showDemo && (
          <div className={styles.emptyState}>
            <p>Click <strong>● Start</strong> to begin recording your meeting.</p>
            <p className={styles.emptyHint}>📝 Demo mode lets you inject sample conversations instantly.</p>
            <p className={styles.emptyHint}>Transcription chunks automatically every 30 seconds.</p>
          </div>
        )}

        {segments.map((seg) => (
          <div key={seg.id} className={styles.segment}>
            <div className={styles.segMeta}>
              <span className={styles.chunkBadge}>#{seg.chunkIndex + 1}</span>
              <span className={styles.time}>{formatTimestamp(seg.timestamp)}</span>
            </div>
            <p className={styles.text}>{seg.text}</p>
          </div>
        ))}

        {/* Transcribing indicator */}
        {(isTranscribing || pendingChunks > 0) && (
          <div className={styles.transcribingIndicator}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.transcribingLabel}>
              {pendingChunks > 1 ? `Transcribing ${pendingChunks} chunks…` : 'Transcribing…'}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
