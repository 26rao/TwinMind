# ConvoIQ Live Copilot

A premium, always-on AI meeting copilot built with **Next.js**, powered by **Groq's LPU infrastructure** for ultra-low latency transcription and real-time suggestions.

## ⚡ Key Features

- 🎙️ **Live Transcription**: Auto-transcribe in 30-second chunks via Groq Whisper (Large V3, Turbo, or Distil variants)
- ⚡ **Real-Time Suggestions**: 3 contextual, high-value suggestions every 30s
  - **Questions**: Non-obvious, insight-revealing questions
  - **Fact-Checks**: Verify or correct specific claims  
  - **Talking Points**: Compelling angles not yet raised
  - **Answers**: Direct responses to questions just asked
  - **Clarifications**: Resolve ambiguities or contradictions
- 🛡️ **Live Fact-Check Mode** (toggle with shield icon): Automatically identifies and verifies factual claims, numbers, dates, and metrics in real-time
- 💬 **Streaming Chat**: Ask follow-up questions with full meeting context and get intelligent answers
- 🧠 **Session Continuity**: Resume conversations with the same client—access previous notes, pending tasks, and discussion topics
- 📊 **Meeting Reports**: Structured summaries with key points, decisions, open questions, risks, and action items
- 📁 **Export Options**: Download as JSON, Markdown, or email-ready format
- 📝 **Demo Mode**: Inject sample conversation chunks instantly to test suggestions without live recording

## Live Demo
🚀 https://twin-mind-three.vercel.app/


## 🏗 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR-ready, excellent DX, Vercel-native |
| Styling | Vanilla CSS Modules | Full control, zero runtime overhead |
| **Transcription** | Groq Whisper (v3, Turbo, Distil) | Fastest available STT; choice of accuracy vs. speed |
| **LLM (Suggestions)** | Groq OSS/Llama/Gemma | Multiple options: 120B MoE, 70B, or 8B for speed |
| Fonts | Outfit + JetBrains Mono (Google Fonts) | Premium feel, monospace for timestamps |
| State | React hooks + localStorage | No backend needed, instant persistence |

### Available Models (Settings)

**Transcription Models:**
- Whisper Large V3 (best accuracy)
- Whisper Large V3 Turbo (faster)
- Distil Whisper (English-only, fastest)

**LLM Models:**
- GPT-OSS 120B (Recommended — 200+ t/s, 131k context)
- Llama 3.3 70B Versatile
- Llama 3.1 8B Instant (fastest)
- Gemma 2 9B

## Setup

```bash
# 1. Clone and install
git clone https://github.com/26rao/TwinMind
cd TwinMind
npm install

# 2. Run dev server
npm run dev
# → Open http://localhost:3000

# 3. Enter your Groq API key in the Settings modal (auto-opens on first visit)
```

