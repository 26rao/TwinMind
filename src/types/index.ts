// Core domain types for TwinMind Live Suggestions

export type SuggestionType = 'question' | 'fact-check' | 'talking-point' | 'answer' | 'clarification';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  preview: string;       // Short, immediately useful text shown on the card
  detailsHint: string;   // Context hint for the expanded prompt
  timestamp: number;
}

export interface SuggestionBatch {
  id: string;
  timestamp: number;
  suggestions: Suggestion[];    // Always exactly 3
  transcriptContext: string;    // The transcript slice that generated this batch
  latencyMs?: number;           // Time from refresh trigger to first suggestion rendered
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  chunkIndex: number;   // Which 30s chunk this belongs to
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  linkedSuggestionId?: string; // If this message was triggered by a suggestion click
  latencyMs?: number;          // Time to first token for assistant messages
  followUpQuestions?: string[]; // Suggested follow-up questions (assistant only)
}

export interface LatencyMetrics {
  lastSuggestionLatencyMs: number | null;
  lastChatFirstTokenMs: number | null;
  avgSuggestionLatencyMs: number | null;
}

export interface SessionSettings {
  groqApiKey: string;
  llmModel: string;
  transcriptionModel: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatSystemPrompt: string;
  summaryPrompt: string;
  suggestionContextWindow: number;  // chars of recent transcript for suggestions
  chatContextWindow: number;        // chars for chat answers
  autoRefreshInterval: number;      // seconds between auto-refreshes
  recentChunksForSuggestions: number; // how many recent chunks to use (raw) vs summary
  followUpQuestionsPrompt: string;  // prompt to generate follow-up questions after chat
}

export interface SessionExport {
  exportedAt: string;
  sessionDurationSeconds: number;
  latencyMetrics: LatencyMetrics;
  transcript: Array<{ chunkIndex: number; timestamp: string; text: string }>;
  rollingSummary: string;
  suggestionBatches: Array<{
    timestamp: string;
    latencyMs?: number;
    suggestions: Array<{ type: string; preview: string }>;
  }>;
  chatHistory: Array<{ role: string; content: string; timestamp: string; latencyMs?: number }>;
}
