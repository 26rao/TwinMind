'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SuggestionBatch, Suggestion, TranscriptSegment, LatencyMetrics } from '@/types';
import { fetchSuggestions } from '@/lib/groq';
import { generateId } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

interface UseSuggestionsReturn {
  batches: SuggestionBatch[];
  isLoading: boolean;
  error: string | null;
  latencyMetrics: Pick<LatencyMetrics, 'lastSuggestionLatencyMs' | 'avgSuggestionLatencyMs'>;
  refresh: (segments: TranscriptSegment[], summary: string, recentChunksText: string) => Promise<void>;
  clearBatches: () => void;
}

export function useSuggestions(
  segments: TranscriptSegment[],
  isRecording: boolean,
  summary: string,
  getRecentChunksText: (segs: TranscriptSegment[]) => string
): UseSuggestionsReturn {
  const { settings } = useSettings();
  const [batches, setBatches] = useState<SuggestionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [allLatencies, setAllLatencies] = useState<number[]>([]);
  const lastRefreshHashRef = useRef<string>('');

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

      // De-duplicate: skip if context hasn't changed
      const hash = recentText.slice(-200);
      if (hash === lastRefreshHashRef.current) return;

      setIsLoading(true);
      setError(null);
      lastRefreshHashRef.current = hash;

      try {
        const { suggestions: rawSuggestions, latencyMs } = await fetchSuggestions(
          recentText,
          currentSummary,
          settings.suggestionPrompt,
          settings.groqApiKey,
          settings.llmModel
        );

        // Validate we always have exactly 3
        const suggestions: Suggestion[] = rawSuggestions.slice(0, 3).map((s) => ({
          ...s,
          id: generateId(),
          timestamp: Date.now(),
        }));

        const batch: SuggestionBatch = {
          id: generateId(),
          timestamp: Date.now(),
          suggestions,
          transcriptContext: recentText,
          latencyMs,
        };

        // Newest batch goes to the TOP
        setBatches((prev) => [batch, ...prev]);
        setLastLatencyMs(latencyMs);
        setAllLatencies((prev) => [...prev, latencyMs]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
        lastRefreshHashRef.current = ''; // allow retry
      } finally {
        setIsLoading(false);
      }
    },
    [settings]
  );

  // Auto-refresh every N seconds while recording
  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      const recentText = getRecentChunksText(segments);
      refresh(segments, summary, recentText);
    }, settings.autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [isRecording, segments, summary, refresh, getRecentChunksText, settings.autoRefreshInterval]);

  const clearBatches = useCallback(() => {
    setBatches([]);
    setError(null);
    setLastLatencyMs(null);
    setAllLatencies([]);
    lastRefreshHashRef.current = '';
  }, []);

  const avgLatency = allLatencies.length
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : null;

  return {
    batches,
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