You can get a free Groq API key at [console.groq.com](https://console.groq.com).

## Architecture

```
src/
├── app/
│   ├── layout.tsx             # Root layout: fonts, SEO, SettingsProvider
│   ├── page.tsx               # Main page: 3-column orchestrator + session continuity
│   └── globals.css            # Design tokens, reset, background gradients
├── components/
│   ├── TranscriptPanel        # Left: mic, auto-scroll, 30s chunks, demo mode
│   ├── SuggestionsPanel       # Middle: batched suggestion cards (auto-refresh every 30s)
│   ├── SuggestionCard         # Clickable card with type badge, expandable details
│   ├── ChatPanel              # Right: streaming chat with context-aware quick prompts
│   ├── LatencyBar             # Visual performance metric display
│   ├── SettingsModal          # Groq API key, LLM model, transcription model, prompts
│   ├── SessionSnapshot        # 🧠 Banner: last meeting snapshot + resume options
│   ├── ContinuationAssistant  # 🧠 Modal: full session history + smart follow-ups
│   └── FactCheckRow           # Live fact-check display under each transcript segment
├── context/
│   └── SettingsContext        # Global settings + localStorage persistence
├── hooks/
│   ├── useAudioRecorder       # MediaRecorder, 30s chunking, Whisper integration
│   ├── useSuggestions         # Auto-refresh every 30s + manual refresh
│   ├── useChat                # Streaming chat and suggestion expansion
│   ├── useRollingSummary      # Compresses old chunks into dense, fact-rich summary
│   └── useSessionContinuity   # 🧠 Client selection, snapshot gen, history mgmt
├── lib/
│   ├── groq.ts                # All Groq API calls (transcription, suggestions, chat, fact-check, reports)
│   ├── defaults.ts            # Engineered prompts for suggestions, summaries, fact-checks, reports
│   ├── sessionStorage.ts      # 🧠 localStorage for session history per client
│   └── utils.ts               # Export, ID generation, formatting, download helpers
└── types/
    └── index.ts               # Domain types: Suggestion, FactCheck, MeetingSession, etc.
```

### Component Responsibilities

**TranscriptPanel**
- Audio recording toggle (start/stop)
- Live duration counter
- Demo mode: inject sample chunks for testing
- Fact-check toggle (🛡️ shield icon) to enable/disable live fact-checking
- Manual refresh trigger
- Segment display with fact-checks

**SuggestionsPanel**
- Displays batches of 3 suggestions every 30s
- Each suggestion is clickable to expand with full details
- Auto-refresh mechanism synchronized with transcription chunks

**ChatPanel**
- Streaming message display
- Quick-prompt buttons (context-aware suggestions)
- Input for follow-up questions
- Full meeting context injected into each message

**SettingsModal**
- Groq API key configuration
- LLM model selection
- Transcription model selection
- Custom prompt editing (suggestions, summaries, fact-checks, reports)

**SessionSnapshot & ContinuationAssistant** (🧠)
- Display last meeting with client
- Resume with pending tasks, unresolved decisions, or specific discussion topics
- Smart continuation prompts auto-generated from previous session

## 📖 UI Tour: Controls & Icons

### TranscriptPanel (Left Column)
| Control | Icon | Purpose |
|---------|------|---------|
| Start/Stop | `● / ⏹` | Begin or end recording |
| Refresh | `↻` | Finalize current chunk + regenerate suggestions |
| **Fact-Check** | **🛡️** | **Toggle live fact-checking mode** — identifies and verifies claims automatically |
| Demo Mode | `📝` | Enable demo mode to inject sample transcripts without recording |

### Suggestion Types & Badges
- **❓ Question**: Reveals gaps, forces clearer thinking
- **✓ Fact-Check**: Corrects or adds precision to claims
- **💡 Talking Point**: New angles or counterpoints
- **📌 Answer**: Direct response to a question just asked
- **❕ Clarification**: Resolves ambiguities or contradictions

### Quick Export Options
- **⬇️ JSON**: Full structured data (segments, suggestions, metadata)
- **⬇️ Markdown**: Formatted report with key points, decisions, action items
- **⬇️ Email**: Plain-text draft ready to paste into email client

## 🧠 Prompt Strategy

### Design Philosophy

Each prompt is engineered to:
1. **Deliver competitive advantage** — not generic advice, not textbook recaps
2. **Stay grounded in transcript** — every insight must reference specific claims, numbers, names from the meeting
3. **Vary form and depth** — suggestions alternate types; summaries are dense and information-rich
4. **Enable quick decisions** — previews are 1–2 sentences you could say aloud right now

### Suggestion Prompt (v3)

**Why it works:**
- Enforces exactly 3 suggestions with different types (never 3 questions)
- Each must deliver a concrete edge: a sharp question, verified fact, or complete answer
- Preview text is "immediately valuable" — 1–2 sentences someone could use without clicking
- References specific claims, numbers, or topics from the meeting

**Example Output:**
```json
{
  "suggestions": [
    {
      "type": "fact-check",
      "preview": "You mentioned Q2 revenue growth of 18%, but your YoY data shows 16%—verify which number is correct.",
      "detailsHint": "Check financial reconciliation and clarify Q2 baseline"
    },
    {
      "type": "question",
      "preview": "Who owns the deployment risk if the API integration timeline slips by 2 weeks?",
      "detailsHint": "Discuss fallback plans and escalation path"
    },
    {
      "type": "talking-point",
      "preview": "Consider staging the UI redesign to avoid blockers—phase 1 could land in 3 weeks with current team.",
      "detailsHint": "Break down the phased approach and resource allocation"
    }
  ]
}
```

### Fact-Check Prompt

**When enabled (🛡️):**
- Scans each transcript segment for factual claims: numbers, dates, metrics, names, scientific facts
- Classifies each claim as:
  - ✅ **Verified**: Known to be true
  - ⚠️ **Uncertain**: Needs verification
  - ❌ **Incorrect**: Known to be false (often a misstatement in the meeting)
- Provides 1-sentence expert explanation

**Example:**
```json
{
  "factChecks": [
    {
      "claim": "AWS S3 pricing dropped 30% last quarter",
      "status": "uncertain",
      "explanation": "AWS typically adjusts pricing annually; verify date and specific service tier"
    },
    {
      "claim": "Our API serves 2M requests/day",
      "status": "verified",
      "explanation": "Consistent with Q1 metrics dashboard; no recent spike"
    }
  ]
}
```

### Summary Prompt

**Why dense summaries matter:**
- 4–6 hyper-informative sentences
- Captures names, numbers, dates, decisions, blockers, and unresolved points
- No filler — every sentence encodes actionable intelligence
- Used as context for future suggestions and chat responses

### Report Prompt

Extracts:
- **Key Points**: Top 5 themes
- **Decisions**: Specific agreements reached
- **Open Questions**: Unresolved issues
- **Risks**: Potential blockers
- **Action Items**: Tasks with owners and deadlines (if mentioned)

### Context Window Strategy

| Operation | Context Used | Rationale |
|---|---|---|
| Suggestions | Last 3,000 chars (~500 words) | Hyper-relevant to what's happening *right now* |
| Chat | Last 12,000 chars + prior 10 messages | Balances memory with latency |
| Fact-Checks | Current segment (~1–2 paragraphs) | Focused verification without noise |
| Reports | Full transcript | Comprehensive analysis for export |

## 🧠 Session Continuity Assistant (NEW)

Never start a meeting from scratch again. ConvoIQ now remembers past conversations with the same client and helps you resume seamlessly.

### How It Works

1. **First Meeting with Client ABC Corp**
   - Start recording, get suggestions, auto-save when you stop
   - System captures: pending tasks, unresolved decisions, discussion topics, risks

2. **Second Meeting with ABC Corp**
   - SessionSnapshot banner appears at top:
     ```
     📌 Continuing from last meeting with ABC Corp
     Pending: API integration, UI redesign
     Unresolved: Deployment strategy
     ⚠ Risks: Timeline unclear
     ```
   - Click **"View Summary"** → Modal shows full context:
     - Overall meeting summary
     - Key takeaways
     - Pending tasks with owners & deadlines
     - Unresolved decisions
     - Discussion topics (clickable to continue)
   - Click **"Resume Topics"** → AI generates smart continuation questions:
     - "Have we finalized the deployment approach?"
     - "Who is handling scalability testing?"
   - Click any suggestion → Auto-fills chat with full context

### What Gets Saved

When you stop recording, the system extracts and stores:
- **Pending Tasks**: `{ task, owner, deadline }`
- **Unresolved Decisions**: `{ decision, context }`
- **Risks**: Array of identified blockers
- **Discussion Topics**: `{ topic, summary, suggestedNextSteps }`
- **Key Takeaways**: Top 3-5 insights from the meeting

### Technical Details

**Storage**: `localStorage` organized by client ID
```json
{
  "clientId": "abc_corp",
  "clientName": "ABC Corp",
  "meetings": [
    {
      "id": "...",
      "date": "2026-04-27",
      "summary": "...",
      "pendingTasks": [...],
      "unresolvedDecisions": [...],
      "risks": [...],
      "discussionTopics": [...]
    }
  ]
}
```

**Continuation Questions Prompt**: Uses LLM to generate 3 smart follow-up questions from:
- Unresolved items from last meeting
- Pending tasks and their owners
- Identified risks
- Key discussion topics

This ensures every new meeting picks up momentum instead of rehashing old ground.

## ⏱ Performance & Latency

ConvoIQ includes built-in latency monitoring visible in the UI:

- **Suggestion Latency**: Time from refresh trigger to first suggestion card rendered
- **Chat Latency**: Time from message send to first response token
- **Transcription Latency**: Time from audio chunk to final transcript segment

The **LatencyBar** component displays these metrics at the bottom of the UI, helping you understand how fast your LLM + Groq setup is performing.

### Typical Performance (with Groq)

| Operation | Expected Latency | Why Fast |
|-----------|-----------------|----------|
| Transcription (30s audio) | ~500–1000ms | Groq Whisper on LPU |
| Suggestion generation | ~800–1500ms | Groq LLM with 3,000-char context |
| Chat response (first token) | ~400–800ms | Streaming; Groq LPU parallelism |
| Fact-check (per segment) | ~300–600ms | Smaller context window |

## 🚀 Quick Start

1. **Clone & install**
   ```bash
   npm install
   npm run dev
   # → http://localhost:3000
   ```

2. **Get a free Groq API key** at [console.groq.com](https://console.groq.com)

3. **Open Settings** (auto-opens on first visit) and paste your API key

4. **Test with Demo Mode** (📝 button):
   - Load a pre-built scenario
   - Or paste sample transcript text
   - See suggestions and fact-checks in real-time

5. **Go live**: Click **● Start** to begin recording your next meeting

## 🔧 Configuration

### Settings Modal

Edit directly in the UI without restarting:

- **Groq API Key**: Required
- **LLM Model**: Switch between GPT-OSS 120B, Llama, or Gemma
- **Transcription Model**: Choose accuracy (Whisper V3) vs. speed (Turbo, Distil)
- **Custom Prompts**: Edit suggestion, summary, fact-check, and report prompts
- **Context Windows**: Adjust how much history is used for each operation

All settings auto-save to localStorage.

## ⚠️ Tradeoffs

- **No backend** — All API calls go direct from browser to Groq. This is fine for this prototype; a production version would proxy through a backend to protect keys.
- **MediaRecorder chunking** — Web Audio API chunks every 30s by stopping+restarting the recorder. This avoids streaming audio, keeping complexity low at acceptable latency.
- **JSON response format** — Suggestions use Groq's JSON mode to guarantee parseable output. This adds a tiny token cost but eliminates prompt-injection/parse failures.
- **localStorage** — Settings & sessions persist across sessions but not across browsers/devices. Acceptable for this scope.
- **No video** — Audio-only transcription keeps scope focused and reduces compute. Video features could be added later.
