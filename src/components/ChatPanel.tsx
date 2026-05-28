'use client';

import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { ChatMessage } from '@/types';
import { formatTimestamp } from '@/lib/utils';
import styles from './ChatPanel.module.css';

// Lightweight markdown renderer — handles bold, italic, inline code,
// code blocks, headers (## / ###), and bullet lists.
function renderMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Code blocks ```...```
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code `...`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // ## Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold **...**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *...*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet list lines (- item or * item)
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, (match) => {
      // Only wrap if not already inside a ul (simple heuristic)
      return `<ul>${match}</ul>`;
    })
    // Numbered list (1. item)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Double newline → paragraph break
    .replace(/\n\n/g, '</p><p>')
    // Single newline → <br> (only outside block elements)
    .replace(/\n(?!<\/?(ul|li|pre|h[2-4]|p))/g, '<br>')
    // Wrap in paragraph if not starting with a block element
    .replace(/^(?!<(h[2-4]|ul|pre|p))/, '<p>')
    // wrap any trailing text
    + (text.endsWith('\n') ? '' : '');
}

const QUICK_PROMPTS = [
  'Summarize the key points so far',
  'What are the main risks or concerns?',
  'What decisions were made?',
  'What are the action items?',
  'What should I say next?',
  'What\'s the strongest counterargument?',
];

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  onSendMessage: (text: string) => void;
}

export function ChatPanel({ messages, isStreaming, error, onSendMessage }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    onSendMessage(text);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isStreaming) return;
    onSendMessage(prompt);
    inputRef.current?.focus();
  };

  const handleFollowUp = (question: string) => {
    if (isStreaming) return;
    setInput(question);
    inputRef.current?.focus();
  };

  const charCount = input.length;
  const isEmpty = messages.length === 0;

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.icon}>🔍</span>
        <h2 className={styles.title}>Search Meeting</h2>
        {isStreaming && <span className={styles.streamingPill}>Searching…</span>}
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.scrollArea}>
        {/* ── Empty state with smart quick prompts ─────────────────────── */}
        {isEmpty && !isStreaming && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🤖</div>
            <p>Ask anything about the conversation, or pick a quick prompt:</p>
            <div className={styles.quickPromptsGrid}>
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  className={styles.quickPromptBtn}
                  onClick={() => handleQuickPrompt(q)}
                  disabled={isStreaming}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Message list ──────────────────────────────────────────────── */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.assistantMsg}`}
          >
            <div className={styles.msgMeta}>
              <span className={styles.msgRole}>{msg.role === 'user' ? 'You' : 'ConvoIQ'}</span>
              <span className={styles.msgTime}>{formatTimestamp(msg.timestamp)}</span>
              {msg.latencyMs && (
                <span className={styles.msgLatency} title="Time to first token">
                  {msg.latencyMs < 1000 ? `${msg.latencyMs}ms` : `${(msg.latencyMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>

            {/* Message body — markdown rendered for assistant, plain for user */}
            {msg.role === 'assistant' ? (
              <div
                className={`${styles.msgContent} ${styles.markdownContent}`}
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    ? renderMarkdown(msg.content)
                    : `<span class="${styles.cursor}"></span>`,
                }}
              />
            ) : (
              <div className={styles.msgContent}>{msg.content}</div>
            )}

            {/* ── Follow-up question chips ──────────────────────────────── */}
            {msg.role === 'assistant' && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
              <div className={styles.followUps}>
                <span className={styles.followUpsLabel}>Ask next:</span>
                <div className={styles.followUpsRow}>
                  {msg.followUpQuestions.map((q, i) => (
                    <button
                      key={i}
                      className={styles.followUpChip}
                      onClick={() => handleFollowUp(q)}
                      disabled={isStreaming}
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            id="chat-input"
            className={styles.input}
            placeholder="Ask anything from this meeting… (e.g. 'What did we decide about deployment?')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            aria-label="Chat input"
          />
          {charCount > 0 && (
            <span className={styles.charCount}>{charCount}</span>
          )}
        </div>
        <button
          id="chat-send-btn"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          aria-label="Send message"
        >
          ↑
        </button>
      </footer>
    </aside>
  );
}
