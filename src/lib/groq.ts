import { Suggestion, ChatMessage, FactCheck, MeetingReport } from '@/types';

// ─── Transcription ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  model: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', model);
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.text as string).trim();
}

// ─── Rolling Summary ──────────────────────────────────────────────────────────

export async function generateSummary(
  transcriptText: string,
  summaryPrompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const prompt = summaryPrompt.replace('{transcript}', transcriptText);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Summary failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.choices[0].message.content as string).trim();
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export type SuggestionTier = 'HIGH' | 'MEDIUM' | 'INSIGHTS';

const TIER_PROMPTS: Record<SuggestionTier, string> = {
  HIGH: `You are ConvoIQ, a real-time meeting intelligence assistant. Your job is to surface 3 URGENT, HIGH-PRIORITY cards that require immediate attention:

1. **fact-check** — Correct a critical factual error or misstatement in the transcript that could derail the meeting if not corrected immediately. (Fallback: "No factual corrections needed for this segment.")

2. **question** — Ask a sharp, immediate follow-up question that exposes a gap or forces clear thinking right now. (Fallback: "No critical follow-up questions identified.")

3. **insight** — Extract the most critical key takeaway that shifts the immediate direction of this discussion. (Fallback: "No significant insight from this segment.")`,

  MEDIUM: `You are ConvoIQ, a real-time meeting intelligence assistant. Your job is to surface 3 MEDIUM-PRIORITY cards focused on clarification and context:

1. **fact-check** — Highlight a factual nuance, assumption, or definition worth clarifying or double-checking for alignment. (Fallback: "No factual corrections needed for this segment.")

2. **question** — Ask a strategic, context-gathering question that is useful to park or follow up on later. (Fallback: "No critical follow-up questions identified.")

3. **insight** — Identify a useful pattern, background connection, or detail that the speakers may be overlooking. (Fallback: "No significant insight from this segment.")`,

  INSIGHTS: `You are ConvoIQ, a real-time meeting intelligence assistant. Your job is to surface 3 META-INSIGHT cards focused on the conversation's structure and dynamics:

1. **fact-check** — Identify any logical contradiction, shift in stance, or inconsistent terminology used by the speakers. (Fallback: "No factual corrections needed for this segment.")

2. **question** — Ask a deep, meta-level question about team alignment, implicit assumptions, or conversational tone. (Fallback: "No critical follow-up questions identified.")

3. **insight** — Extract a structural observation, such as a shift in negotiation position, tension, or a recurring theme. (Fallback: "No significant insight from this segment.")`,
};

export async function fetchSuggestions(
  recentChunks: string,
  summary: string,
  _systemPrompt: string,
  apiKey: string,
  model: string,
  tier: SuggestionTier = 'HIGH'
): Promise<{ suggestions: Omit<Suggestion, 'id' | 'timestamp'>[]; latencyMs: number }> {
  const startMs = Date.now();

  const systemContent = `${TIER_PROMPTS[tier]}

## STRICT ANTI-HALLUCINATION RULES — THESE OVERRIDE EVERYTHING ELSE
- NEVER invent names, people, roles, tasks, deadlines, owners, or organisations that are not explicitly mentioned in the transcript.
- NEVER fabricate action items, decisions, or agreements that were not stated.
- NEVER assume who said what if roles are not clear.
- If a card type has nothing genuine to contribute for this segment, output the exact fallback above — do NOT invent content.
- Every claim in your preview must be traceable to a specific sentence in the transcript.

## OUTPUT FORMAT
Return ONLY this JSON — no markdown, no prose, no explanation:
{
  "suggestions": [
    { "type": "fact-check", "preview": "<correction or fallback>", "detailsHint": "<what to expand on>" },
    { "type": "question",   "preview": "<specific question or fallback>", "detailsHint": "<why this matters>" },
    { "type": "insight",    "preview": "<key takeaway or fallback>", "detailsHint": "<deeper angle>" }
  ]
}`;

  const userContent = [
    summary
      ? `<prior_summary>${summary}</prior_summary>`
      : '<prior_summary>No prior summary — early in conversation.</prior_summary>',
    `<recent_transcript>${recentChunks}</recent_transcript>`,
    `Analyze the transcript above and return exactly 3 cards (fact-check, question, insight) for the ${tier} tier. Follow all anti-hallucination rules strictly.`,
  ].join('\n');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user',   content: userContent },
      ],
      temperature: 0.3,   // lower temp = fewer hallucinations
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Suggestions failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content as string;
  const parsed = JSON.parse(content) as { suggestions: Omit<Suggestion, 'id' | 'timestamp'>[] };

  // Ensure we always have all 3 types in the correct order
  const VALID_TYPES: Suggestion['type'][] = ['fact-check', 'question', 'insight'];
  const raw = (parsed.suggestions ?? []);

  const validated = VALID_TYPES.map(expectedType => {
    const found = raw.find(s => s.type === expectedType);
    return {
      type: expectedType,
      preview: found?.preview?.trim() || `No ${expectedType} for this segment.`,
      detailsHint: found?.detailsHint?.trim() || 'Nothing to expand on for this segment.',
    };
  });

  return { suggestions: validated, latencyMs: Date.now() - startMs };
}


