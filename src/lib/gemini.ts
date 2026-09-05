import { Suggestion, ChatMessage, FactCheck, MeetingReport } from '@/types';
import { SuggestionTier } from '@/lib/groq';
import { hasSubstantiveSpeech } from '@/lib/utils';


const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getNormalizedModel(model: string): string {
  if (model === 'gemini-2.5-flash' || model === 'gemini-2.0-flash' || !model || !model.startsWith('gemini-')) {
    return 'gemini-3.6-flash';
  }
  return model;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role?: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Executes a non-streaming generateContent call to Gemini.
 */
async function callGeminiApi(
  model: string,
  apiKey: string,
  body: {
    contents: GeminiContent[];
    systemInstruction?: { parts: GeminiPart[] };
    generationConfig?: {
      temperature?: number;
      maxOutputTokens?: number;
      responseMimeType?: string;
    };
  }
) {
  const normalizedModel = getNormalizedModel(model);
  const url = `${GEMINI_API_BASE}/${normalizedModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Executes a streaming streamGenerateContent call to Gemini using SSE.
 */
async function streamGeminiApi(
  model: string,
  apiKey: string,
  body: {
    contents: GeminiContent[];
    systemInstruction?: { parts: GeminiPart[] };
    generationConfig?: {
      temperature?: number;
      maxOutputTokens?: number;
    };
  },
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void,
  startMs: number
) {
  const normalizedModel = getNormalizedModel(model);
  const url = `${GEMINI_API_BASE}/${normalizedModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini streaming error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable response body from Gemini');

  const decoder = new TextDecoder();
  let firstTokenMs: number | null = null;
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, '');
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const candidates = parsed.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.text) {
              if (firstTokenMs === null) firstTokenMs = Date.now() - startMs;
              onToken(part.text);
            }
          }
        }
      } catch {
        /* ignore individual malformed SSE line */
      }
    }
  }

  onDone(firstTokenMs ?? Date.now() - startMs);
}

// ─── Real-Time Suggestions (ONE Unified Call) ─────────────────────────────────

function normalizeSuggestionType(rawType?: string): Suggestion['type'] {
  const t = (rawType || '').toLowerCase().trim();
  if (t.includes('fact') || t.includes('check') || t.includes('verif')) return 'fact-check';
  if (t.includes('question') || t.includes('ask') || t.includes('query')) return 'question';
  return 'insight';
}

