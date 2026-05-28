import { SessionExport, TranscriptSegment, SuggestionBatch, ChatMessage, LatencyMetrics } from '@/types';

// ─── Session Export ────────────────────────────────────────────────────────────

export function exportSession(
  segments: TranscriptSegment[],
  batches: SuggestionBatch[],
  chatHistory: ChatMessage[],
  rollingSummary: string,
  latencyMetrics: LatencyMetrics,
  sessionStartMs: number
): SessionExport {
  return {
    exportedAt: new Date().toISOString(),
    sessionDurationSeconds: Math.round((Date.now() - sessionStartMs) / 1000),
    latencyMetrics,
    rollingSummary,
    transcript: segments.map((s) => ({
      chunkIndex: s.chunkIndex,
      timestamp: new Date(s.timestamp).toISOString(),
      text: s.text,
    })),
    suggestionBatches: batches.map((b) => ({
      timestamp: new Date(b.timestamp).toISOString(),
      latencyMs: b.latencyMs,
      suggestions: b.suggestions.map((s) => ({
        type: s.type,
        preview: s.preview,
      })),
    })),
    chatHistory: chatHistory.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp).toISOString(),
      latencyMs: m.latencyMs,
    })),
  };
}

// ─── File Download ─────────────────────────────────────────────────────────────

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToMarkdown(session: SessionExport): void {
  const md = [
    `# Meeting Report: ${new Date(session.exportedAt).toLocaleString()}`,
    '',
    `**Duration:** ${formatDuration(session.sessionDurationSeconds)}`,
    '',
    '## Rolling Summary',
    session.rollingSummary || '_No summary generated._',
    '',
    '## Full Transcript',
    ...session.transcript.map(t => `**[${formatTimestamp(new Date(t.timestamp).getTime())}]** Ch #${t.chunkIndex + 1}: ${t.text}`),
    '',
    '## Chat History',
    ...session.chatHistory.map(m => `**${m.role.toUpperCase()}**: ${m.content}`),
  ].join('\n');

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `convoiq-session-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToEmail(session: SessionExport): string {
  const subject = encodeURIComponent(`Meeting Notes: ${new Date().toLocaleDateString()}`);
  const body = encodeURIComponent([
    'Meeting Summary:',
    session.rollingSummary || 'N/A',
    '',
    'Key Transcript Excerpts:',
    ...session.transcript.slice(-3).map(t => `- ${t.text}`),
    '',
    'Sent via ConvoIQ Live Copilot'
  ].join('\n'));

  return `mailto:?subject=${subject}&body=${body}`;
}

// ─── Misc Helpers ──────────────────────────────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
