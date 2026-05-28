'use client';

import { useState, useCallback } from 'react';
import { LastMeetingSnapshot, MeetingSession, MeetingReport } from '@/types';
import {
  getLastMeeting,
  generateSnapshot,
  getAllClients,
  saveMeetingSession,
} from '@/lib/sessionStorage';
import { useSettings } from '@/context/SettingsContext';
import { generateId } from '@/lib/utils';

interface UseSessionContinuityReturn {
  currentClientId: string | null;
  currentClientName: string | null;
  lastSnapshot: LastMeetingSnapshot | null;
  continuationQuestions: string[];
  availableClients: Array<{ clientId: string; clientName: string }>;
  isLoading: boolean;
  error: string | null;
  setClient: (clientId: string, clientName: string) => void;
  dismissSnapshot: () => void;
  saveMeetingData: (
    transcript: string,
    summary: string,
    report: MeetingReport
  ) => Promise<void>;
  regenerateSnapshot: () => Promise<void>;
}

export function useSessionContinuity(): UseSessionContinuityReturn {
  const { settings } = useSettings();
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [currentClientName, setCurrentClientName] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<LastMeetingSnapshot | null>(null);
  const [continuationQuestions, setContinuationQuestions] = useState<string[]>([]);
  // Clients list is read-only — computed once from localStorage at mount time.
  // If client management is added in the future, convert this back to useState.
  const [availableClients] = useState<Array<{ clientId: string; clientName: string }>>(
    () => getAllClients()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate continuation questions from snapshot
  const generateContinuationQuestions = useCallback(
    async (snapshot: LastMeetingSnapshot): Promise<string[]> => {
      if (!settings.groqApiKey) return [];

      try {
        const pendingTasksStr = snapshot.pendingTasks
          .map((t) => `${t.task} (${t.owner})`)
          .join(', ') || 'None';

        const unresolvedStr = snapshot.unresolvedDecisions
          .map((d) => d.decision)
          .join(', ') || 'None';

        const risksStr = snapshot.risks.join(', ') || 'None';

        const topicsStr = snapshot.discussionTopics
          .map((t) => t.topic)
          .join(', ') || 'None';

        const prompt = settings.continuationSuggestionsPrompt
          .replace('{summary}', snapshot.overallSummary)
          .replace('{pendingTasks}', pendingTasksStr)
          .replace('{unresolvedDecisions}', unresolvedStr)
          .replace('{risks}', risksStr)
          .replace('{topics}', topicsStr);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${settings.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: settings.llmModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 256,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate continuation questions');
        }

        const data = await response.json();
        const content = data.choices[0].message.content as string;
        const parsed = JSON.parse(content);
        return parsed.questions || [];
      } catch (err) {
        console.error('Error generating continuation questions:', err);
        return [];
      }
    },
    [settings]
  );

  // Set active client and load their last snapshot
  const setClient = useCallback(
    async (clientId: string, clientName: string) => {
      setIsLoading(true);
      setError(null);
      setCurrentClientId(clientId);
      setCurrentClientName(clientName);

      try {
        const lastMeeting = getLastMeeting(clientId);
        if (lastMeeting) {
          const snapshot = generateSnapshot(lastMeeting, clientName);
          setLastSnapshot(snapshot);

          // Generate continuation questions
          const questions = await generateContinuationQuestions(snapshot);
          setContinuationQuestions(questions);
        } else {
          setLastSnapshot(null);
          setContinuationQuestions([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load snapshot');
      } finally {
        setIsLoading(false);
      }
    },
    [generateContinuationQuestions]
  );

  // Regenerate snapshot and questions
  const regenerateSnapshot = useCallback(async () => {
    if (!lastSnapshot) return;

    setIsLoading(true);
    try {
      const questions = await generateContinuationQuestions(lastSnapshot);
      setContinuationQuestions(questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate snapshot');
    } finally {
      setIsLoading(false);
    }
  }, [lastSnapshot, generateContinuationQuestions]);

  // Dismiss snapshot for this session
  const dismissSnapshot = useCallback(() => {
    setLastSnapshot(null);
    setContinuationQuestions([]);
  }, []);

  // Save meeting data for future sessions
  const saveMeetingData = useCallback(
    async (transcript: string, summary: string, report: MeetingReport) => {
      if (!currentClientId || !currentClientName) return;

      try {
        const session: MeetingSession = {
          id: generateId(),
          clientId: currentClientId,
          clientName: currentClientName,
          date: new Date().toISOString().split('T')[0],
          startTime: Date.now(),
          summary,
          transcript,
          pendingTasks: report.actionItems || [],
          unresolvedDecisions:
            report.openQuestions?.map((q: string) => ({
              decision: q,
              context: '',
            })) || [],
          risks: report.risks || [],
          discussionTopics: report.keyPoints?.map((p: string) => ({
            topic: p,
            summary: '',
            suggestedNextSteps: [],
          })) || [],
          keyTakeaways: report.keyPoints || [],
        };

        saveMeetingSession(session);
      } catch (err) {
        console.error('Failed to save meeting data:', err);
      }
    },
    [currentClientId, currentClientName]
  );

  return {
    currentClientId,
    currentClientName,
    lastSnapshot,
    continuationQuestions,
    availableClients,
    isLoading,
    error,
    setClient,
    dismissSnapshot,
    saveMeetingData,
    regenerateSnapshot,
  };
}
