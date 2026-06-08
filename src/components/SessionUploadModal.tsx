'use client';

import { useState, useRef, useCallback } from 'react';
import { SessionExport } from '@/types';
import styles from './SessionUploadModal.module.css';

interface Props {
  isOpen:   boolean;
  userName: string;
  onClose:  () => void;
  onLoad:   (session: SessionExport, fileName: string) => void;
  onSkip:   () => void;
}

/**
 * Normalise ANY JSON object into a SessionExport.
 *
 * Accepts:
 *  - Files exported by ConvoIQ (meeting_report_YYYY-MM-DD.json)
 *  - Manually crafted JSON — as long as it has at least one of:
 *      { transcript, summary, text, content, notes, rollingSummary, chatHistory }
 *
 * Everything is optional — the function fills in sensible defaults for
 * missing fields so the AI gets whatever context exists.
 */
function normaliseToSessionExport(raw: Record<string, unknown>): SessionExport {
  // ── transcript ────────────────────────────────────────────────────────────
  let transcript: SessionExport['transcript'] = [];

  if (Array.isArray(raw.transcript)) {
    // Already in ConvoIQ format
    transcript = (raw.transcript as Array<Record<string, unknown>>).map((t, i) => ({
      chunkIndex: typeof t.chunkIndex === 'number' ? t.chunkIndex : i,
      timestamp:  typeof t.timestamp === 'string' ? t.timestamp : new Date().toISOString(),
      text:       typeof t.text === 'string' ? t.text : String(t),
    }));
  } else if (typeof raw.transcript === 'string' && raw.transcript.trim()) {
    // Flat string transcript → split by sentence / paragraph
    transcript = raw.transcript
      .split(/\n{2,}|(?<=\.)\s+/)
      .filter(Boolean)
      .map((text, i) => ({ chunkIndex: i, timestamp: new Date().toISOString(), text: text.trim() }));
  } else if (typeof raw.text === 'string' && raw.text.trim()) {
    transcript = raw.text
      .split(/\n{2,}|(?<=\.)\s+/)
      .filter(Boolean)
      .map((text, i) => ({ chunkIndex: i, timestamp: new Date().toISOString(), text: text.trim() }));
  } else if (typeof raw.content === 'string' && raw.content.trim()) {
    transcript = [{ chunkIndex: 0, timestamp: new Date().toISOString(), text: raw.content.trim() }];
  } else if (typeof raw.notes === 'string' && raw.notes.trim()) {
    transcript = [{ chunkIndex: 0, timestamp: new Date().toISOString(), text: raw.notes.trim() }];
  }

  // ── rolling summary ───────────────────────────────────────────────────────
  const rollingSummary =
    (typeof raw.rollingSummary === 'string' && raw.rollingSummary) ||
    (typeof raw.summary        === 'string' && raw.summary)        ||
    (typeof raw.description    === 'string' && raw.description)    ||
    '';

  // ── chat history ──────────────────────────────────────────────────────────
  const chatHistory: SessionExport['chatHistory'] = Array.isArray(raw.chatHistory)
    ? (raw.chatHistory as Array<Record<string, unknown>>).map(m => ({
        role:      (m.role === 'user' || m.role === 'assistant') ? m.role : 'user',
        content:   typeof m.content === 'string' ? m.content : String(m),
        timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date().toISOString(),
        latencyMs: typeof m.latencyMs === 'number' ? m.latencyMs : undefined,
      }))
    : [];

  // ── suggestion batches ────────────────────────────────────────────────────
  const suggestionBatches: SessionExport['suggestionBatches'] = Array.isArray(raw.suggestionBatches)
    ? raw.suggestionBatches as SessionExport['suggestionBatches']
    : [];

  return {
    exportedAt:            typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    sessionDurationSeconds: typeof raw.sessionDurationSeconds === 'number' ? raw.sessionDurationSeconds : 0,
    latencyMetrics: {
      lastSuggestionLatencyMs: null,
      lastChatFirstTokenMs:    null,
      avgSuggestionLatencyMs:  null,
    },
    transcript,
    rollingSummary,
    suggestionBatches,
    chatHistory,
  };
}

