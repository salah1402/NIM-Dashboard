import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle,
  Copy,
  Check,
  RotateCw,
  Pencil,
  Paperclip,
  Wrench,
  ArrowUp,
  Sparkles,
  ChevronDown,
  X,
  ExternalLink,
} from 'lucide-react';

const cleanContent = (content) => {
  if (!content) return '';
  return content
    .replace(/^(\\n)+/g, '')
    .replace(/^[\r\n]+/, '')
    .replace(/(\\n)+$/g, '')
    .replace(/[\r\n]+$/, '')
    .trim();
};

function CodeBlock({ language, value, onOpenArtifact }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const normLang = (language || '').toLowerCase().trim();
  const isArtifact =
    ['html', 'css', 'javascript', 'js', 'jsx', 'htm'].includes(normLang) ||
    value.includes('<!DOCTYPE') ||
    value.includes('<!doctype') ||
    value.includes('<html') ||
    value.includes('<button') ||
    value.includes('<script') ||
    value.includes('<style');

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-stone-800 bg-stone-950 text-stone-100 font-mono text-xs shadow-md not-prose">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-stone-900 border-b border-stone-800 text-[11px] text-stone-400">
        <span className="font-sans font-medium uppercase tracking-wider text-stone-300">
          {language || 'code'}
        </span>
        <div className="flex items-center space-x-2">
          {isArtifact && onOpenArtifact && (
            <button
              onClick={() => onOpenArtifact(value, language)}
              type="button"
              className="flex items-center space-x-1.5 text-stone-300 hover:text-white bg-stone-800 hover:bg-[#C96442] border border-stone-700 hover:border-[#C96442] px-2 py-0.5 rounded font-sans text-[11px] font-medium transition cursor-pointer shadow-xs group"
              title="Open in Live Artifact Preview"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C96442] group-hover:text-white" />
              <span>Open in Artifact</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center space-x-1.5 hover:text-white transition-colors text-stone-400 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-stone-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-stone-200">
        <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}

function ToolExecutionCard({ toolCall }) {
  const [copied, setCopied] = useState(false);
  const code = toolCall.code || '';
  const result = toolCall.result || '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-stone-800 bg-stone-950 text-stone-100 shadow-md font-mono text-xs not-prose w-full">
      {/* Tool Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-stone-900 border-b border-stone-800">
        <div className="flex items-center space-x-2">
          <span className="text-base">🛠️</span>
          <span className="font-sans font-semibold text-stone-200 text-xs">
            Python Interpreter
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 font-sans font-medium">
            Executed
          </span>
        </div>
        <button
          onClick={handleCopyCode}
          type="button"
          className="flex items-center space-x-1 text-[11px] text-stone-400 hover:text-white transition cursor-pointer px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700"
          title="Copy Python code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-stone-400" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Section */}
      <div className="p-3 bg-stone-950/90 text-stone-200 border-b border-stone-800/80 overflow-x-auto leading-relaxed">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-semibold mb-1">
          Python Input
        </div>
        <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-[12px]">
          <code>{code}</code>
        </pre>
      </div>

      {/* Stdout Result Section */}
      <div className="p-3 bg-black/50 text-emerald-400 overflow-x-auto leading-relaxed">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-semibold mb-1">
          Output (stdout)
        </div>
        <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-[12px] whitespace-pre-wrap">
          <code>{result || '(no output)'}</code>
        </pre>
      </div>
    </div>
  );
}