/** Fetch all 3 tiers in parallel — call this on transcript changes */
export async function fetchAllTierSuggestions(
  recentChunks: string,
  summary: string,
  systemPrompt: string,
  apiKey: string,
  model: string
): Promise<Record<SuggestionTier, { suggestions: Omit<Suggestion, 'id' | 'timestamp'>[]; latencyMs: number }>> {
  const tiers: SuggestionTier[] = ['HIGH', 'MEDIUM', 'INSIGHTS'];
  const results = await Promise.all(
    tiers.map(tier => fetchSuggestions(recentChunks, summary, systemPrompt, apiKey, model, tier))
  );
  return Object.fromEntries(tiers.map((t, i) => [t, results[i]])) as Record<SuggestionTier, { suggestions: Omit<Suggestion, 'id' | 'timestamp'>[]; latencyMs: number }>;
}

// ─── Chat (streaming) ─────────────────────────────────────────────────────────

export async function streamChatResponse(
  userMessage: string,
  recentTranscript: string,
  summary: string,
  chatHistory: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void
): Promise<void> {
  const startMs = Date.now();
  let firstTokenMs: number | null = null;

  const systemContent = [
    systemPrompt,
    summary ? `\n\nConversation summary:\n${summary}` : '',
    `\n\nRecent transcript:\n${recentTranscript}`,
  ].join('');

  const messages = [
    { role: 'system' as const, content: systemContent },
    // Last 10 messages for conversation memory, capped for latency
    ...chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1500,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chat failed (${response.status}): ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        onDone(firstTokenMs ?? Date.now() - startMs);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startMs;
          onToken(token);
        }
      } catch { /* ignore malformed SSE chunks */ }
    }
  }

  onDone(firstTokenMs ?? Date.now() - startMs);
}

// ─── Follow-up Question Generator ────────────────────────────────────────────

export async function generateFollowUpQuestions(
  assistantResponse: string,
  summary: string,
  prompt: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  const filledPrompt = prompt
    .replace('{response}', assistantResponse.slice(0, 2000))
    .replace('{summary}', summary || 'No prior summary.');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: filledPrompt }],
        temperature: 0.6,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content as string);
    const qs = parsed.questions;
    if (!Array.isArray(qs)) return [];
    return qs.filter((q: unknown) => typeof q === 'string').slice(0, 3);
  } catch {
    return []; // fail silently — follow-up questions are enhancement only
  }
}

// ─── Detailed Answer (streaming) ──────────────────────────────────────────────

export async function streamDetailedAnswer(
  suggestion: Suggestion,
  recentTranscript: string,
  summary: string,
  detailedAnswerPrompt: string,
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void
): Promise<void> {
  const startMs = Date.now();
  let firstTokenMs: number | null = null;

  const prompt = detailedAnswerPrompt
    .replace('{type}', suggestion.type)
    .replace('{preview}', suggestion.preview)
    .replace('{summary}', summary || 'No prior summary.')
    .replace('{recentTranscript}', recentTranscript);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Detailed answer failed (${response.status}): ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        onDone(firstTokenMs ?? Date.now() - startMs);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startMs;
          onToken(token);
        }
      } catch { /* ignore malformed SSE chunks */ }
    }
  }

  onDone(firstTokenMs ?? Date.now() - startMs);
}

// ─── Fact-Check ──────────────────────────────────────────────────────────────

export async function factCheckSegment(
  text: string,
  prompt: string,
  apiKey: string,
  model: string
): Promise<FactCheck[]> {
  const filledPrompt = prompt.replace('{text}', text);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: filledPrompt }],
        temperature: 0.1, // low temperature for factual tasks
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const content = data.choices[0].message.content as string;
    const parsed = JSON.parse(content) as { factChecks: FactCheck[] };
    return parsed.factChecks || [];
  } catch (err) {
    console.error('Fact check failed:', err);
    return [];
  }
}

// ─── Meeting Report (Summary + Action Items) ────────────────────────────────

export async function generateMeetingReport(
  fullTranscript: string,
  prompt: string,
  apiKey: string,
  model: string
): Promise<MeetingReport> {
  const filledPrompt = prompt.replace('{transcript}', fullTranscript);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: filledPrompt }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Report generation failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content as string;
  return JSON.parse(content) as MeetingReport;
}
