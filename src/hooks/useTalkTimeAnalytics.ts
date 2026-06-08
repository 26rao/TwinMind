'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscriptSegment } from '@/types';

interface TalkTimeMetrics {
  totalWordsSpoken: number;
  averageWPM: number;
  currentWPM: number;
  isPacingFast: boolean;
  talkToListenRatio: number;
}

interface UseTalkTimeAnalyticsReturn {
  metrics: TalkTimeMetrics;
  updateWithSegments: (segments: TranscriptSegment[], recordingDurationSec: number) => void;
}

const WPM_FAST_THRESHOLD = 150; // Words per minute threshold for "fast pacing"
const WORDS_PER_MINUTE_ESTIMATE = 150; // Average speaking rate

export function useTalkTimeAnalytics(): UseTalkTimeAnalyticsReturn {
  const [metrics, setMetrics] = useState<TalkTimeMetrics>({
    totalWordsSpoken: 0,
    averageWPM: 0,
    currentWPM: 0,
    isPacingFast: false,
    talkToListenRatio: 0.5,
  });

  const lastMetricsRef = useRef<TalkTimeMetrics>(metrics);

  const updateWithSegments = useCallback(
    (segments: TranscriptSegment[], recordingDurationSec: number) => {
      if (segments.length === 0) return;

      // Calculate total words spoken
      const allText = segments.map(s => s.text).join(' ');
      const totalWords = allText.split(/\s+/).filter(w => w.length > 0).length;

      // Calculate words per minute for last 10 seconds (most recent chunk)
      const recentSegments = segments.slice(-1); // Last segment (10s chunk)
      const recentText = recentSegments.map(s => s.text).join(' ');
      const recentWords = recentText.split(/\s+/).filter(w => w.length > 0).length;
      const currentWPM = recentWords * 6; // Extrapolate to 60 seconds (10s * 6)

      // Calculate average WPM
      const recordingMinutes = Math.max(1, recordingDurationSec / 60);
      const averageWPM = Math.round(totalWords / recordingMinutes);

      // Check if pacing is too fast
      const isPacingFast = currentWPM > WPM_FAST_THRESHOLD;

      // Calculate talk-to-listen ratio (assuming external attendee patterns)
      // For now, using a simple heuristic: ratio based on total words / time
      const talkToListenRatio = Math.min(1, totalWords / (recordingDurationSec * 2.5));

      setMetrics({
        totalWordsSpoken: totalWords,
        averageWPM,
        currentWPM: Math.round(currentWPM),
        isPacingFast,
        talkToListenRatio,
      });

      lastMetricsRef.current = {
        totalWordsSpoken: totalWords,
        averageWPM,
        currentWPM: Math.round(currentWPM),
        isPacingFast,
        talkToListenRatio,
      };
    },
    []
  );

  return {
    metrics,
    updateWithSegments,
  };
}
