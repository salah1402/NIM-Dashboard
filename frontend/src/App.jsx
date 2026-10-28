import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, checkHealth } from './api';

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to the NIM Dashboard. Enter a prompt to test simulated token streaming and multi-slug cascade routing.',
      model_slug: 'meta/llama-3.1-8b-instruct',
      latency_ms: 120,
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [backendHealth, setBackendHealth] = useState('checking');
  const [conversationId] = useState(() => 'conv-' + Math.random().toString(36).substring(2, 9));

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    checkHealth()
      .then((data) => {
        if (data && data.status === 'ok') {
          setBackendHealth('connected');
        } else {
          setBackendHealth('error');
        }
      })
      .catch(() => setBackendHealth('offline'));
  }, []);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsgId = 'user-' + Date.now();
    const assistantMsgId = 'asst-' + Date.now();

    const userMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
    };

    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model_slug: null,
      latency_ms: null,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setIsStreaming(true);

    try {
      await sendChatMessage({
        conversationId,
        message: trimmed,
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },
        onComplete: (data) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    model_slug: data.model_slug,
                    latency_ms: data.latency_ms,
                  }
                : msg
            )
          );
          setIsStreaming(false);
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: msg.content + `\n\n[Error: ${err.message}]`,
                    model_slug: 'error',
                  }
                : msg
            )
          );
          setIsStreaming(false);
        },
      });
    } catch (err) {
      console.error('Submission error:', err);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400">
            N
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-wide text-white">NIM Dashboard</h1>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Phase 0 Scaffold
              </span>
            </div>
            <p className="text-xs text-slate-400">Self-hosted NVIDIA NIM Multi-Slug Cascade Router</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="hidden sm:flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/60 text-slate-300">
            <span className="text-slate-400">Rate Limit:</span>
            <span className="text-emerald-400 font-semibold">40 RPM / Slug</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/60">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealth === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : backendHealth === 'checking'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-slate-300">
              API: {backendHealth === 'connected' ? '8000 OK' : backendHealth}
            </span>
          </div>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center space-x-2 mb-1 px-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                {msg.role === 'user' ? 'You' : 'NIM Assistant'}
              </span>
              {msg.model_slug && (
                <span className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
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
                <span className="text-[10px] font-mono text-slate-500">
                  {msg.latency_ms}ms
                </span>
              )}
            </div>

            <div
              className={`max-w-2xl px-4 py-3 rounded-xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
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
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="border-t border-slate-800 bg-slate-900/50 backdrop-blur p-4">
        <form
          onSubmit={handleSend}
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
                  : 'Type a message to test mock streaming...'
              }
              disabled={isStreaming}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 font-medium text-sm text-white transition-all shadow-lg shadow-emerald-900/20 flex items-center space-x-2"
          >
            <span>Send</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
