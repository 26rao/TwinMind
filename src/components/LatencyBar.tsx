'use client';

import { LatencyMetrics } from '@/types';
import { formatLatency } from '@/lib/utils';
import styles from './LatencyBar.module.css';

interface Props {
  metrics: LatencyMetrics;
  isSummarizing: boolean;
}

export function LatencyBar({ metrics, isSummarizing }: Props) {
  const { lastSuggestionLatencyMs, lastChatFirstTokenMs, avgSuggestionLatencyMs } = metrics;

  return (
    <div className={styles.bar} title="Performance metrics — lower is better">
      <span className={styles.label}>⚡ Latency</span>

      <div className={styles.metrics}>
        <Metric
          label="Suggestions"
          value={formatLatency(lastSuggestionLatencyMs)}
          avg={avgSuggestionLatencyMs !== null ? `avg ${formatLatency(avgSuggestionLatencyMs)}` : undefined}
          highlight={lastSuggestionLatencyMs !== null && lastSuggestionLatencyMs < 2000}
        />
        <div className={styles.divider} />
        <Metric
          label="Chat first token"
          value={formatLatency(lastChatFirstTokenMs)}
          highlight={lastChatFirstTokenMs !== null && lastChatFirstTokenMs < 800}
        />
        {isSummarizing && (
          <>
            <div className={styles.divider} />
            <span className={styles.summarizingPill}>📝 Summarizing…</span>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, avg, highlight }: {
  label: string;
  value: string;
  avg?: string;
  highlight?: boolean;
}) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} ${highlight ? styles.metricGood : ''}`}>
        {value}
      </span>
      {avg && <span className={styles.metricAvg}>{avg}</span>}
    </div>
  );
}