/** Returns true if the JSON has at least some usable context */
function hasUsableContent(raw: Record<string, unknown>): boolean {
  if (Array.isArray(raw.transcript) && (raw.transcript as unknown[]).length > 0) return true;
  if (typeof raw.transcript   === 'string' && raw.transcript.trim())   return true;
  if (typeof raw.text         === 'string' && raw.text.trim())         return true;
  if (typeof raw.content      === 'string' && raw.content.trim())      return true;
  if (typeof raw.notes        === 'string' && raw.notes.trim())        return true;
  if (typeof raw.summary      === 'string' && raw.summary.trim())      return true;
  if (typeof raw.rollingSummary === 'string' && raw.rollingSummary.trim()) return true;
  if (Array.isArray(raw.chatHistory) && (raw.chatHistory as unknown[]).length > 0) return true;
  return false;
}

export function SessionUploadModal({ isOpen, userName, onClose, onLoad, onSkip }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error,      setError]      = useState('');
  const [loaded,     setLoaded]     = useState<{ name: string; session: SessionExport } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Record<string, unknown>;

        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
          throw new Error('File must be a JSON object.');
        }

        if (!hasUsableContent(raw)) {
          setError('No usable content found. JSON needs at least one of: transcript, text, content, notes, summary, rollingSummary, or chatHistory.');
          return;
        }

        const session = normaliseToSessionExport(raw);
        setLoaded({ name: file.name, session });
        setError('');
      } catch (err) {
        if (err instanceof SyntaxError) {
          setError('Could not parse file — make sure it is valid JSON.');
        } else {
          setError((err as Error).message ?? 'Unknown error reading file.');
        }
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    // Reset input so same file can be re-selected after clearing
    e.target.value = '';
  }, [parseFile]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.header}>
          <span className={styles.icon}>📂</span>
          <div>
            <h2 className={styles.title}>Load Previous Session</h2>
            <p className={styles.sub}>Welcome back, {userName}! Continue where you left off.</p>
          </div>
        </div>

        {/* Drop zone */}
        {!loaded && (
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
            <span className={styles.dropIcon}>⬆</span>
            <p className={styles.dropText}>
              Drop any <code>.json</code> file here<br />
              <span className={styles.dropHint}>ConvoIQ export or your own notes — or click to browse</span>
            </p>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {/* Loaded preview */}
        {loaded && (
          <div className={styles.preview}>
            <div className={styles.previewIcon}>✅</div>
            <div className={styles.previewInfo}>
              <p className={styles.previewName}>{loaded.name}</p>
              <p className={styles.previewMeta}>
                {loaded.session.transcript.length} transcript chunk{loaded.session.transcript.length !== 1 ? 's' : ''}
                {loaded.session.rollingSummary ? ' · Summary included' : ''}
                {loaded.session.chatHistory.length > 0 ? ` · ${loaded.session.chatHistory.length} chat messages` : ''}
                {loaded.session.exportedAt !== new Date().toISOString().slice(0, 20) + loaded.session.exportedAt.slice(20)
                  ? ''
                  : ''}
              </p>
            </div>
            <button
              className={styles.clearBtn}
              onClick={() => setLoaded(null)}
              aria-label="Remove file"
            >✕</button>
          </div>
        )}

        <div className={styles.actions}>
          {loaded && (
            <button
              className={styles.loadBtn}
              onClick={() => onLoad(loaded.session, loaded.name)}
            >
              Load Context &amp; Start →
            </button>
          )}
          <button className={styles.skipBtn} onClick={onSkip}>
            Start Fresh Session
          </button>
        </div>
      </div>
    </div>
  );
}
