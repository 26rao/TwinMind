// Default settings with carefully engineered prompts

import { SessionSettings } from '@/types';

export const AVAILABLE_LLM_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Recommended — 1,000,000 TPM Free Tier)' },
  { id: 'openai/gpt-oss-20b', label: 'Groq: GPT-OSS 20B (8k TPM free limit)' },
  { id: 'qwen/qwen3.6-27b', label: 'Groq: Qwen 3.6 27B' },
  { id: 'openai/gpt-oss-120b', label: 'Groq: GPT-OSS 120B' },
] as const;

export const AVAILABLE_TRANSCRIPTION_MODELS = [
  { id: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo (Fastest & Accurate — Recommended)' },
  { id: 'whisper-large-v3', label: 'Whisper Large V3 (Standard)' },
  { id: 'distil-whisper-large-v3-en', label: 'Distil Whisper (English only)' },
] as const;

export const DEFAULT_SETTINGS: SessionSettings = {
  groqApiKey: '',
  geminiApiKey: '',
  llmProvider: 'gemini',
  llmModel: 'gemini-3.6-flash',
  transcriptionModel: 'whisper-large-v3-turbo',
  promptVersion: 6,

  // ------------------------------------------------------------------
  // SUGGESTION PROMPT  v3
  //
  // Core design decisions:
  // 1. ADVANTAGE FRAMING: suggestions must give the listener a concrete
  //    conversational edge — not textbook knowledge, not generic bullets.
  //    The test: "If I said this out loud right now, would I sound smart?"
  // 2. TYPE DISCIPLINE: model fills each slot deliberately. We name the
  //    types explicitly so the model doesn't default to all-questions.
  // 3. PREVIEW = IMMEDIATELY USABLE: 1–2 sentences you could read aloud
  //    or act on without clicking. Anything vague fails.
  // 4. JSON response format: zero parse failures, enables per-type badge.
  // 5. Context = summary (older history) + raw recent chunks (relevance).
  // ------------------------------------------------------------------
  suggestionPrompt: `You are ConvoIQ — a world-class real-time meeting copilot. Analyze the conversation and surface exactly 3 high-value suggestions.

<context>
  <prior_summary>{summary}</prior_summary>
  <recent_transcript>{recentChunks}</recent_transcript>
</context>

<rules>
1. Output EXACTLY 3 suggestions — no more, no less.
2. Each suggestion must deliver a COMPETITIVE EDGE: a precise insight, a sharp question, a verified fact, or a complete answer.
3. BANNED: generic advice, vague encouragement, textbook recaps, restating what was said verbatim.
4. REQUIRED: every suggestion must reference specific claims, numbers, names, or topics from the transcript.
5. TYPE SELECTION — choose deliberately based on what the conversation most needs right now:
   - "question": A non-obvious, depth-revealing question that exposes a gap or forces clearer thinking.
   - "fact-check": Correct or add precision to a specific claim. State the accurate fact in the preview itself.
   - "talking-point": A compelling new angle, counterpoint, or insight not yet raised. Must be worth saying aloud.
   - "answer": A direct, complete answer to a question just asked. Self-contained, citable.
   - "clarification": Resolve an ambiguity, contradiction, or undefined term that is blocking understanding.
6. Vary types — never 3 of the same type.
7. Preview = 1–2 sentences that are IMMEDIATELY VALUABLE without any expansion. If the preview doesn't make the reader smarter on its own, rewrite it.
8. detailsHint = what a deep-dive expansion should focus on (not a repeat of the preview).
9. Return ONLY valid JSON. Absolutely no markdown fences, no prose, no explanation outside the JSON.
</rules>

<output_format>
{
  "suggestions": [
    { "type": "<type>", "preview": "<1–2 sentence insight that is immediately valuable>", "detailsHint": "<focused expansion target>" },
    { "type": "<type>", "preview": "<1–2 sentence insight>", "detailsHint": "<focused expansion target>" },
    { "type": "<type>", "preview": "<1–2 sentence insight>", "detailsHint": "<focused expansion target>" }
  ]
}
</output_format>`,

  // ------------------------------------------------------------------
  // ROLLING SUMMARY PROMPT
  // Dense compression of older chunks. Preserves facts, names, numbers.
  // ------------------------------------------------------------------
  summaryPrompt: `You are a precision meeting intelligence engine. Compress the transcript below into 4–6 dense, information-rich sentences.

Capture ALL of the following that appear:
- Key topics, themes, and the conversational arc
- Every decision made and who made it
- Specific numbers, dates, metrics, and named entities (people, companies, products)
- Open questions, blockers, and explicit action items
- Tensions, disagreements, or unresolved points

DO NOT include filler phrases, pleasantries, or meta-commentary. Every sentence must encode compressible intelligence that an AI assistant could use to answer specific questions about this meeting.

Transcript:
{transcript}

Return ONLY the summary text. No labels, no preamble, no trailing notes.`,

  // ------------------------------------------------------------------
  // DETAILED ANSWER PROMPT  v3
  //
  // Core design decisions:
  // 1. EXPERT FRAMING: the model is the smartest analyst in the room,
  //    not a search engine that can only repeat what was said.
  // 2. INFER & EXPAND: if the transcript is sparse or vague, use domain
  //    knowledge to provide a rich, complete answer. Never punt with
  //    "insufficient information" — infer, then answer.
  // 3. TYPE-SPECIFIC LENSES:
  //    - fact-check → provide the accurate fact with source context
  //    - question → answer it thoroughly with supporting points
  //    - talking-point → expand with data, examples, and implications
  //    - answer → be direct, structured, comprehensive
  //    - clarification → define terms, resolve ambiguity, propose standard
  // 4. STRUCTURE: lead with the single most valuable insight, then expand.
  // ------------------------------------------------------------------
  detailedAnswerPrompt: `You are ConvoIQ — a world-class expert analyst with deep knowledge across business, technology, science, law, finance, and any domain that arises in conversation.
 
<context>
  <suggestion_type>{type}</suggestion_type>
  <suggestion>{preview}</suggestion>
  <meeting_summary>{summary}</meeting_summary>
  <recent_transcript>{recentTranscript}</recent_transcript>
</context>
 
<instructions>
Provide a concise, expert-level response for this "{type}" suggestion.
 
CRITICAL RULES:
- BE BRIEF & STRUCTURED: Do not dump a large volume of text. Break your explanation down using headers, bullet lists, or tables. Keep paragraphs under 2 sentences.
- Lead with a bold "Key Takeaway" sentence that summarizes the core value of the suggestion.
- Structure: Use ## headers and structured lists. Use a Markdown table for any list of comparisons, metrics, or trade-offs.
- BANNED: Say "the transcript doesn't mention" or "I don't have enough information." If transcript is sparse, infer from domain context and your expertise.
- End with a "## Next Step" section: one concrete action the listener can take immediately.
</instructions>`,

  // ------------------------------------------------------------------
  // CHAT SYSTEM PROMPT  v3
  //
  // Core design decisions:
  // 1. EXPERT INFERENCE: the model must provide real answers even when
  //    the transcript is thin. It uses context clues and domain knowledge
  //    to infer likely meaning and respond substantively.
  // 2. NEVER PUNT: removing "if it wasn't discussed, say so" — instead,
  //    the model should lean into being the most helpful response possible.
  // 3. STRUCTURED CONTEXT: system message explicitly tells the model how
  //    the context is organized (summary vs. recent) so it knows which
  //    part is more reliable and how to weight them.
  // ------------------------------------------------------------------
  chatSystemPrompt: `You are ConvoIQ — an expert AI copilot who has been listening to this entire conversation. You have deep, practitioner-level expertise across business, technology, finance, science, law, and any other domain.

<context_structure>
  The system message includes two context layers:
  1. "Conversation summary" — older, compressed history. Use as ground truth for background.
  2. "Recent transcript" — verbatim recent speech. Higher recency weight for time-sensitive questions.
</context_structure>

<how_to_respond>
1. ANCHOR on meeting context first. What was said is your primary source.
2. KEEP IT CONCISE: Avoid long paragraphs and walls of text. Be punchy, clear, and direct. Keep responses brief (under 180 words) unless complex code/formulas are requested.
3. USE PREMIUM FORMATTING:
   - Key Takeaway: Begin with a brief, bolded "Key Takeaway" or "Summary" sentence.
   - Bullets: Use bullet points with **bolded lead words** for easier readability.
   - Tables: Present structured or comparative data in clean Markdown tables.
   - Paragraphs: Keep paragraphs to a maximum of 2 sentences.
4. INFER AND EXPAND: If the transcript is thin, draw on domain expertise to make reasonable inferences and provide a helpful, actionable answer.
5. NEVER say "the transcript doesn't discuss this" or "I lack information." Always provide value.
6. GOAL: Provide immediately usable insights that make the reader look brilliant.
</how_to_respond>`,

  // Context windows
  suggestionContextWindow: 4000,
  chatContextWindow: 16000,
  autoRefreshInterval: 30,
  recentChunksForSuggestions: 3,

  // ------------------------------------------------------------------
  // FACT-CHECK PROMPT
  // Analyzes a segment and extracts claims to verify.
  // ------------------------------------------------------------------
  factCheckPrompt: `You are a precision fact-checker. Analyze the transcript segment and identify key factual claims (numbers, dates, scientific facts, business metrics, names).
  
  For each claim:
  1. Determine status: "verified" (known true), "uncertain" (needs check), or "incorrect" (known false).
  2. Provide a 1-sentence expert explanation.
  
  Transcript Segment:
  "{text}"
  
  Return ONLY a JSON object:
  {
    "factChecks": [
      { "claim": "<claim text>", "status": "verified|uncertain|incorrect", "explanation": "<expert explanation>" }
    ]
  }
  If no substantive claims exist, return an empty list.`,

  // ------------------------------------------------------------------
  // REPORT PROMPT (Structured Summary + Action Items)
  // ------------------------------------------------------------------
  reportPrompt: `You are a world-class executive assistant. Generate a comprehensive, structured meeting report from the transcript.
  
  <transcript>
  {transcript}
  </transcript>
  
  Analyze the full transcript and extract:
  1. Key Points: The 5 most critical themes or topics.
  2. Decisions Made: Specific agreements or conclusions reached.
  3. Open Questions: Unresolved issues or questions asked but not answered.
  4. Risks: Potential blockers, threats, or concerns mentioned.
  5. Action Items: Tasks with clear owners and deadlines (if mentioned).
  
  Return ONLY a JSON object:
  {
    "keyPoints": ["..."],
    "decisions": ["..."],
    "openQuestions": ["..."],
    "risks": ["..."],
    "actionItems": [
      { "task": "...", "owner": "...", "deadline": "..." }
    ]
  }
  
  Be precise. Use professional language. If no action items are found, return an empty list.`,

  // ------------------------------------------------------------------
  // FOLLOW-UP QUESTIONS PROMPT
  // ------------------------------------------------------------------
  followUpQuestionsPrompt: `Given this AI assistant response in a meeting context, generate exactly 3 short, smart follow-up questions a meeting participant would genuinely want to ask next.
  
  Requirements:
  - Questions must be specific and non-obvious (not "Can you elaborate?")
  - Vary the angle: one drill-down, one counter-perspective or challenge, one action-oriented
  - Each question should be answerable in 1–2 sentences (no open-ended rabbit holes)
  - Keep each question under 12 words
  
  AI response:
  {response}
  
  Meeting summary:
  {summary}
  
  Return ONLY valid JSON. No markdown fences, no explanation.
  { "questions": ["<question 1>", "<question 2>", "<question 3>"] }`,

  // ------------------------------------------------------------------
  // SESSION SNAPSHOT PROMPT
  // Used to generate structured session continuity data from a meeting
  // ------------------------------------------------------------------
  sessionSnapshotPrompt: `You are a meeting intelligence analyst. From the provided meeting data, extract structured session continuity information.

Transcript Summary:
{summary}

Meeting Report:
{report}

Extract and return ONLY a JSON object with:
1. pendingTasks: Array of unfinished tasks with owners and deadlines
2. unresolvedDecisions: Array of decisions not yet finalized, with context
3. risks: Array of identified risks or blockers
4. discussionTopics: Array of main topics discussed with summaries and suggested next steps
5. keyTakeaways: Array of 3-5 most important takeaways

{
  "pendingTasks": [
    { "task": "...", "owner": "...", "deadline": "..." }
  ],
  "unresolvedDecisions": [
    { "decision": "...", "context": "..." }
  ],
  "risks": ["..."],
  "discussionTopics": [
    { "topic": "...", "summary": "...", "suggestedNextSteps": ["..."] }
  ],
  "keyTakeaways": ["..."]
}

Be concise and specific. Only include items explicitly mentioned or clearly inferred from the meeting.`,

  // ------------------------------------------------------------------
  // CONTINUATION SUGGESTIONS PROMPT
  // Generate smart questions to resume a conversation
  // ------------------------------------------------------------------
  continuationSuggestionsPrompt: `You are ConvoIQ's Smart Continuation Assistant. Generate exactly 3 continuation questions for resuming a meeting with the same client.

Last Meeting Summary:
{summary}

Pending Items:
- Tasks: {pendingTasks}
- Unresolved: {unresolvedDecisions}
- Risks: {risks}
- Topics: {topics}

Generate 3 specific, actionable continuation questions that:
1. Reference unresolved decisions or pending tasks
2. Show continuity from last time
3. Are ready to ask at the start of this meeting
4. Help the team pick up momentum without repeating old ground

Vary question types:
- One status update ("Have we...?")
- One decision-forcing ("Should we...?")
- One action-oriented ("Who will...?")

Return ONLY valid JSON:
{
  "questions": ["<question 1>", "<question 2>", "<question 3>"]
}

Keep each question under 15 words and directly actionable.`,
};

export const GROQ_MODELS = {
  transcription: DEFAULT_SETTINGS.transcriptionModel,
  llm: DEFAULT_SETTINGS.llmModel,
} as const;

export const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  'fact-check': '✅ Fact Check',
  'question':   '❓ Question to Ask',
  'insight':    '💡 Insight',
};

