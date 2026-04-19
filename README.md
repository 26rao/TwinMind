# TwinMind Live Copilot

A premium, always-on AI meeting copilot built with **Next.js**, powered by **Groq's LPU infrastructure** for ultra-low latency transcription and suggestions.

## Live Demo
🚀 https://twin-mind-three.vercel.app/


## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR-ready, excellent DX, Vercel-native |
| Styling | Vanilla CSS Modules | Full control, zero runtime overhead |
| Transcription | Groq Whisper Large V3 | Fastest available STT at high accuracy |
| LLM | Groq GPT-OSS 120B (`openai/gpt-oss-120b`) | 120B MoE, 200+ t/s on Groq LPU, 131k context |
| Fonts | Outfit + JetBrains Mono (Google Fonts) | Premium feel, monospace for timestamps |
| State | React hooks + localStorage | No backend needed, instant persistence |

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
│   ├── layout.tsx        # Root layout: fonts, SEO, SettingsProvider
│   ├── page.tsx          # Main page: orchestrates all 3 columns + global actions
│   └── globals.css       # Design tokens, reset, background gradients
├── components/
│   ├── TranscriptPanel   # Left column: mic, 30s chunks, auto-scroll
│   ├── SuggestionsPanel  # Middle column: batched suggestion cards
│   ├── SuggestionCard    # Clickable card with type badge and animations
│   ├── ChatPanel         # Right column: streaming chat
│   └── SettingsModal     # Full settings UI: key, prompts, context windows
├── context/
│   └── SettingsContext   # Global settings with localStorage persistence
├── hooks/
│   ├── useAudioRecorder  # MediaRecorder, 30s chunking, Whisper integration
│   ├── useSuggestions    # Auto-refresh + manual refresh, batch management
│   └── useChat           # Streaming chat and suggestion expansion
├── lib/
│   ├── groq.ts           # All Groq API calls (transcription, suggestions, chat)
│   ├── defaults.ts       # Default prompts, model IDs, type colors
│   └── utils.ts          # Export, ID generation, timestamp formatting
└── types/
    └── index.ts          # Shared TypeScript types
```

## Prompt Strategy

### Why these prompts work

**Suggestion Prompt**: Forces the model to vary suggestion types (question / fact-check / talking-point / answer / clarification) instead of defaulting to all-questions. The key design decision is that _preview_ text must be "stand-alone valuable" — i.e., even without clicking you learn something. The JSON response format allows per-type badge rendering.

**Detailed Answer Prompt**: Uses the full transcript as context but asks for structured output (headers, bullets). The `{type}` placeholder anchors the model to the correct lens (e.g. fact-check → cite sources; question → provide the answer).

**Chat System Prompt**: Kept intentionally terse. The full transcript is injected inline so the model "has been listening the whole time." Brevity in the prompt leaves more token budget for actual meeting content.

### Context Window Strategy

| Operation | Context Used | Rationale |
|---|---|---|
| Suggestions | Last 3,000 chars (~500 words) | Hyper-relevant to what's happening *right now* |
| Detailed Answers | Last 12,000 chars (~2000 words) | Needs more history to answer deeply |
| Chat | Last 12,000 chars of transcript + last 10 messages | Balances memory with latency |

## Tradeoffs

- **No backend** — All API calls go direct from browser to Groq. This is fine for this prototype; a production version would proxy through a backend to protect keys.
- **MediaRecorder chunking** — Web Audio API chunks every 30s by stopping+restarting the recorder. This avoids streaming audio, keeping complexity low at acceptable latency.
- **JSON response format** — Suggestions use Groq's JSON mode to guarantee parseable output. This adds a tiny token cost but eliminates prompt-injection/parse failures.
- **localStorage** — Settings persist across sessions but not across browsers/devices. Acceptable for this scope.
