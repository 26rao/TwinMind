'use client';

import { useState, useRef, FC } from 'react';
import styles from './SessionHeader.module.css';

interface SessionHeaderProps {
  isRecording: boolean;
  recordingDurationSec: number;
  userName?: string;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onSettings: () => void;
  onExportJSON: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
  onLogout: () => void;
}

export const SessionHeader: FC<SessionHeaderProps> = ({
  isRecording,
  recordingDurationSec,
  userName,
  onStartRecording,
  onStopRecording,
  onSettings,
  onExportJSON,
  onExportMarkdown,
  onExportPDF,
  onLogout,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const initials = (userName ?? '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <header className={styles.header}>
      {isRecording && <div className={styles.recordingIndicator} />}

      <div className={styles.container}>
        {/* ── Branding ── */}
        <div className={styles.branding}>
          <span className={styles.logoMark}>⬡</span>
          <div>
            <h1 className={styles.title}>ConvoIQ</h1>
            <p className={styles.subtitle}>Meeting Intelligence</p>
          </div>
        </div>

        {/* ── Centre: session status ── */}
        <div className={styles.center}>
          {isRecording ? (
            <div className={styles.liveStatus}>
              <span className={styles.liveDot} />
              <span className={styles.liveLabel}>RECORDING</span>
              <span className={styles.timerDisplay}>{formatDuration(recordingDurationSec)}</span>
            </div>
          ) : (
            <div className={styles.idleStatus}>
              <span className={styles.timerLabel}>SESSION DURATION</span>
              <span className={styles.timerDisplay}>{formatDuration(recordingDurationSec)}</span>
            </div>
          )}
        </div>

        {/* ── Right controls ── */}
        <div className={styles.controls}>
          {/* START / STOP */}
          {!isRecording ? (
            <button
              className={styles.startBtn}
              onClick={onStartRecording}
              title="Start recording"
            >
              ▶ START
            </button>
          ) : (
            <button
              className={styles.stopBtn}
              onClick={onStopRecording}
              title="Stop recording"
            >
              ⏹ STOP
            </button>
          )}

          {/* Export dropdown */}
          <div className={styles.exportWrapper} ref={exportRef}>
            <button
              className={styles.iconBtn}
              onClick={() => setExportOpen(v => !v)}
              title="Export session"
              aria-label="Export"
            >
              ⬇ Export
            </button>
            {exportOpen && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownItem} onClick={() => { onExportJSON(); setExportOpen(false); }}>
                  <span>📄</span> JSON
                </button>
                <button className={styles.dropdownItem} onClick={() => { onExportMarkdown(); setExportOpen(false); }}>
                  <span>📝</span> Markdown
                </button>
                <button className={styles.dropdownItem} onClick={() => { onExportPDF(); setExportOpen(false); }}>
                  <span>📑</span> PDF
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            className={styles.iconBtn}
            onClick={onSettings}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>

          {/* User avatar + logout */}
          <div className={styles.userArea} title={`Logged in as ${userName}`}>
            <div className={styles.avatar}>{initials}</div>
            <button className={styles.logoutBtn} onClick={onLogout} title="Sign out">
              ↩
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
