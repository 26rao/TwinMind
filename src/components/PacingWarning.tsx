'use client';

import { FC } from 'react';
import styles from './PacingWarning.module.css';

interface PacingWarningProps {
  isPacingFast: boolean;
  currentWPM: number;
}

export const PacingWarning: FC<PacingWarningProps> = ({ isPacingFast, currentWPM }) => {
  if (!isPacingFast) return null;

  return (
    <div className={styles.warning}>
      <span className={styles.indicator}>!</span>
      <span className={`${styles.text} text-sm font-primary`}>PACING FAST</span>
      <span className={`${styles.wpm} text-xs font-mono`}>{currentWPM} WPM</span>
    </div>
  );
};
