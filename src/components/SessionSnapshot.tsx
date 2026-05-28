'use client';

import { LastMeetingSnapshot } from '@/types';
import styles from './SessionSnapshot.module.css';

interface Props {
  snapshot: LastMeetingSnapshot;
  continuationQuestions: string[];
  isLoading: boolean;
  onResumeTopic: (question: string) => void;
  onViewSummary: () => void;
  onDismiss: () => void;
}

export function SessionSnapshot({
  snapshot,
  continuationQuestions,
  isLoading,
  onResumeTopic,
  onViewSummary,
  onDismiss,
}: Props) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        {/* Left side: Session info */}
        <div className={styles.info}>
          <div className={styles.header}>
            <span className={styles.badge}>📌 Continuing</span>
            <span className={styles.client}>{snapshot.clientName}</span>
            <span className={styles.date}>{formatDate(snapshot.date)}</span>
          </div>

          {/* Quick summary */}
          <div className={styles.quickInfo}>
            {snapshot.pendingTasks.length > 0 && (
              <div className={styles.infoItem}>
                <span className={styles.label}>Pending:</span>
                <span className={styles.value}>
                  {snapshot.pendingTasks.map((t) => t.task).join(', ')}
                </span>
              </div>
            )}

            {snapshot.unresolvedDecisions.length > 0 && (
              <div className={styles.infoItem}>
                <span className={styles.label}>Unresolved:</span>
                <span className={styles.value}>
                  {snapshot.unresolvedDecisions.map((d) => d.decision).join(', ')}
                </span>
              </div>
            )}

            {snapshot.risks.length > 0 && (
              <div className={styles.infoItem}>
                <span className={styles.label}>⚠ Risks:</span>
                <span className={styles.value}>{snapshot.risks.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className={styles.actions}>
          <button
            className={styles.btn + ' ' + styles.btnPrimary}
            onClick={onViewSummary}
            title="View full meeting summary"
          >
            📖 View Summary
          </button>

          <div className={styles.continuationMenu}>
            <button
              className={styles.btn + ' ' + styles.btnSecondary}
              title={isLoading ? 'Generating...' : 'Resume with suggested questions'}
            >
              {isLoading ? '⏳' : '▶'} Resume Topics
              {continuationQuestions.length > 0 && (
                <span className={styles.badge}>{continuationQuestions.length}</span>
              )}
            </button>

            {continuationQuestions.length > 0 && (
              <div className={styles.dropdownMenu}>
                {continuationQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className={styles.menuItem}
                    onClick={() => onResumeTopic(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className={styles.btn + ' ' + styles.btnGhost} onClick={onDismiss} title="Dismiss">
            ✕ Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
