'use client';

import { FC } from 'react';
import { FactCheck } from '@/types';
import styles from './FactCheckBadge.module.css';

interface FactCheckBadgeProps {
  factCheck: FactCheck;
  compact?: boolean;
}

export const FactCheckBadge: FC<FactCheckBadgeProps> = ({ factCheck, compact = false }) => {
  const statusConfig = {
    verified: {
      label: 'VERIFIED',
      color: 'var(--success)',
      className: styles.verified,
    },
    uncertain: {
      label: 'UNCERTAIN',
      color: 'var(--warning)',
      className: styles.uncertain,
    },
    incorrect: {
      label: 'INCORRECT',
      color: 'var(--danger)',
      className: styles.incorrect,
    },
  };

  const config = statusConfig[factCheck.status];

  return (
    <div className={`${styles.badge} ${config.className}`}>
      <div className={styles.header}>
        <span className={`${styles.status} text-xs font-mono tracking-widest`}>
          {config.label}
        </span>
      </div>

      {!compact && (
        <>
          <p className={`${styles.claim} text-sm font-primary`}>{factCheck.claim}</p>
          <p className={`${styles.explanation} text-xs text-secondary`}>
            {factCheck.explanation}
          </p>
        </>
      )}
    </div>
  );
};
