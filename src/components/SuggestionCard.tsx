'use client';

import { Suggestion } from '@/types';
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from '@/lib/defaults';
import styles from './SuggestionCard.module.css';

interface Props {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
  isNew?: boolean;
}

export function SuggestionCard({ suggestion, onClick, isNew }: Props) {
  const color = SUGGESTION_TYPE_COLORS[suggestion.type] ?? '#888';
  const label = SUGGESTION_TYPE_LABELS[suggestion.type] ?? suggestion.type;

  return (
    <button
      id={`suggestion-${suggestion.id}`}
      className={`${styles.card} ${isNew ? styles.cardNew : ''}`}
      onClick={() => onClick(suggestion)}
      aria-label={`Suggestion: ${suggestion.preview}`}
      style={{ '--type-color': color } as React.CSSProperties}
    >
      <span className={styles.typeBadge} style={{ color, borderColor: `${color}40`, background: `${color}18` }}>
        {label}
      </span>
      <p className={styles.preview}>{suggestion.preview}</p>
      <span className={styles.expandHint}>Tap for details →</span>
    </button>
  );
}