export async function fetchGeminiSuggestions(
  recentChunks: string,
  summary: string,
  apiKey: string,
  model = 'gemini-3.6-flash'
): Promise<Record<SuggestionTier, { suggestions: Omit<Suggestion, 'id' | 'timestamp'>[]; latencyMs: number }>> {
  if (!hasSubstantiveSpeech(recentChunks)) {
    return {
      HIGH: { suggestions: [], latencyMs: 0 },
      MEDIUM: { suggestions: [], latencyMs: 0 },
      INSIGHTS: { suggestions: [], latencyMs: 0 },
    };
  }

  const startMs = Date.now();


  const systemInstruction = `You are ConvoIQ, a real-time meeting intelligence copilot. Your mission is to give the user high-value conversational support DIRECTLY RELEVANT to the actual topic being discussed in the meeting.

CRITICAL TOPICAL GROUNDING & ANTI-HALLUCINATION RULES:
1. STRICT TOPIC RELEVANCE:
   - Every card MUST be directly relevant to the real subject matter and practical purpose of the conversation.
   - NEVER HIJACK ISOLATED KEYWORDS: Never latch onto an isolated word, phrase fragment, or homonym (e.g., "states", "continuous", "sign in", "cloud", "model", "pipeline", "apple") and invent an unrelated specialized field (such as academic control theory, differential equations, quantum physics, medical surgery) unless the meeting participants are explicitly discussing that exact topic.
   - Ground all insights in the actual business, project, technical, or conversational context established by the speakers.

2. INSUFFICIENT CONTEXT OR CASUAL BANTER:
   - If the conversation consists only of greetings, audio/mic testing, disjointed phrase fragments, or casual small talk where no clear substantive meeting topic has been established yet, DO NOT INVENT A FICTIONAL TOPIC.
   - Return empty arrays for all tiers:
     { "HIGH": [], "MEDIUM": [], "INSIGHTS": [] }

3. CARD DEFINITIONS (Only when a clear meeting topic is actively discussed):
   - "fact-check": A verified fact, benchmark, or factual clarification directly pertinent to what was stated.
   - "question": A non-obvious, practical question the user can ask right now to advance the specific discussion.
   - "insight": A strategic observation, counterpoint, or synthesis directly relevant to the meeting's goals.

4. FORMAT:
   - 1–2 clear, intelligent sentences ready to speak or read aloud. Concise and pragmatic.

Output JSON with this exact schema:
{
  "HIGH": [
    { "type": "fact-check", "preview": "<factual context directly on the meeting topic>", "detailsHint": "<expansion focus>" },
    { "type": "question", "preview": "<sharp question directly on the meeting topic>", "detailsHint": "<why this matters>" },
    { "type": "insight", "preview": "<strategic insight directly on the meeting topic>", "detailsHint": "<deeper angle>" }
  ],
  "MEDIUM": [
    { "type": "fact-check", "preview": "<clarification directly on the meeting topic>", "detailsHint": "<expansion focus>" },
    { "type": "question", "preview": "<follow-up question directly on the meeting topic>", "detailsHint": "<why this matters>" },
    { "type": "insight", "preview": "<practical observation directly on the meeting topic>", "detailsHint": "<deeper angle>" }
  ],
  "INSIGHTS": [
    { "type": "fact-check", "preview": "<nuance or definition directly on the meeting topic>", "detailsHint": "<expansion focus>" },
    { "type": "question", "preview": "<alignment question directly on the meeting topic>", "detailsHint": "<why this matters>" },
    { "type": "insight", "preview": "<synthesis directly on the meeting topic>", "detailsHint": "<deeper angle>" }
  ]
}`;

  const userPrompt = [
    summary ? `<meeting_summary_and_context>\n${summary}\n</meeting_summary_and_context>` : '',
    `<recent_transcript_chunks>\n${recentChunks}\n</recent_transcript_chunks>`,
    'Carefully evaluate the meeting transcript above. If a clear, coherent topic is being discussed, generate topically aligned intelligence cards for HIGH, MEDIUM, and INSIGHTS tiers. If the speech is ambiguous, fragmented, or lacks a clear discussion topic, return empty arrays for all tiers.',
  ].filter(Boolean).join('\n\n');

  const data = await callGeminiApi(model, apiKey, {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
      responseMimeType: 'application/json',
    },
  });

  const latencyMs = Date.now() - startMs;
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  let parsed: any = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    /* fallback to empty */
  }

  const tiers: SuggestionTier[] = ['HIGH', 'MEDIUM', 'INSIGHTS'];
  const out = {} as Record<SuggestionTier, { suggestions: Omit<Suggestion, 'id' | 'timestamp'>[]; latencyMs: number }>;

  // Find tier list case-insensitively
  const getTierArray = (tierName: SuggestionTier): any[] => {
    if (Array.isArray(parsed[tierName])) return parsed[tierName];
    if (Array.isArray(parsed[tierName.toLowerCase()])) return parsed[tierName.toLowerCase()];
    if (Array.isArray(parsed[tierName.toUpperCase()])) return parsed[tierName.toUpperCase()];
    if (Array.isArray(parsed.suggestions)) return parsed.suggestions;
    return [];
  };

  const VALID_TYPES: Suggestion['type'][] = ['fact-check', 'question', 'insight'];

  for (const tier of tiers) {
    const rawList = getTierArray(tier);
    
    // Map existing cards or fallback to position
    const validated = VALID_TYPES.map((expectedType, index) => {
      // 1. Try finding by normalized type
      const foundByType = rawList.find((s: any) => normalizeSuggestionType(s.type) === expectedType);
      if (foundByType && foundByType.preview && foundByType.preview.trim()) {
        return {
          type: expectedType,
          preview: foundByType.preview.trim(),
          detailsHint: foundByType.detailsHint?.trim() || 'Click to explore this topic further.',
        };
      }

      // 2. Try by position in rawList
      const itemAtPos = rawList[index];
      if (itemAtPos && itemAtPos.preview && itemAtPos.preview.trim()) {
        return {
          type: expectedType,
          preview: itemAtPos.preview.trim(),
          detailsHint: itemAtPos.detailsHint?.trim() || 'Click to explore this topic further.',
        };
      }

      // 3. Smart contextual fallback
      const defaults: Record<Suggestion['type'], string> = {
        'fact-check': 'Verify scope, timelines, and measurable goals discussed in this segment.',
        'question': 'What are the main dependencies and next steps we need to align on before moving forward?',
        'insight': 'Ensure key decisions and ownership are clearly recorded for the team.',
      };

      return {
        type: expectedType,
        preview: defaults[expectedType],
        detailsHint: 'Click to expand this talking point.',
      };
    });

    out[tier] = { suggestions: validated, latencyMs };
  }

  return out;
}

