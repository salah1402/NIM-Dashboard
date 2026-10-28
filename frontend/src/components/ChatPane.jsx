import React, { useRef, useEffect } from 'react';

export default function ChatPane({
  conversation,
  messages,
  input,
  setInput,
  isStreaming,
  isSaving,
  onSendMessage,
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, isSaving]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-16">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-100">
              {conversation ? conversation.title : 'NIM Multi-Slug Router'}
            </h2>
            <p className="text-sm text-slate-400 max-w-md mt-1 mb-6">
              Ask anything to test SQLite persistence, token streaming, and automatic cascading across model slugs.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md text-left">
              {[
                'Hello from Phase 1 persistence test',
                'Explain how 40 RPM per-slug cascading works',
                'What models are available in tier 1?',
                'Simulate a conversation with auto-titling',
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(prompt)}
                  className="p-3 text-xs text-slate-300 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition text-left"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isFailed = msg.content?.startsWith('⚠️');

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-2 mb-1 px-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {isUser ? 'You' : 'NIM Assistant'}
                  </span>
                  {msg.model_slug && (
                    <span className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
                      <svg
                        className="w-3 h-3 mr-1 text-emerald-400 inline"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                        />
                      </svg>
                      {msg.model_slug}
                    </span>
                  )}
                  {msg.latency_ms != null && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {msg.latency_ms}ms
                    </span>
                  )}
                </div>

                <div
                  className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : isFailed
                      ? 'bg-amber-950/40 border border-amber-600/50 text-amber-200 rounded-bl-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.content || (
                    <div className="flex items-center space-x-1 py-1 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"></span>
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      ></span>
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      ></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isSaving && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 italic px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Saving to database...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <footer className="border-t border-slate-800 bg-slate-900/50 backdrop-blur p-4">
        <form
          onSubmit={onSendMessage}
          className="max-w-4xl mx-auto flex items-center space-x-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isStreaming
                  ? 'Streaming response...'
                  : isSaving
                  ? 'Saving to SQLite...'
                  : 'Type a message... (saved to ./data/nim.db)'
              }
              disabled={isStreaming || isSaving}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || isSaving}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 font-medium text-sm text-white transition shadow-lg shadow-emerald-900/20 flex items-center space-x-2"
          >
            <span>Send</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
