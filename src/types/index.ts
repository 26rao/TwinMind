// Core domain types for ConvoIQ Live Suggestions

export type SuggestionType = 'fact-check' | 'question' | 'insight';

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

export interface FactCheck {
  claim: string;
  status: 'verified' | 'uncertain' | 'incorrect';
  explanation: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  chunkIndex: number;   // Which 10s chunk this belongs to
  factChecks?: FactCheck[];
  latency?: number;     // Transcription latency in milliseconds
}

export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
}

export interface MeetingReport {
  keyPoints: string[];
  decisions: string[];
  openQuestions: string[];
  risks: string[];
  actionItems: ActionItem[];
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
  geminiApiKey: string;
  llmProvider: 'gemini' | 'groq';
  llmModel: string;
  transcriptionModel: string;
  promptVersion?: number;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatSystemPrompt: string;
  summaryPrompt: string;
  suggestionContextWindow: number;  // chars of recent transcript for suggestions
  chatContextWindow: number;        // chars for chat answers
  autoRefreshInterval: number;      // seconds between auto-refreshes
  recentChunksForSuggestions: number; // how many recent chunks to use (raw) vs summary
  followUpQuestionsPrompt: string;  // prompt to generate follow-up questions after chat
  factCheckPrompt: string;          // prompt to fact-check a transcript segment
  reportPrompt: string;             // prompt to generate structured meeting report
  sessionSnapshotPrompt: string;    // prompt to generate session snapshot from meeting
  continuationSuggestionsPrompt: string; // prompt to generate continuation questions
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

// ── Session Continuity Types ──────────────────────────────────────────

export interface PendingTask {
  task: string;
  owner: string;
  deadline?: string;
}

export interface UnresolvedDecision {
  decision: string;
  context: string;  // Why it matters
}

export interface DiscussionTopic {
  topic: string;
  summary: string;  // What was discussed
  suggestedNextSteps?: string[];
}

export interface LastMeetingSnapshot {
  clientId: string;
  clientName: string;
  date: string;
  overallSummary: string;
  pendingTasks: PendingTask[];
  unresolvedDecisions: UnresolvedDecision[];
  risks: string[];
  discussionTopics: DiscussionTopic[];
  keyTakeaways: string[];
}

export interface MeetingSession {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  startTime: number;
  endTime?: number;
  summary: string;
  transcript: string;
  pendingTasks: PendingTask[];
  unresolvedDecisions: UnresolvedDecision[];
  risks: string[];
  discussionTopics: DiscussionTopic[];
  keyTakeaways: string[];
}

export interface SessionHistory {
  clientId: string;
  clientName: string;
  meetings: MeetingSession[];
  lastMeetingId?: string;
}
