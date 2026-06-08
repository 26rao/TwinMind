'use client';

import { FC } from 'react';
import styles from './SessionBanner.module.css';

interface SessionBannerProps {
  clientName?: string;
  unresolvedDecisions: number;
  pendingActions: number;
  risks: number;
  onResume: () => void;
  onViewSummary: () => void;
  isVisible: boolean;
}

export const SessionBanner: FC<SessionBannerProps> = ({
  clientName,
  unresolvedDecisions,
  pendingActions,
  risks,
  onResume,
  onViewSummary,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.statusBlock}>
          <h3 className={`${styles.title} font-primary text-lg`}>
            Continuing {clientName || 'Previous Session'}
          </h3>
          <div className={styles.metrics}>
            <span className={`${styles.metric} text-sm font-mono`}>
              {unresolvedDecisions} unresolved decisions
            </span>
            <span className={`${styles.separator} text-muted`}>•</span>
            <span className={`${styles.metric} text-sm font-mono`}>
              {pendingActions} pending actions
            </span>
            <span className={`${styles.separator} text-muted`}>•</span>
            <span className={`${styles.metric} ${styles.riskMetric} text-sm font-mono`}>
              {risks} risk{risks !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={onResume}
            className={`${styles.btn} ${styles.resumeBtn} text-sm font-primary`}
            title="Resume previous topics"
          >
            Resume Topics
          </button>
          <button
            onClick={onViewSummary}
            className={`${styles.btn} ${styles.summaryBtn} text-sm font-primary`}
            title="View session summary"
          >
            View Summary
          </button>
        </div>
      </div>
    </div>
  );
};
