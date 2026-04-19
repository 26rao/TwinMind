'use client';

import { useState } from 'react';
import { SuggestionBatch, Suggestion } from '@/types';
import { SuggestionCard } from './SuggestionCard';
import { formatTimestamp, formatLatency } from '@/lib/utils';
import styles from './SuggestionsPanel.module.css';

interface Props {
  batches: SuggestionBatch[];
  isLoading: boolean;
  error: string | null;
  onSuggestionClick: (s: Suggestion) => void;
  onRefresh: () => void;
}

export function SuggestionsPanel({ batches, isLoading, error, onSuggestionClick, onRefresh }: Props) {
  const isEmpty = batches.length === 0;
  // Older batches are collapsed by default — user can expand
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const toggleBatch = (id: string) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.icon}>⚡</span>
          <h2 className={styles.title}>Live Suggestions</h2>
          {batches.length > 0 && (
            <span className={styles.batchCount}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
          )}
          {isLoading && <span className={styles.loadingPill}>Thinking…</span>}
        </div>
        <button
          id="suggestions-refresh-btn"
          className={styles.refreshBtn}
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh suggestions"
        >
          <span className={isLoading ? styles.spinIcon : ''}>↻</span>
          Refresh
        </button>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.scrollArea}>
        {/* Empty + skeleton states */}
        {isEmpty && !isLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💡</div>
            <p>Suggestions appear here as you speak.</p>
            <p className={styles.emptyHint}>They refresh every 30 seconds, or hit Refresh manually.</p>
          </div>
        )}

        {isLoading && isEmpty && (
          <div className={styles.skeletonGroup}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        {/* Loading overlay on top of existing batches */}
        {isLoading && !isEmpty && (
          <div className={styles.loadingOverlay}>
            <div className={styles.skeletonGroup}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Batch history — newest on top */}
        {batches.map((batch, batchIdx) => {
          const isLatest = batchIdx === 0;
          const isExpanded = isLatest || expandedBatchIds.has(batch.id);

          return (
            <div
              key={batch.id}
              className={`${styles.batch} ${isLatest ? styles.batchLatest : styles.batchOld}`}
            >
              {/* Batch header — clickable for older batches to toggle */}
              <button
                className={styles.batchHeader}
                onClick={isLatest ? undefined : () => toggleBatch(batch.id)}
                aria-expanded={isExpanded}
                disabled={isLatest}
                title={isLatest ? 'Latest suggestions' : isExpanded ? 'Collapse' : 'Expand'}
              >
                <div className={styles.batchHeaderLeft}>
                  {isLatest ? (
                    <span className={styles.latestBadge}>
                      <span className={styles.latestDot} />
                      Latest
                    </span>
                  ) : (
                    <span className={styles.oldBadge}>
                      #{batches.length - batchIdx}
                    </span>
                  )}
                  <span className={styles.batchTime}>{formatTimestamp(batch.timestamp)}</span>
                  {batch.latencyMs && (
                    <span className={styles.batchLatency} title="Time to generate this batch">
                      {formatLatency(batch.latencyMs)}
                    </span>
                  )}
                </div>
                {!isLatest && (
                  <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                )}
              </button>

              {/* Cards — always shown for latest, toggle for older */}
              {isExpanded && (
                <div className={styles.cardGrid}>
                  {batch.suggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onClick={onSuggestionClick}
                      isNew={isLatest}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
