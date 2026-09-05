'use client';

import { useState, useRef, useCallback } from 'react';
import { TranscriptSegment } from '@/types';
import { generateSummary } from '@/lib/groq';
import { useSettings } from '@/context/SettingsContext';

/**
 * useRollingSummary
 *
 * Maintains a compressed summary of "older" transcript chunks, while keeping
 * the most recent N chunks as raw text. This gives the suggestion engine:
 *  - Historical context (via the summary) without token bloat
 *  - Hyper-relevant recency (raw recent chunks)
 *
 * Summary is regenerated whenever a new chunk arrives and we have more than
 * `recentChunksForSuggestions` chunks in the history.
 */

interface UseRollingSummaryReturn {
  summary: string;
  getRecentChunksText: (segments: TranscriptSegment[]) => string;
  updateSummary: (segments: TranscriptSegment[]) => Promise<void>;
  seedSummary: (text: string) => void;   // inject context from an uploaded session
  isSummarizing: boolean;
  clearSummary: () => void;
}

export function useRollingSummary(): UseRollingSummaryReturn {
  const { settings } = useSettings();
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const lastSummarizedCountRef = useRef(0);

  /**
   * Returns the raw text of the last N chunks (for suggestions prompt).
   */
  const getRecentChunksText = useCallback(
    (segments: TranscriptSegment[]): string => {
      const n = settings.recentChunksForSuggestions;
      // Group by chunkIndex, take the last N distinct chunk indices
      const byChunk = new Map<number, string[]>();
      for (const seg of segments) {
        if (!byChunk.has(seg.chunkIndex)) byChunk.set(seg.chunkIndex, []);
        byChunk.get(seg.chunkIndex)!.push(seg.text);
      }
      const chunkIndices = Array.from(byChunk.keys()).sort((a, b) => a - b);
      const recentIndices = chunkIndices.slice(-n);
      return recentIndices.map((i) => byChunk.get(i)!.join(' ')).join('\n\n');
    },
    [settings.recentChunksForSuggestions]
  );

  const seedContextRef = useRef<string>('');

  /**
   * Summarizes the "older" chunks (everything except the last N).
   * Runs only when we have new chunks to summarize.
   */
  const updateSummary = useCallback(
    async (segments: TranscriptSegment[]): Promise<void> => {
      if (!settings.groqApiKey && !settings.geminiApiKey) return;

      const n = settings.recentChunksForSuggestions;
      const byChunk = new Map<number, string[]>();
      for (const seg of segments) {
        if (!byChunk.has(seg.chunkIndex)) byChunk.set(seg.chunkIndex, []);
        byChunk.get(seg.chunkIndex)!.push(seg.text);
      }
      const chunkIndices = Array.from(byChunk.keys()).sort((a, b) => a - b);

      // Only need to summarize if there are chunks beyond the recent window
      const olderIndices = chunkIndices.slice(0, -n);
      if (olderIndices.length === 0) return;
      if (olderIndices.length === lastSummarizedCountRef.current) return; // nothing new to summarize

      const liveOlderText = olderIndices.map((i) => byChunk.get(i)!.join(' ')).join('\n\n');
      const olderText = [
        seedContextRef.current ? `[PRIOR CONTEXT / DOCUMENT]:\n${seedContextRef.current}` : '',
        liveOlderText,
      ]
        .filter(Boolean)
        .join('\n\n');

      setIsSummarizing(true);
      try {
        const newSummary = await generateSummary(
          olderText,
          settings.summaryPrompt,
          settings.groqApiKey,
          settings.llmModel,
          settings.geminiApiKey
        );
        setSummary(newSummary);
        lastSummarizedCountRef.current = olderIndices.length;
      } catch {
        // Non-fatal: fall back to plain text if summary fails
      } finally {
        setIsSummarizing(false);
      }
    },
    [settings]
  );

  const seedSummary = useCallback((text: string) => {
    seedContextRef.current = text;
    setSummary(text);
    // Reset the counter so the next transcript update appends to this seed
    lastSummarizedCountRef.current = 0;
  }, []);

  const clearSummary = useCallback(() => {
    seedContextRef.current = '';
    setSummary('');
    lastSummarizedCountRef.current = 0;
  }, []);

  return { summary, getRecentChunksText, updateSummary, seedSummary, isSummarizing, clearSummary };
}
