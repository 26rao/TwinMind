'use client';

import { FC } from 'react';
import styles from './PerformanceMetrics.module.css';

interface PerformanceMetricsProps {
  whisperLatency: number;
  factCheckLatency: number;
  chatLatency: number;
  tokenThroughput: number;
  engineModel: string;
}

export const PerformanceMetrics: FC<PerformanceMetricsProps> = ({
  whisperLatency,
  factCheckLatency,
  chatLatency,
  tokenThroughput,
  engineModel,
}) => {
  const formatLatency = (ms: number) => {
    if (ms === 0) return '—';
    return `${Math.round(ms)}ms`;
  };

  const formatThroughput = (tokens: number) => {
    if (tokens === 0) return '—';
    return `${Math.round(tokens)} TOKENS/S`;
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Metric: Whisper Transcription Latency */}
        <div className={styles.metric}>
          <span className={`${styles.label} text-xs font-mono tracking-widest`}>
            STT
          </span>
          <span className={`${styles.value} text-sm font-mono`}>
            {formatLatency(whisperLatency)}
          </span>
        </div>

        {/* Divider */}
        <span className={styles.divider}>│</span>

        {/* Metric: Fact-Check Latency */}
        <div className={styles.metric}>
          <span className={`${styles.label} text-xs font-mono tracking-widest`}>
            FACTCHECK
          </span>
          <span className={`${styles.value} text-sm font-mono`}>
            {formatLatency(factCheckLatency)}
          </span>
        </div>

        {/* Divider */}
        <span className={styles.divider}>│</span>

        {/* Metric: Chat/LLM Latency */}
        <div className={styles.metric}>
          <span className={`${styles.label} text-xs font-mono tracking-widest`}>
            CHAT
          </span>
          <span className={`${styles.value} text-sm font-mono`}>
            {formatLatency(chatLatency)}
          </span>
        </div>

        {/* Divider */}
        <span className={styles.divider}>│</span>

        {/* Metric: Token Throughput */}
        <div className={styles.metric}>
          <span className={`${styles.label} text-xs font-mono tracking-widest`}>
            THROUGHPUT
          </span>
          <span className={`${styles.value} text-sm font-mono`}>
            {formatThroughput(tokenThroughput)}
          </span>
        </div>

        {/* Divider */}
        <span className={styles.divider}>│</span>

        {/* Engine Model */}
        <div className={styles.metric}>
          <span className={`${styles.label} text-xs font-mono tracking-widest`}>
            ENGINE
          </span>
          <span className={`${styles.value} text-sm font-mono`}>
            {engineModel}
          </span>
        </div>
      </div>
    </footer>
  );
};
