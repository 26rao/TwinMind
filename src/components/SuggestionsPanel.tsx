'use client';

import { useState, useCallback } from 'react';
import { SuggestionBatch, Suggestion } from '@/types';
import { SuggestionCard } from './SuggestionCard';
import { formatTimestamp, formatLatency } from '@/lib/utils';
import styles from './SuggestionsPanel.module.css';
import { SuggestionTier } from '@/lib/groq';

interface Props {
  batches:           SuggestionBatch[];
  isLoading:         boolean;
  error:             string | null;
  activeTier:        SuggestionTier;
  onSuggestionClick: (s: Suggestion) => void;
  onRefresh:         () => void;
}

const TIER_META: Record<SuggestionTier, {
  dot:      string;
  label:    string;
  emptyMsg: string;
}> = {
  HIGH:     { dot: '🔴', label: 'High Priority',    emptyMsg: 'Critical corrections, questions, and insights will appear here.' },
  MEDIUM:   { dot: '🟡', label: 'Mid-Level',        emptyMsg: 'Nuanced observations and context gaps will appear here.' },
  INSIGHTS: { dot: '🔵', label: 'Meta Insights',    emptyMsg: 'Patterns, contradictions, and conversational analysis will appear here.' },
};

export function SuggestionsPanel({ batches, isLoading, error, activeTier, onSuggestionClick, onRefresh }: Props) {
  const meta    = TIER_META[activeTier];
  const isEmpty = batches.length === 0;

  // Collapse older batches — only latest expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const latestBatch = batches[0] ?? null;

  return (
    <section className={styles.panel}>

      {/* ── Panel header ──────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Live Suggestions</h2>
          {batches.length > 0 && (
            <span className={styles.batchCount}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
          )}
          {isLoading && <span className={styles.loadingPill}>Analysing…</span>}
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
        <div className={styles.errorBanner} role="alert">{error}</div>
      )}

      <div className={styles.scrollArea}>

        {/* Empty + not loading */}
        {isEmpty && !isLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{meta.dot}</div>
            <p>{meta.emptyMsg}</p>
            <p className={styles.emptyHint}>Auto-updates on every new transcription chunk.</p>
          </div>
        )}

        {/* Skeleton while loading first batch */}
        {isLoading && isEmpty && (
          <div className={styles.skeletonGroup}>
            {/* 3 skeletons matching the 3 card types */}
            {[0, 1, 2].map(i => (
              <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        {/* Skeleton overlay on existing batches while refreshing */}
        {isLoading && !isEmpty && (
          <div className={styles.loadingOverlay}>
            {[0, 1, 2].map(i => (
              <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.1}s`, marginBottom: i < 2 ? '6px' : 0 }} />
            ))}
          </div>
        )}

        {/* ── LATEST BATCH — always expanded, no toggle header ─────── */}
        {latestBatch && !isLoading && (
          <div className={styles.latestBatch}>
            <div className={styles.latestMeta}>
              <span className={styles.latestDot} />
              <span className={styles.latestLabel}>Latest</span>
              <span className={styles.batchTime}>{formatTimestamp(latestBatch.timestamp)}</span>
              {latestBatch.latencyMs && (
                <span className={styles.batchLatency}>{formatLatency(latestBatch.latencyMs)}</span>
              )}
            </div>

            {/* 3 cards flat — no extra container chrome */}
            <div className={styles.cardStack}>
              {latestBatch.suggestions.map(s => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onClick={onSuggestionClick}
                  isNew={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── OLDER BATCHES — collapsible ──────────────────────────── */}
        {batches.slice(1).map((batch, idx) => {
          const batchNum   = batches.length - 1 - idx;
          const isExpanded = expandedIds.has(batch.id);

          return (
            <div key={batch.id} className={styles.oldBatch}>
              <button
                className={styles.oldBatchHeader}
                onClick={() => toggleExpand(batch.id)}
                aria-expanded={isExpanded}
              >
                <span className={styles.oldBadge}>#{batchNum}</span>
                <span className={styles.batchTime}>{formatTimestamp(batch.timestamp)}</span>
                {batch.latencyMs && (
                  <span className={styles.batchLatency}>{formatLatency(batch.latencyMs)}</span>
                )}
                <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className={styles.cardStack}>
                  {batch.suggestions.map(s => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onClick={onSuggestionClick}
                      isNew={false}
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
