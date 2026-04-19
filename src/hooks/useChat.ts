'use client';

import { useState, useCallback, useRef } from 'react';
import { ChatMessage, Suggestion, TranscriptSegment, LatencyMetrics } from '@/types';
import { streamChatResponse, streamDetailedAnswer, generateFollowUpQuestions } from '@/lib/groq';
import { generateId } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  latencyMetrics: Pick<LatencyMetrics, 'lastChatFirstTokenMs'>;
  sendMessage: (content: string, segments: TranscriptSegment[], summary: string) => Promise<void>;
  expandSuggestion: (suggestion: Suggestion, segments: TranscriptSegment[], summary: string) => Promise<void>;
  clearChat: () => void;
}

export function useChat(): UseChatReturn {
  const { settings } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFirstTokenMs, setLastFirstTokenMs] = useState<number | null>(null);
  // Mirror messages in a ref so async callbacks can read up-to-date content
  const messagesRef = useRef<ChatMessage[]>([]);

  const setMessagesAndRef = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  // Read the current content of a specific message (used after streaming completes)
  const getMessageContent = useCallback((msgId: string): string => {
    return messagesRef.current.find((m) => m.id === msgId)?.content ?? '';
  }, []);

  const appendAssistantToken = useCallback((msgId: string, token: string) => {
    setMessagesAndRef((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, content: m.content + token } : m))
    );
  }, [setMessagesAndRef]);

  const setAssistantLatency = useCallback((msgId: string, latencyMs: number) => {
    setMessagesAndRef((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, latencyMs } : m))
    );
    setLastFirstTokenMs(latencyMs);
    setIsStreaming(false);
  }, [setMessagesAndRef]);

  const sendMessage = useCallback(
    async (content: string, segments: TranscriptSegment[], summary: string) => {
      if (!settings.groqApiKey) {
        setError('Groq API key not set — open ⚙ Settings.');
        return;
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      const assistantMsgId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessagesAndRef((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      // Build smart context: summary + recent transcript (capped)
      const recentTranscript = segments
        .map((s) => s.text)
        .join(' ')
        .slice(-settings.chatContextWindow);

      try {
        await streamChatResponse(
          content,
          recentTranscript,
          summary,
          messages,
          settings.chatSystemPrompt,
          settings.groqApiKey,
          settings.llmModel,
          (token) => appendAssistantToken(assistantMsgId, token),
          async (latencyMs) => {
            setAssistantLatency(assistantMsgId, latencyMs);
            // Generate follow-up questions in background (non-blocking)
            const fullResponse = await getMessageContent(assistantMsgId);
            const followUpQs = await generateFollowUpQuestions(
              fullResponse,
              summary,
              settings.followUpQuestionsPrompt,
              settings.groqApiKey,
              settings.llmModel
            );
            if (followUpQs.length > 0) {
              setMessagesAndRef((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, followUpQuestions: followUpQs } : m
                )
              );
            }
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chat error');
        setIsStreaming(false);
      }
    },
    [settings, messages, appendAssistantToken, setAssistantLatency]
  );

  const expandSuggestion = useCallback(
    async (suggestion: Suggestion, segments: TranscriptSegment[], summary: string) => {
      if (!settings.groqApiKey) {
        setError('Groq API key not set — open ⚙ Settings.');
        return;
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: `Tell me more about: "${suggestion.preview}"`,
        timestamp: Date.now(),
        linkedSuggestionId: suggestion.id,
      };

      const assistantMsgId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        linkedSuggestionId: suggestion.id,
      };

      setMessagesAndRef((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      const recentTranscript = segments
        .map((s) => s.text)
        .join(' ')
        .slice(-settings.chatContextWindow);

      try {
        await streamDetailedAnswer(
          suggestion,
          recentTranscript,
          summary,
          settings.detailedAnswerPrompt,
          settings.groqApiKey,
          settings.llmModel,
          (token) => appendAssistantToken(assistantMsgId, token),
          async (latencyMs) => {
            setAssistantLatency(assistantMsgId, latencyMs);
            // Generate follow-up questions in background (non-blocking)
            const fullResponse = await getMessageContent(assistantMsgId);
            const followUpQs = await generateFollowUpQuestions(
              fullResponse,
              summary,
              settings.followUpQuestionsPrompt,
              settings.groqApiKey,
              settings.llmModel
            );
            if (followUpQs.length > 0) {
              setMessagesAndRef((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, followUpQuestions: followUpQs } : m
                )
              );
            }
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Expansion error');
        setIsStreaming(false);
      }
    },
    [settings, appendAssistantToken, setAssistantLatency]
  );

  const clearChat = useCallback(() => {
    setMessagesAndRef(() => []);
    messagesRef.current = [];
    setError(null);
    setLastFirstTokenMs(null);
  }, [setMessagesAndRef]);

  return {
    messages,
    isStreaming,
    error,
    latencyMetrics: { lastChatFirstTokenMs: lastFirstTokenMs },
    sendMessage,
    expandSuggestion,
    clearChat,
  };
}
