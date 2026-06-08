'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscriptSegment } from '@/types';
import { transcribeAudio } from '@/lib/groq';
import { generateId } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

const CHUNK_INTERVAL_MS = 10_000; // 10 seconds - optimized for real-time streaming

interface UseAudioRecorderReturn {
  isRecording: boolean;
  segments: TranscriptSegment[];
  recordingDurationSec: number;   // Elapsed recording time in seconds
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  addDemoSegment: (text: string) => void;    // For demo/simulation mode
  clearTranscript: () => void;
  error: string | null;
  isTranscribing: boolean;
  pendingChunks: number;          // How many chunks are being transcribed
  updateSegment: (id: string, updates: Partial<TranscriptSegment>) => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const { settings } = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pendingChunks, setPendingChunks] = useState(0);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);

  // ── Transcribe a blob in the background (parallel with recording) ──────────
  // This is the core of the streaming pipeline: continuous, non-blocking transcription
  const processChunk = useCallback(
    async (audioBlob: Blob, chunkIndex: number) => {
      if (audioBlob.size < 1000) return; // Skip near-empty blobs
      
      setPendingChunks((n) => n + 1);
      setIsTranscribing(true);
      const startTime = performance.now(); // Track transcription latency
      
      try {
        const text = await transcribeAudio(audioBlob, settings.groqApiKey, settings.transcriptionModel);
        const latency = Math.round(performance.now() - startTime);
        
        if (text.trim()) {
          setSegments((prev) => [
            ...prev,
            { 
              id: generateId(), 
              text, 
              timestamp: Date.now(), 
              isFinal: true, 
              chunkIndex,
              latency, // Track latency for performance metrics
            },
          ]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transcription error';
        // Distinguish mic-permission from API errors
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setError('Microphone permission denied. Please allow access and try again.');
        } else {
          setError(`Transcription failed: ${msg}`);
        }
      } finally {
        setPendingChunks((n) => Math.max(0, n - 1));
        setIsTranscribing(false);
      }
    },
    [settings.groqApiKey, settings.transcriptionModel]
  );

  const stopCurrentChunk = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startNewChunk = useCallback(
    (stream: MediaStream) => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      const localChunks: Blob[] = [];
      const myChunkIndex = chunkIndexRef.current++;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) localChunks.push(e.data);
      };

      // onstop fires when this chunk ends — kick off transcription in parallel
      recorder.onstop = () => {
        const blob = new Blob(localChunks, { type: mimeType });
        processChunk(blob, myChunkIndex); // non-blocking: recording next chunk already started
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    },
    [processChunk]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    if (!settings.groqApiKey) {
      setError('Please enter your Groq API key in Settings first (⚙ Settings button, top right).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunkIndexRef.current = 0;
      startNewChunk(stream);
      setIsRecording(true);
      setRecordingDurationSec(0);

      // Chunk rotation: every 30s, stop current → onstop fires transcription → start next
      chunkIntervalRef.current = setInterval(() => {
        stopCurrentChunk();
        startNewChunk(stream);
      }, CHUNK_INTERVAL_MS);

      // Elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingDurationSec((s) => s + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access microphone';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('not allowed')) {
        setError('Microphone access denied. Please allow microphone permission in your browser and try again.');
      } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no device')) {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`Could not start recording: ${msg}`);
      }
    }
  }, [settings.groqApiKey, startNewChunk, stopCurrentChunk]);

  const stopRecording = useCallback(() => {
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null; }
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    stopCurrentChunk();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
  }, [stopCurrentChunk]);

  // Demo mode: inject a text segment as if it were transcribed
  const addDemoSegment = useCallback((text: string) => {
    setSegments((prev) => [
      ...prev,
      {
        id: generateId(),
        text,
        timestamp: Date.now(),
        isFinal: true,
        chunkIndex: chunkIndexRef.current++,
      },
    ]);
  }, []);

  const clearTranscript = useCallback(() => {
    setSegments([]);
    setError(null);
    chunkIndexRef.current = 0;
    setRecordingDurationSec(0);
  }, []);

  const updateSegment = useCallback((id: string, updates: Partial<TranscriptSegment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isRecording,
    segments,
    recordingDurationSec,
    startRecording,
    stopRecording,
    addDemoSegment,
    clearTranscript,
    error,
    isTranscribing,
    pendingChunks,
    updateSegment,
  };
}
