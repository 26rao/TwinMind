'use client';

import { FC } from 'react';
import { ActionItem } from '@/types';
import styles from './ActionCard.module.css';

interface ActionCardProps {
  actionItem: ActionItem;
  priority: 'high' | 'medium' | 'low';
  onDismiss?: () => void;
}

export const ActionCard: FC<ActionCardProps> = ({
  actionItem,
  priority,
  onDismiss,
}) => {
  const priorityColor = {
    high: 'var(--danger)',
    medium: 'var(--warning)',
    low: 'var(--success)',
  }[priority];

  const formattedDeadline = new Date(actionItem.deadline).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className={`${styles.card} ${styles[`priority-${priority}`]}`}>
      <div className={styles.header}>
        <div className={styles.priority} style={{ borderLeftColor: priorityColor }}>
          <span className={`${styles.badge} text-xs font-mono tracking-widest`}>
            {priority.toUpperCase()}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={styles.dismissBtn}
            title="Dismiss"
            aria-label="Dismiss action item"
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.content}>
        <p className={`${styles.task} text-md font-primary`}>{actionItem.task}</p>
        
        <div className={styles.metadata}>
          <div className={styles.owner}>
            <span className={`${styles.label} text-xs font-mono tracking-wide text-secondary`}>
              OWNER
            </span>
            <span className={`${styles.value} text-sm font-primary`}>
              {actionItem.owner}
            </span>
          </div>

          <div className={styles.deadline}>
            <span className={`${styles.label} text-xs font-mono tracking-wide text-secondary`}>
              DUE
            </span>
            <span className={`${styles.value} text-sm font-mono`}>
              {formattedDeadline}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