export const SUGGESTION_TYPE_COLORS: Record<string, string> = {
  'fact-check': '#f5a94a',   // amber
  'question':   '#5b8af5',   // blue
  'insight':    '#7ecb8b',   // green
};

// ------------------------------------------------------------------
// DEMO SCENARIOS
// Rich pre-built transcripts that unlock diverse, high-quality output.
// Each covers a different domain and conversation style.
// ------------------------------------------------------------------
export interface DemoScenario {
  id: string;
  label: string;
  emoji: string;
  chunks: string[];  // multiple chunks simulating a real conversation
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'strategy',
    label: 'Business Strategy',
    emoji: '📈',
    chunks: [
      `Okay so the core issue is we're burning about $180K a month in infrastructure costs and our gross margin is currently sitting at 43%. The board wants us to get to 60% gross margin by Q3 without cutting headcount. Sarah mentioned that our biggest cost driver is data egress fees from AWS — we moved to multi-region last year and it's costing us more than anticipated.`,
      `Right, and on the revenue side, we closed $2.1M ARR last quarter but our net revenue retention dropped to 94% which is concerning. Three enterprise clients churned — Acme Corp, DataStream, and NovaTech — all citing integration complexity as the primary reason. The sales team has been pitching the API-first story but customers are finding it harder to implement than we projected. We need to decide whether to build native integrations or double down on the API approach.`,
    ],
  },
  {
    id: 'technical',
    label: 'Technical Design',
    emoji: '🛠️',
    chunks: [
      `So the problem with our current architecture is we're doing synchronous database calls inside the request handler, which is why p99 latency is hitting 2.3 seconds. We're using PostgreSQL with connection pooling via PgBouncer but the pool size is set to 20 and we're seeing connection exhaustion during peak traffic. The team suggested moving to async IO with asyncpg but that would require rewriting most of the ORM layer.`,
      `The alternative is adding a Redis cache layer in front of the database for the top 20% of queries that account for 80% of the load. We benchmarked this on staging and it brings p99 down to 340 milliseconds. The concern is cache invalidation — we have some complex relational data where a single write can invalidate thousands of cache entries. Also worth noting that Priya mentioned switching to a CQRS pattern might solve this more elegantly long-term.`,
    ],
  },
  {
    id: 'science',
    label: 'Science Discussion',
    emoji: '🔬',
    chunks: [
      `The study showed that mRNA vaccines generated a stronger T-cell response compared to traditional protein subunit vaccines — specifically CD8+ cytotoxic T-cells increased 3.4-fold versus 1.8-fold in the control group. The duration of the immune response also lasted significantly longer, with measurable antibody titers at the 12-month mark in 87% of the mRNA group versus 52% in the control group.`,
      `What's interesting is the lipid nanoparticle delivery mechanism seems to be doing more than just protecting the mRNA from degradation. There's growing evidence that the LNPs themselves act as adjuvants, activating innate immune pathways through the STING pathway, which could explain the enhanced adaptive response. James mentioned that the pH-responsive ionizable lipids are particularly important here — they're neutral at physiological pH but become positively charged in the endosome, facilitating mRNA escape.`,
    ],
  },
  {
    id: 'negotiation',
    label: 'Sales / Negotiation',
    emoji: '🤝',
    chunks: [
      `The client is pushing back on the $240K annual contract. They're saying their budget ceiling is $180K and they want the same feature set. Their procurement lead, Mike, mentioned they have competing bids from Salesforce and a startup called Momentum. We know from the discovery call that their biggest pain point is sales forecasting accuracy — they're currently at 67% forecast accuracy and losing deals because of it.`,
      `The CEO mentioned they're planning to expand from 50 to 200 sales reps over the next 18 months. That's a significant land-and-expand opportunity. They also mentioned they had a bad experience with their previous vendor who oversold and underdelivered on implementation. Trust is the main buying factor right now, not price. Jenny from our team suggested offering a 90-day pilot with success metrics tied to forecast accuracy improvement as a way to de-risk the deal.`,
    ],
  },
  {
    id: 'interview',
    label: 'Job Interview',
    emoji: '💼',
    chunks: [
      `Tell me about your experience scaling distributed systems. In my last role at FinTech startup I led the migration from a monolithic Rails app to microservices. We went from handling 10,000 requests per minute to over 2 million with 99.97% uptime. The most challenging part was redesigning the data consistency model — we moved from ACID transactions to eventual consistency using Saga patterns for cross-service transactions.`,
      `The interviewer asked about my biggest technical failure. I shared that we had a major incident where a schema migration caused 4 hours of downtime during peak trading hours. The root cause was that we added a NOT NULL column without a default value to a table with 50 million rows on a hot Postgres instance. After that incident I implemented blue-green deployments and database migration linting as part of our CI pipeline. We also added feature flags to decouple deployments from feature releases.`,
    ],
  },
];
