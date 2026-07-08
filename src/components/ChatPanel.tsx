'use client';

import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { ChatMessage } from '@/types';
import {
  formatTimestamp,
  downloadMarkdownFile,
  downloadTextFile,
  printMessageToPDF,
} from '@/lib/utils';
import styles from './ChatPanel.module.css';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Robust markdown renderer supporting tables, headers, lists, code blocks, bold/italics
function renderMarkdown(text: string): string {
  if (!text) return '';

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // 1. Extract code blocks
  let html = text.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(code);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 2. Extract inline code
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(code);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // 3. Process tables
  const lines = html.split('\n');
  let inTable = false;
  let tableRows: string[] = [];
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      // Skip delimiter row (e.g. |---|---| or | :--- | ---: |)
      if (line.match(/^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/)) {
        continue;
      }
      const cols = line
        .split('|')
        .map(c => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      const isHeader = tableRows.length === 0;
      const colTag = isHeader ? 'th' : 'td';
      const rowContent = cols.map(c => `<${colTag}>${c}</${colTag}>`).join('');
      tableRows.push(`<tr>${rowContent}</tr>`);
    } else {
      if (inTable) {
        processedLines.push(`<div class="table-wrapper"><table><tbody>${tableRows.join('')}</tbody></table></div>`);
        inTable = false;
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable) {
    processedLines.push(`<div class="table-wrapper"><table><tbody>${tableRows.join('')}</tbody></table></div>`);
  }
  html = processedLines.join('\n');

  // 4. Headers and block elements
  html = html
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bullet lists
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Bold / Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Paragraph breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n(?!<\/?(ul|li|pre|h[2-4]|p|div|table|tr|th|td))/g, '<br>')
    .replace(/^(?!<(h[2-4]|ul|pre|p|div|table))/, '<p>');

  // 5. Restore inline code
  html = html.replace(/__INLINE_CODE_(\d+)__/g, (_, idx) => {
    return `<code>${escapeHtml(inlineCodes[Number(idx)])}</code>`;
  });

  // 6. Restore code blocks
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return `<pre><code>${escapeHtml(codeBlocks[Number(idx)])}</code></pre>`;
  });

  return html;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadMd = (content: string, timestamp: number) => {
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    const filename = `copilot_response_${dateStr}.md`;
    downloadMarkdownFile(content, filename);
  };

  const handleDownloadTxt = (content: string, timestamp: number) => {
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    const filename = `copilot_response_${dateStr}.txt`;
    downloadTextFile(content, filename);
  };

  const handleDownloadPdf = (content: string, timestamp: number, role: string) => {
    const rendered = renderMarkdown(content);
    printMessageToPDF(rendered, timestamp, role);
  };

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
          {error}
        </div>
      )}

      <div className={styles.scrollArea}>
        {/* ── Empty state with smart quick prompts ─────────────────────── */}
        {isEmpty && !isStreaming && (
          <div className={styles.emptyState}>
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
              <>
                <div
                  className={`${styles.msgContent} ${styles.markdownContent}`}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      ? renderMarkdown(msg.content)
                      : `<span class="${styles.cursor}"></span>`,
                  }}
                />
                {msg.content && (
                  <div className={styles.msgActions}>
                    <button
                      className={styles.msgActionBtn}
                      onClick={() => handleCopy(msg.content, msg.id)}
                      title="Copy to clipboard"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      <span>{copiedId === msg.id ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button
                      className={styles.msgActionBtn}
                      onClick={() => handleDownloadMd(msg.content, msg.timestamp)}
                      title="Download as Markdown"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Markdown</span>
                    </button>
                    <button
                      className={styles.msgActionBtn}
                      onClick={() => handleDownloadTxt(msg.content, msg.timestamp)}
                      title="Download as Text"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                      <span>Text</span>
                    </button>
                    <button
                      className={styles.msgActionBtn}
                      onClick={() => handleDownloadPdf(msg.content, msg.timestamp, msg.role)}
                      title="Download as PDF"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                      </svg>
                      <span>PDF</span>
                    </button>
                  </div>
                )}
              </>
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
