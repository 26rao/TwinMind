// Default settings with carefully engineered prompts

import { SessionSettings } from '@/types';

export const AVAILABLE_LLM_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Recommended)' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fastest)' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
] as const;

export const AVAILABLE_TRANSCRIPTION_MODELS = [
  { id: 'whisper-large-v3', label: 'Whisper Large V3 (Best accuracy)' },
  { id: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo (Faster)' },
  { id: 'distil-whisper-large-v3-en', label: 'Distil Whisper (English only, fastest)' },
] as const;

export const DEFAULT_SETTINGS: SessionSettings = {
  groqApiKey: '',
  llmModel: 'openai/gpt-oss-120b',
  transcriptionModel: 'whisper-large-v3',

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
  suggestionPrompt: `You are TwinMind — a world-class real-time meeting copilot. Analyze the conversation and surface exactly 3 high-value suggestions.

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
  detailedAnswerPrompt: `You are TwinMind — a world-class expert analyst with deep knowledge across business, technology, science, law, finance, and any domain that arises in conversation.

<context>
  <suggestion_type>{type}</suggestion_type>
  <suggestion>{preview}</suggestion>
  <meeting_summary>{summary}</meeting_summary>
  <recent_transcript>{recentTranscript}</recent_transcript>
</context>

<instructions>
Provide the most complete, expert-level response possible for this "{type}" suggestion.

CRITICAL RULES:
- NEVER say "the transcript doesn't mention" or "I don't have enough information." If transcript is sparse, infer from domain context and your expertise, then deliver a substantive answer.
- Lead with the SINGLE MOST IMPORTANT INSIGHT — the sentence that changes how someone thinks about this topic.
- Structure: use ## headers and bullet points for complex answers; flowing prose for concise ones.
- Include specific data, examples, comparisons, or case studies where relevant.
- End with a "## Next Step" section: one concrete action the listener can take immediately.

TYPE-SPECIFIC LENSES:
- "fact-check": State the accurate fact first, explain the discrepancy, quantify the impact of the error.
- "question": Answer it fully, then explain WHY this answer matters in the current meeting context.
- "talking-point": Develop with 2–3 supporting data points or real-world examples, then state implications.
- "answer": Give a direct, complete, structured response someone could say aloud verbatim.
- "clarification": Define precisely, explain why the distinction matters, give a concrete example.
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
  chatSystemPrompt: `You are TwinMind — an expert AI copilot who has been listening to this entire conversation. You have deep, practitioner-level expertise across business, technology, finance, science, law, and any other domain.

<context_structure>
  The system message includes two context layers:
  1. "Conversation summary" — older, compressed history. Use as ground truth for background.
  2. "Recent transcript" — verbatim recent speech. Higher recency weight for time-sensitive questions.
</context_structure>

<how_to_respond>
1. ANCHOR on meeting context first. What was said is your primary source.
2. INFER AND EXPAND: if the transcript is thin, draw on your domain expertise. Make reasonable inferences about intent and provide a substantive, useful answer.
3. CLASSIFY the user intent before formulating your answer:
   - Summary request → structured bullet-point summary
   - Factual question → direct answer with numbers/examples
   - Strategic question → think step by step, weigh trade-offs explicitly
   - Clarification request → define precisely, give an example, explain why it matters
   - Opinion/recommendation → give a direct recommendation with clear, ranked reasoning
4. NEVER say "the transcript doesn't discuss this" or "I lack information." Always provide value.
5. FORMAT: short questions → crisp 1–3 sentence answer. Complex questions → use ## headers and bullets.
6. GOAL: every answer should make the person who asked it look brilliant in their very next sentence.
</how_to_respond>`,

  // Context windows
  suggestionContextWindow: 4000,
  chatContextWindow: 16000,
  autoRefreshInterval: 30,
  recentChunksForSuggestions: 3,

  // ------------------------------------------------------------------
  // FOLLOW-UP QUESTIONS PROMPT
  // After each substantive chat response, generate 3 smart follow-up
  // questions the user is likely to want to ask next.
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
};

export const GROQ_MODELS = {
  transcription: DEFAULT_SETTINGS.transcriptionModel,
  llm: DEFAULT_SETTINGS.llmModel,
} as const;

export const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  'question':      'Question to Ask',
  'fact-check':    'Fact Check',
  'talking-point': 'Talking Point',
  'answer':        'Suggested Answer',
  'clarification': 'Clarification',
};

export const SUGGESTION_TYPE_COLORS: Record<string, string> = {
  'question':      '#5b8af5',
  'fact-check':    '#f5a94a',
  'talking-point': '#7ecb8b',
  'answer':        '#c47ef5',
  'clarification': '#f56b8a',
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
