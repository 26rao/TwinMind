# TwinMind Project Breakdown

TwinMind is a high-performance, real-time AI meeting copilot. It utilizes a 3-column architecture (Transcript, Suggestions, Chat) and is built with **Next.js 15**, **TypeScript**, and **Vanilla CSS Modules**.

## 🏗️ Core Architecture

### 1. Data Flow
1.  **Audio Capture**: `MediaRecorder` captures audio in 30-second "chunks".
2.  **Transcription**: Chunks are sent to Groq's **Whisper Large V3** in parallel.
3.  **Context Management**: 
    - The **Rolling Summary** engine compresses older chunks into a 3-5 sentence summary.
    - The **Recent Context** window keeps the last few chunks as raw text.
4.  **Inference**:
    - **Suggestions**: Every 30s (or manual refresh), the LLM analyzes the summary + recent text to generate 3 high-value suggestion cards.
    - **Chat/Expansion**: When a user clicks a card or types a question, the LLM uses the full context to provide an expert-level response.

### 2. Tech Stack
- **Framework**: Next.js (App Router).
- **Styling**: Vanilla CSS (CSS Modules) for zero-runtime overhead and maximum performance.
- **AI Provider**: Groq Cloud (API).
- **State**: React Context (`SettingsProvider`) + `localStorage` for persistent settings.

---

## 🪝 Logic & Hooks (`src/hooks/`)

### `useAudioRecorder.ts`
Handles the microphone lifecycle. It manages 30-second chunk rotation and triggers transcription. It includes "Demo Mode" support to inject pre-written text for testing.

### `useRollingSummary.ts`
The "brain" of context management. It prevents the LLM from getting "overwhelmed" by long transcripts by summarizing historical data while keeping the most recent data raw and precise.

### `useSuggestions.ts`
The engine that generates the middle column. It ensures exactly 3 suggestions are returned, validates their format, and tracks "Time to Suggestion" (latency).

### `useChat.ts`
Manages the interactive chat session, including streaming tokens from the API for an "instant" feel. It also handles the logic for expanding a suggestion card into a full assistant response.

---

## 🎨 UI Components (`src/components/`)

- **`TranscriptPanel`**: The left column. Contains recording controls, the live timer, and the Demo Scenario selector.
- **`SuggestionsPanel`**: The middle column. Features a "Latest" batch badge and a collapsible history of previous suggestion batches.
- **`ChatPanel`**: The right column. A clean, streaming chat interface for deep-diving into topics.
- **`LatencyBar`**: A performance monitor at the bottom that shows TPM/latency metrics to ensure the system is responsive.
- **`SettingsModal`**: A tabbed interface for managing API keys, selecting models (LLM/Whisper), and tuning prompt variables.

---

## 🧠 Prompt Engineering Strategy (`src/lib/defaults.ts`)

TwinMind doesn't just "ask an LLM." It uses specific frameworks:
1.  **Advantage Framing**: Suggestions are instructed to give the user a "competitive edge," avoiding generic observations.
2.  **Never-Punt Policy**: The Chat system is instructed to *infer* context if the transcript is thin, rather than saying "I don't know."
3.  **JSON Mode**: Suggestions are returned as structured JSON to ensure badges (Fact-check, Question, etc.) render perfectly every time.