export default function ChatPane({
  conversation,
  messages,
  input,
  setInput,
  mode = 'auto',
  setMode,
  isStreaming,
  isSaving,
  onSendMessage,
  onOpenArtifact,
}) {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, isSaving]);

  // Auto-expand textarea up to 5 lines (~140px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, 44), 140)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming && !isSaving) {
        onSendMessage(e);
      }
    }
  };

  const handleCopyAssistant = (msgId, content) => {
    navigator.clipboard.writeText(cleanContent(content));
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleRegenerate = (asstIndex) => {
    if (isStreaming || isSaving) return;
    // Find the user prompt immediately preceding this assistant message
    for (let i = asstIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        onSendMessage(messages[i].content);
        return;
      }
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMsgId(msg.id);
    setEditPrompt(msg.content);
  };

  const handleSaveEdit = (e) => {
    if (e) e.preventDefault();
    if (!editPrompt.trim() || isStreaming || isSaving) return;
    const promptToSend = editPrompt.trim();
    setEditingMsgId(null);
    onSendMessage(promptToSend);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F9F9F8] text-[#1D1B1B] overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-3xl w-full mx-auto space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-16">
            <div className="w-12 h-12 rounded-2xl bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center text-[#C96442] mb-5 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-serif font-normal text-[#1D1B1B] tracking-tight">
              {conversation ? conversation.title : 'What would you like to explore today?'}
            </h2>
            <p className="text-sm text-stone-500 max-w-md mt-2 mb-8">
              Fast, high-fidelity responses powered by NVIDIA NIM flagship models with cascading failover.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {[
                'Create me a root map for students of PCMB after 12th',
                'Explain how 40 RPM per-slug cascading works',
                'Compare transformer attention vs state space models',
                'Write a complete Python web scraper using BeautifulSoup',
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-3.5 text-xs text-[#1D1B1B] bg-white hover:bg-[#F4F3EE] border border-[#E5E3DE] hover:border-stone-400 rounded-xl shadow-xs transition-all text-left cursor-pointer group"
                >
                  <span className="font-serif italic text-stone-400 mr-1.5 group-hover:text-[#C96442]">“</span>
                  <span className="font-normal">{prompt}</span>
                  <span className="font-serif italic text-stone-400 ml-1.5 group-hover:text-[#C96442]">”</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const cleaned = cleanContent(msg.content);
            const isFailed =
              msg.model_slug === 'error' ||
              cleaned.startsWith('⚠️') ||
              cleaned.toLowerCase().includes('all candidate models failed') ||
              cleaned.toLowerCase().includes('response failed:');

            const errorText = isFailed
              ? cleaned
                  .replace(/^⚠️\s*/, '')
                  .replace(/^\[⚠️\s*/, '')
                  .replace(/\]$/, '')
                  .replace(/^Response failed:\s*/i, '')
                  .trim()
              : cleaned;

            return (
              <div
                key={msg.id}
                className={`flex flex-col group ${isUser ? 'items-end' : 'items-start'} w-full`}
              >
                {/* User Message Header / Edit Action */}
                {isUser && (
                  <div className="flex items-center space-x-2 mb-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      title="Edit message"
                      className="inline-flex items-center space-x-1 text-[11px] text-stone-500 hover:text-[#1D1B1B] bg-white border border-[#E5E3DE] px-2 py-0.5 rounded-md shadow-xs cursor-pointer transition"
                    >
                      <Pencil className="w-3 h-3 text-stone-500" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}

                {/* Assistant Message Header: Model / Latency badge */}
                {!isUser && msg.model_slug && (
                  <div className="flex items-center space-x-2 mb-2 px-0.5 text-[11px] text-stone-500 font-sans">
                    <span
                      className={`inline-flex items-center font-mono px-2 py-0.5 rounded-md font-medium text-[11px] ${
                        isFailed
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-[#F0EFEA] text-stone-700 border border-[#E5E3DE]'
                      }`}
                    >
                      {msg.model_slug}
                    </span>
                    {msg.latency_ms != null && (
                      <span className="font-mono text-stone-400 text-[10.5px]">
                        {(msg.latency_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                )}

                {/* Failed Error Bubble */}
                {isFailed ? (
                  <div className="max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xs bg-rose-50 border border-rose-200 text-rose-900 flex items-start space-x-3">
                    <div className="p-1 rounded-md bg-rose-100 text-rose-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="font-semibold text-rose-800 text-xs uppercase tracking-wider">
                        Request Failed
                      </div>
                      <div className="text-rose-700 text-xs font-normal">
                        {errorText || 'All candidate models failed in cascade.'}
                      </div>
                    </div>
                  </div>
                ) : isUser ? (
                  /* User Message Bubble with Inline Edit Support */
                  editingMsgId === msg.id ? (
                    <div className="w-full max-w-xl bg-white border border-stone-300 rounded-2xl p-3 shadow-sm">
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={3}
                        className="w-full text-sm text-[#1D1B1B] bg-transparent focus:outline-none resize-none leading-relaxed"
                      />
                      <div className="flex items-center justify-end space-x-2 mt-2 pt-2 border-t border-stone-100 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingMsgId(null)}
                          className="px-3 py-1 rounded-lg text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-3.5 py-1 rounded-lg bg-[#1D1B1B] hover:bg-black text-white font-medium shadow-xs transition cursor-pointer"
                        >
                          Save & Submit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl px-4 py-2.5 rounded-2xl text-[14.5px] leading-relaxed break-words bg-[#F0EFEA] border border-[#E5E3DE]/60 text-[#1D1B1B] font-sans font-medium">
                      {cleaned}
                    </div>
                  )
                ) : (
                  /* Assistant Message: No background, Serif Typography */
                  <div className="w-full max-w-full">
                    {/* Render Tool Execution Cards if this message executed tools */}
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {msg.tool_calls.map((tc, tcIdx) => (
                          <ToolExecutionCard key={tcIdx} toolCall={tc} />
                        ))}
                      </div>
                    )}

                    {cleaned ? (
                      <div className="prose prose-stone max-w-none font-serif text-[#1D1B1B] text-[15.5px] leading-[1.75] prose-headings:font-serif prose-headings:font-normal prose-headings:text-[#1D1B1B] prose-p:my-3 prose-li:my-1 prose-pre:my-3">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre({ children }) {
                              return <>{children}</>;
                            },
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              const isCodeBlock = !inline && (match || String(children).includes('\n'));
                              if (isCodeBlock) {
                                return (
                                  <CodeBlock
                                    language={match ? match[1] : ''}
                                    value={String(children).replace(/\n$/, '')}
                                    onOpenArtifact={onOpenArtifact}
                                  />
                                );
                              }
                              return (
                                <code
                                  className="bg-[#F0EFEA] text-[#1D1B1B] text-xs px-1.5 py-0.5 rounded font-mono font-medium border border-[#E5E3DE]"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {cleaned}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      /* Thinking / Streaming Indicator */
                      <div className="flex items-center space-x-1.5 py-2 text-stone-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"></span>
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></span>
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        ></span>
                      </div>
                    )}

                    {/* Assistant Message Actions (Hover to reveal) */}
                    {cleaned && !isStreaming && (
                      <div className="flex items-center space-x-3 mt-2.5 pt-1 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopyAssistant(msg.id, cleaned)}
                          className="flex items-center space-x-1.5 text-xs text-stone-500 hover:text-[#1D1B1B] transition cursor-pointer"
                          title="Copy text"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerate(idx)}
                          className="flex items-center space-x-1.5 text-xs text-stone-500 hover:text-[#1D1B1B] transition cursor-pointer"
                          title="Regenerate response"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isSaving && (
          <div className="flex items-center space-x-2 text-xs text-stone-500 italic px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C96442] animate-ping"></span>
            <span>Saving to database...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Claude-style Expanding Input Box Area */}
      <footer className="p-4 bg-gradient-to-t from-[#F9F9F8] via-[#F9F9F8] to-transparent">
        <div className="max-w-3xl mx-auto">
          {/* Main Input Box Container */}
          <div className="relative rounded-2xl border border-stone-300 bg-white shadow-sm focus-within:border-stone-400 focus-within:shadow-md transition-all p-3">
            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                isStreaming
                  ? 'Generating response...'
                  : isSaving
                  ? 'Saving to SQLite...'
                  : 'Reply to NIM...'
              }
              disabled={isStreaming || isSaving}
              className="w-full bg-transparent text-sm text-[#1D1B1B] placeholder-stone-400 focus:outline-none resize-none leading-relaxed min-h-[44px] max-h-[140px] px-1 py-1"
            />

            {/* Input Bottom Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-1">
              <div className="flex items-center space-x-1 relative">
                {/* Paperclip Icon for future file uploads */}
                <button
                  type="button"
                  title="Attach file (coming soon)"
                  className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Tools & MCP Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowToolsMenu((prev) => !prev)}
                    title="Tools & MCP servers"
                    className="flex items-center space-x-1 p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer text-xs"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>

                  {/* Tools Dropdown Popover */}
                  {showToolsMenu && (
                    <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-stone-200 rounded-xl shadow-lg p-2 z-50 text-xs">
                      <div className="flex items-center justify-between px-2 py-1 border-b border-stone-100 mb-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                        <span>Tools & Capabilities</span>
                        <button
                          type="button"
                          onClick={() => setShowToolsMenu(false)}
                          className="hover:text-stone-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="px-2 py-1.5 rounded-lg text-stone-800 bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="font-medium text-xs">Code Interpreter</span>
                          </div>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">Active</span>
                        </div>
                        <div className="px-2 py-1.5 rounded-lg text-stone-600 hover:bg-stone-50 flex items-center justify-between">
                          <span>Web Search</span>
                          <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">Soon</span>
                        </div>
                        <div className="px-2 py-1.5 rounded-lg text-stone-600 hover:bg-stone-50 flex items-center justify-between">
                          <span>File Context</span>
                          <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">Soon</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Routing Mode Selector */}
                <div className="ml-2">
                  <select
                    value={mode}
                    onChange={(e) => setMode && setMode(e.target.value)}
                    disabled={isStreaming || isSaving}
                    className="bg-transparent text-stone-600 hover:text-[#1D1B1B] text-xs font-medium rounded-lg px-2 py-1 border border-transparent hover:border-stone-200 focus:outline-none focus:border-stone-300 cursor-pointer transition"
                  >
                    <option value="auto">Auto (Highest Capability)</option>
                    <option value="deep">Deep Reasoning (Tier 3)</option>
                    <option value="balanced">Balanced (Tier 2)</option>
                  </select>
                </div>
              </div>

              {/* Send Arrow Button */}
              <button
                type="button"
                onClick={onSendMessage}
                disabled={!input.trim() || isStreaming || isSaving}
                className="w-8 h-8 rounded-xl bg-[#1D1B1B] hover:bg-black disabled:bg-stone-200 disabled:text-stone-400 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                title="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Claude-style Disclaimer */}
          <p className="text-[11px] text-stone-400 text-center mt-2.5 tracking-tight font-sans">
            NIM Dashboard can make mistakes. Check important info.
          </p>
        </div>
      </footer>
    </div>
  );
}
