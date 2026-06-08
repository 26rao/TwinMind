'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SuggestionBatch, Suggestion, TranscriptSegment, LatencyMetrics } from '@/types';
import { fetchSuggestions, fetchAllTierSuggestions, SuggestionTier } from '@/lib/groq';
import { generateId } from '@/lib/utils';
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
      if (!settings.groqApiKey) {
        setError('Groq API key not set — open ⚙ Settings.');
        return;
      }
      if (!recentText.trim()) {
        setError('No transcript yet. Start speaking or add demo text.');
        return;
      }

      // De-duplicate
      const hash = recentText.slice(-200);
      if (hash === lastRefreshHashRef.current) return;
      if (refreshInFlightRef.current) return;

      lastRefreshHashRef.current = hash;
      refreshInFlightRef.current = true;
      setError(null);

      // Mark all tiers loading
      setTierLoading({ HIGH: true, MEDIUM: true, INSIGHTS: true });

      const tiers: SuggestionTier[] = ['HIGH', 'MEDIUM', 'INSIGHTS'];

      try {
        // Fire all 3 API calls in parallel
        const results = await Promise.allSettled(
          tiers.map(tier =>
            fetchSuggestions(
              recentText, currentSummary,
              settings.suggestionPrompt, settings.groqApiKey, settings.llmModel,
              tier
            ).then(res => ({ tier, res }))
          )
        );

        let maxLatency = 0;

        setTierBatches(prev => {
          const next = { ...prev };
          results.forEach((result, i) => {
            const tier = tiers[i];
            setTierLoading(l => ({ ...l, [tier]: false }));
            if (result.status === 'fulfilled') {
              const { res } = result.value;
              maxLatency = Math.max(maxLatency, res.latencyMs);
              const batch = makeBatch(res.suggestions, recentText, res.latencyMs);
              next[tier] = [batch, ...prev[tier]];
            } else {
              console.error(`[${tier}] suggestion failed:`, result.reason);
            }
          });
          return next;
        });

        if (maxLatency > 0) {
          setLastLatencyMs(maxLatency);
          setAllLatencies(prev => [...prev, maxLatency]);
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

  // ── Auto-refresh when a new segment arrives ──────────────────────────────────
  const lastSegmentCountRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording) return;
    if (segments.length === lastSegmentCountRef.current) return;
    lastSegmentCountRef.current = segments.length;

    const recentText = getRecentChunksText(segments);
    refresh(segments, summary, recentText);
  }, [segments, isRecording, summary, refresh, getRecentChunksText]);

  // ── Fallback timer (catches long silences between transcriptions) ─────────────
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      const recentText = getRecentChunksText(segments);
      refresh(segments, summary, recentText);
    }, settings.autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [isRecording, segments, summary, refresh, getRecentChunksText, settings.autoRefreshInterval]);

  const clearBatches = useCallback(() => {
    setTierBatches(EMPTY_TIER_BATCHES);
    setTierLoading(EMPTY_TIER_LOADING);
    setError(null);
    setLastLatencyMs(null);
    setAllLatencies([]);
    lastRefreshHashRef.current = '';
  }, []);

  const avgLatency = allLatencies.length
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : null;

  const isLoading = Object.values(tierLoading).some(Boolean);

  // Legacy `batches` compat — expose the HIGH tier batches as default
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
