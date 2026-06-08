'use client';

import { Suggestion } from '@/types';
import styles from './SuggestionCard.module.css';

interface Props {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
  isNew?: boolean;
}

const TYPE_CONFIG = {
  'fact-check': {
    icon:       '✅',
    label:      'Fact Check',
    colorVar:   '--color-amber',
    color:      '#f5a94a',
    bg:         'rgba(245, 169, 74, 0.08)',
    border:     'rgba(245, 169, 74, 0.22)',
  },
  'question': {
    icon:       '❓',
    label:      'Question to Ask',
    colorVar:   '--color-blue',
    color:      '#5b8af5',
    bg:         'rgba(91, 138, 245, 0.08)',
    border:     'rgba(91, 138, 245, 0.22)',
  },
  'insight': {
    icon:       '💡',
    label:      'Insight',
    colorVar:   '--color-green',
    color:      '#7ecb8b',
    bg:         'rgba(126, 203, 139, 0.08)',
    border:     'rgba(126, 203, 139, 0.22)',
  },
} as const;

export function SuggestionCard({ suggestion, onClick, isNew }: Props) {
  const cfg = TYPE_CONFIG[suggestion.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG['insight'];

  // Check if this is a no-content fallback
  const isFallback = suggestion.preview.startsWith('No ') && suggestion.preview.endsWith('segment.');

  return (
    <button
      id={`suggestion-${suggestion.id}`}
      className={`${styles.card} ${isNew ? styles.cardNew : ''} ${isFallback ? styles.cardFallback : ''}`}
      onClick={() => !isFallback && onClick(suggestion)}
      aria-label={`${cfg.label}: ${suggestion.preview}`}
      disabled={isFallback}
      style={{
        '--type-color': cfg.color,
        '--type-bg':    cfg.bg,
        '--type-border': cfg.border,
      } as React.CSSProperties}
    >
      {/* Left accent stripe */}
      <div className={styles.stripe} />

      {/* Icon column */}
      <span className={styles.icon} aria-hidden="true">{cfg.icon}</span>

      {/* Content column */}
      <div className={styles.content}>
        <span
          className={styles.typeBadge}
          style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}
        >
          {cfg.label}
        </span>
        <p className={styles.preview}>{suggestion.preview}</p>
        {!isFallback && (
          <span className={styles.expandHint}>Tap to expand →</span>
        )}
      </div>
    </button>
  );
}
