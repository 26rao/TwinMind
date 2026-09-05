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
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 100);
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

  const blob = new Blob(
    [md],
    { type: 'text/markdown' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meeting_report_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 100);
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

export function exportToPDF(session: SessionExport): void {
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>ConvoIQ Meeting Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
        h2 { font-size: 16px; font-weight: 700; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
        .summary { background: #f9fafb; border-left: 4px solid #7c3aed; padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.7; }
        .segment { margin-bottom: 16px; }
        .seg-meta { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
        .seg-text { font-size: 14px; line-height: 1.7; }
        .chat-msg { margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; }
        .chat-msg.user { background: #ede9fe; }
        .chat-msg.assistant { background: #f0fdf4; }
        .role { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>ConvoIQ Meeting Report</h1>
      <p class="meta">
        Exported: ${new Date(session.exportedAt).toLocaleString()} &nbsp;|&nbsp;
        Duration: ${formatDuration(session.sessionDurationSeconds)} &nbsp;|&nbsp;
        ${session.transcript.length} segments
      </p>

      ${session.rollingSummary ? `<h2>Summary</h2><div class="summary">${session.rollingSummary}</div>` : ''}

      <h2>Full Transcript</h2>
      ${session.transcript.map(t => `
        <div class="segment">
          <div class="seg-meta">[${new Date(t.timestamp).toLocaleTimeString()}] Chunk #${t.chunkIndex + 1}</div>
          <div class="seg-text">${t.text}</div>
        </div>
      `).join('')}

      ${session.chatHistory.length > 0 ? `
        <h2>AI Copilot Chat</h2>
        ${session.chatHistory.map(m => `
          <div class="chat-msg ${m.role}">
            <div class="role">${m.role}</div>
            <div>${m.content}</div>
          </div>
        `).join('')}
      ` : ''}
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(content);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 100);
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 100);
}

export function printMessageToPDF(renderedHtml: string, timestamp: number, role: string): void {
  const formattedTime = new Date(timestamp).toLocaleString();
  const title = `${role === 'user' ? 'User Message' : 'AI Copilot Response'} - ${formattedTime}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
        .header { margin-bottom: 24px; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; }
        .title { font-size: 20px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .content { font-size: 14px; color: #1f2937; }
        .content p { margin-bottom: 12px; }
        .content h2, .content h3, .content h4 { margin: 24px 0 8px; color: #111; }
        .content ul, .content ol { margin: 12px 0 12px 20px; }
        .content li { margin-bottom: 4px; }
        .content code { font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
        .content pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
        .content pre code { background: none; padding: 0; }
        .content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .content th, .content td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
        .content th { background: #f9fafb; font-weight: 600; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${role === 'user' ? 'User Message' : 'AI Copilot Response'}</div>
        <div class="meta">Generated: ${formattedTime} | ConvoIQ Live Copilot</div>
      </div>
      <div class="content">
        ${renderedHtml}
      </div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(htmlContent);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
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

// ─── Whisper Hallucination & Speech Validation ─────────────────────────────────

const KNOWN_WHISPER_HALLUCINATIONS = new Set([
  'thank you',
  'thank you very much',
  'thank you so much',
  'thank you all',
  'thanks',
  'thanks a lot',
  'thanks for watching',
  'thanks for listening',
  'thanks for watching and ill see you next time',
  'thanks for watching and see you next time',
  'thanks for watching please subscribe',
  'please subscribe',
  'subscribe to our channel',
  'subscribe to the channel',
  'subscribe',
  'like and subscribe',
  'subtitles by',
  'subtitles by the amaraorg community',
  'amaraorg',
  'transcribed by',
  'transcription by',
  'translated by',
  'bye',
  'bye bye',
  'goodbye',
  'see you next time',
  'see you soon',
  'see you in the next video',
  'you',
  'silence',
  'music',
  'applause',
  'laughter',
  'cheering',
  'cough',
  'throat clearing',
  'blank audio',
]);

/**
 * Detects whether a transcription chunk is a Whisper silence hallucination.
 * Common in Whisper Large V3 when processing silent or low-volume audio.
 */
export function isWhisperHallucination(text: string): boolean {
  if (!text) return true;
  const raw = text.trim();
  if (!raw) return true;

  // Stripped of outer brackets, quotes, braces
  const unbracketed = raw.replace(/^[[({\s"']+|[\])}\s"']+$/g, '').trim();
  if (!unbracketed) return true;

  // Normalized lower-case alphanumeric
  const clean = unbracketed
    .toLowerCase()
    .replace(/[.,!?:;…\-–—"'`~^()[\]{}*#_/\\|<>@$%+=]/g, '')
    .trim();

  // If fewer than 2 characters after stripping punctuation
  if (clean.length < 2) return true;

  if (KNOWN_WHISPER_HALLUCINATIONS.has(clean)) return true;

  // Repetitions of common outro phrases
  if (/^(thank\s+you\s*)+$/i.test(clean)) return true;
  if (/^(thanks\s*)+$/i.test(clean)) return true;
  if (/^(you\s*)+$/i.test(clean)) return true;
  if (/^(bye\s*)+$/i.test(clean)) return true;

  // Subtitle / transcription credits
  if (
    clean.includes('subtitles by') ||
    clean.includes('amaraorg') ||
    clean.includes('transcribed by') ||
    clean.includes('transcription by') ||
    clean.includes('translated by')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if text contains substantive speech (at least 4 meaningful words)
 * to avoid generating AI suggestions on silence, single words, or trivial fillers.
 */
export function hasSubstantiveSpeech(text: string): boolean {
  if (!text) return false;
  if (isWhisperHallucination(text)) return false;

  const words = text
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ''))
    .filter((w) => w.length > 1);

  return words.length >= 4;
}