// ─── AI Copilot Streaming Chat ────────────────────────────────────────────────

export async function streamGeminiChatResponse(
  userMessage: string,
  recentTranscript: string,
  summary: string,
  chatHistory: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  model = 'gemini-3.6-flash',
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void
): Promise<void> {
  const startMs = Date.now();

  const systemInstruction = [
    systemPrompt,
    summary ? `\n\nMeeting Summary Context:\n${summary}` : '',
    `\n\nRecent Transcript:\n${recentTranscript}`,
  ].join('');

  const contents: GeminiContent[] = [
    // Include last 10 messages for conversation memory
    ...chatHistory.slice(-10).map((m) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  await streamGeminiApi(
    model,
    apiKey,
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048,
      },
    },
    onToken,
    onDone,
    startMs
  );
}

// ─── Detailed Answer Streaming ────────────────────────────────────────────────

export async function streamGeminiDetailedAnswer(
  suggestion: Suggestion,
  recentTranscript: string,
  summary: string,
  detailedAnswerPrompt: string,
  apiKey: string,
  model = 'gemini-3.6-flash',
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void
): Promise<void> {
  const startMs = Date.now();

  const prompt = detailedAnswerPrompt
    .replace('{type}', suggestion.type)
    .replace('{preview}', suggestion.preview)
    .replace('{summary}', summary || 'No prior summary.')
    .replace('{recentTranscript}', recentTranscript);

  await streamGeminiApi(
    model,
    apiKey,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    },
    onToken,
    onDone,
    startMs
  );
}

// ─── Rolling Summary ──────────────────────────────────────────────────────────

export async function generateGeminiSummary(
  transcriptText: string,
  summaryPrompt: string,
  apiKey: string,
  model = 'gemini-3.6-flash'
): Promise<string> {
  const prompt = summaryPrompt.replace('{transcript}', transcriptText);

  const data = await callGeminiApi(model, apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 800,
    },
  });

  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

// ─── Final Meeting Report ─────────────────────────────────────────────────────

export async function generateGeminiMeetingReport(
  fullTranscript: string,
  prompt: string,
  apiKey: string,
  model = 'gemini-3.6-flash'
): Promise<MeetingReport> {
  const filledPrompt = prompt.replace('{transcript}', fullTranscript);

  const data = await callGeminiApi(model, apiKey, {
    contents: [{ role: 'user', parts: [{ text: filledPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 3000,
      responseMimeType: 'application/json',
    },
  });

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(text) as MeetingReport;
}

// ─── Fact-Checking ────────────────────────────────────────────────────────────

export async function geminiFactCheckSegment(
  text: string,
  prompt: string,
  apiKey: string,
  model = 'gemini-3.6-flash'
): Promise<FactCheck[]> {
  const filledPrompt = prompt.replace('{text}', text);

  try {
    const data = await callGeminiApi(model, apiKey, {
      contents: [{ role: 'user', parts: [{ text: filledPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
      },
    });

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(raw) as { factChecks: FactCheck[] };
    return parsed.factChecks || [];
  } catch (err) {
    console.error('Gemini fact check failed:', err);
    return [];
  }
}
