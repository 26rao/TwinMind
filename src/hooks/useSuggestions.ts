'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SuggestionBatch, Suggestion, TranscriptSegment, LatencyMetrics } from '@/types';
import { fetchAllTierSuggestions, SuggestionTier } from '@/lib/groq';
import { generateId, hasSubstantiveSpeech } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

interface TierBatches {
  HIGH:     SuggestionBatch[];
  MEDIUM:   SuggestionBatch[];
  INSIGHTS: SuggestionBatch[];
}

interface TierLoading {
  HIGH:     boolean;
  MEDIUM:   boolean;
  INSIGHTS: boolean;
}

interface UseSuggestionsReturn {
  tierBatches:    TierBatches;
  tierLoading:    TierLoading;
  isLoading:      boolean;  // true if ANY tier is loading
  error:          string | null;
  latencyMetrics: Pick<LatencyMetrics, 'lastSuggestionLatencyMs' | 'avgSuggestionLatencyMs'>;
  refresh:        (segments: TranscriptSegment[], summary: string, recentChunksText: string) => Promise<void>;
  clearBatches:   () => void;
}

const EMPTY_TIER_BATCHES: TierBatches = { HIGH: [], MEDIUM: [], INSIGHTS: [] };
const EMPTY_TIER_LOADING: TierLoading = { HIGH: false, MEDIUM: false, INSIGHTS: false };

export function useSuggestions(
  segments: TranscriptSegment[],
  isRecording: boolean,
  summary: string,
  getRecentChunksText: (segs: TranscriptSegment[]) => string
): UseSuggestionsReturn {
  const { settings } = useSettings();

  const [tierBatches, setTierBatches] = useState<TierBatches>(EMPTY_TIER_BATCHES);
  const [tierLoading, setTierLoading] = useState<TierLoading>(EMPTY_TIER_LOADING);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [allLatencies, setAllLatencies] = useState<number[]>([]);

  // De-duplicate: skip if transcript hasn't changed
  const lastRefreshHashRef = useRef<string>('');
  // Prevent concurrent refreshes
  const refreshInFlightRef = useRef(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const lastSegmentCountRef = useRef<number>(0);

  const makeBatch = useCallback(
    (
      rawSuggestions: Omit<Suggestion, 'id' | 'timestamp'>[],
      recentText: string,
      latencyMs: number
    ): SuggestionBatch => ({
      id: generateId(),
      timestamp: Date.now(),
      suggestions: rawSuggestions.slice(0, 3).map(s => ({
        ...s,
        id: generateId(),
        timestamp: Date.now(),
      })),
      transcriptContext: recentText,
      latencyMs,
    }),
    []
  );

  const refresh = useCallback(
    async (currentSegments: TranscriptSegment[], currentSummary: string, recentText: string) => {
      if (!settings.groqApiKey && !settings.geminiApiKey) {
        setError('API key not set — open ⚙ Settings.');
        return;
      }
      // If there is no substantive speech yet, stay silent (do not error, do not hallucinate random cards)
      if (!hasSubstantiveSpeech(recentText)) {
        return;
      }

      // De-duplicate
      const hash = recentText.slice(-200);
      if (hash === lastRefreshHashRef.current) return;
      if (refreshInFlightRef.current) return;

      lastRefreshHashRef.current = hash;
      lastRefreshTimeRef.current = Date.now();
      refreshInFlightRef.current = true;
      setError(null);
      setTierLoading({ HIGH: true, MEDIUM: true, INSIGHTS: true });

      const tiers: SuggestionTier[] = ['HIGH', 'MEDIUM', 'INSIGHTS'];

      try {
        const tierResults = await fetchAllTierSuggestions(
          recentText,
          currentSummary,
          settings.suggestionPrompt,
          settings.groqApiKey,
          settings.llmModel,
          settings.geminiApiKey
        );

        let maxLatency = 0;

        setTierBatches((prev) => {
          const next = { ...prev };
          for (const tier of tiers) {
            const data = tierResults[tier];
            if (data && data.suggestions.length > 0) {
              maxLatency = Math.max(maxLatency, data.latencyMs);
              const batch = makeBatch(data.suggestions, recentText, data.latencyMs);
              next[tier] = [batch, ...prev[tier]];
            }
          }
          return next;
        });

        if (maxLatency > 0) {
          setLastLatencyMs(maxLatency);
          setAllLatencies((prev) => [...prev, maxLatency]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
        lastRefreshHashRef.current = ''; // allow retry
        setTierLoading(EMPTY_TIER_LOADING);
      } finally {
        refreshInFlightRef.current = false;
        setTierLoading(EMPTY_TIER_LOADING);
      }
    },
    [settings, makeBatch]
  );

  // ── Auto-refresh cadence (accumulates new speech chunks) ───────────────────
  useEffect(() => {
    if (!isRecording) return;
    if (segments.length === 0) return;

    const accumulatedCount = segments.length - lastSegmentCountRef.current;
    if (accumulatedCount <= 0) return;

    const recentText = getRecentChunksText(segments);
    if (!hasSubstantiveSpeech(recentText)) return;

    const timeSinceLast = Date.now() - lastRefreshTimeRef.current;

    // First segment with real speech generates immediately, then accumulate ~4 chunks (~12s)
    if (lastRefreshTimeRef.current > 0 && accumulatedCount < 4 && timeSinceLast < 12_000) {
      return;
    }

    lastSegmentCountRef.current = segments.length;
    refresh(segments, summary, recentText);
  }, [segments, isRecording, summary, refresh, getRecentChunksText]);

  const clearBatches = useCallback(() => {
    setTierBatches(EMPTY_TIER_BATCHES);
    setTierLoading(EMPTY_TIER_LOADING);
    setError(null);
    setLastLatencyMs(null);
    setAllLatencies([]);
    lastRefreshHashRef.current = '';
    lastSegmentCountRef.current = 0;
  }, []);

  const avgLatency = allLatencies.length
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : null;

  const isLoading = Object.values(tierLoading).some(Boolean);

  return {
    tierBatches,
    tierLoading,
    isLoading,
    error,
    latencyMetrics: {
      lastSuggestionLatencyMs: lastLatencyMs,
      avgSuggestionLatencyMs: avgLatency,
    },
    refresh,
    clearBatches,
  };
}

