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
  Terminal,
  Code,
  Layers,
  Zap,
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

const ClaudeFlower = ({ className = "w-6 h-6", ...props }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="presentation" className={className} {...props}>
    <defs>
      <ellipse id="chat-petal" cx="100" cy="100" rx="90" ry="22" />
    </defs>
    <g fill="#10B981" fillRule="evenodd">
      <use href="#chat-petal" transform="rotate(0 100 100)" />
      <use href="#chat-petal" transform="rotate(45 100 100)" />
      <use href="#chat-petal" transform="rotate(90 100 100)" />
      <use href="#chat-petal" transform="rotate(135 100 100)" />
    </g>
  </svg>
);

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
    <div className="relative my-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 font-mono text-xs shadow-md not-prose">
      {/* Code Window Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
        <div className="flex items-center space-x-2">
          {/* macOS window control dots */}
          <div className="flex items-center space-x-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="font-sans font-medium uppercase tracking-wider text-zinc-300">
            {language || 'code'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {isArtifact && onOpenArtifact && (
            <button
              onClick={() => onOpenArtifact(value, language)}
              type="button"
              className="flex items-center space-x-1.5 text-zinc-200 hover:text-white bg-zinc-800 hover:bg-emerald-600 border border-zinc-700 hover:border-emerald-500 px-2.5 py-1 rounded-md font-sans text-[11px] font-medium transition cursor-pointer shadow-xs group"
              title="Open in Live Artifact Preview"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white transition-colors" />
              <span>Open in Artifact</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center space-x-1.5 hover:text-white transition-colors text-zinc-400 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-zinc-200">
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
    <div className="my-3.5 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-md font-mono text-xs not-prose w-full">
      {/* Tool Header with Window Dots */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center space-x-1.5 text-zinc-200 text-xs font-sans font-medium">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Python Interpreter</span>
          </div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 font-sans font-medium">
            Executed
          </span>
        </div>
        <button
          onClick={handleCopyCode}
          type="button"
          className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-white transition cursor-pointer px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
          title="Copy Python code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-zinc-400" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Section */}
      <div className="p-3 bg-zinc-950/90 text-zinc-200 border-b border-zinc-800/80 overflow-x-auto leading-relaxed">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-sans font-semibold mb-1">
          Python Input
        </div>
        <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-[12px]">
          <code>{code}</code>
        </pre>
      </div>

      {/* Stdout Result Section */}
      <div className="p-3 bg-black/60 text-emerald-400 overflow-x-auto leading-relaxed font-mono">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-sans font-semibold mb-1">
          Output (stdout)
        </div>
        <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-[12px] whitespace-pre-wrap text-emerald-400">
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
  isArtifactOpen,
}) {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null); // { file, previewUrl, base64, name, size }
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [activeMenu, setActiveMenu] = useState(null); // 'tools' | 'mode' | null
  const popoverContainerRef = useRef(null);

  // Dismiss popovers on outside click or Escape
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (popoverContainerRef.current && !popoverContainerRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    const handleDocumentKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, isSaving]);

  // Auto-expand textarea up to 6 lines (~160px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, 44), 160)}px`;
    }
  }, [input]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage({
        file,
        previewUrl,
        base64: reader.result,
        name: file.name,
        size: (file.size / 1024).toFixed(0) + ' KB',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if ((!input.trim() && !selectedImage) || isStreaming || isSaving) return;
    const promptToSend = input.trim();
    const imageToSend = selectedImage ? selectedImage.base64 : null;
    setSelectedImage(null);
    onSendMessage({ text: promptToSend, imageB64: imageToSend });
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopyAssistant = (msgId, content) => {
    navigator.clipboard.writeText(cleanContent(content));
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleRegenerate = (asstIndex) => {
    if (isStreaming || isSaving) return;
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

  const modes = [
    {
      id: 'auto',
      name: 'Auto (Highest Capability)',
      badge: 'Recommended',
      description: 'Smart complexity classifier routing to flagship 550B & 120B tiers',
    },
    {
      id: 'deep',
      name: 'Deep Reasoning (Tier 3)',
      badge: 'Flagship 550B',
      description: 'Heavyweight reasoning models with extended 120s generation budget',
    },
    {
      id: 'balanced',
      name: 'Balanced (Tier 2)',
      badge: 'High Throughput',
      description: 'Rapid response flagship models (Kimi / Qwen)',
    },
  ];

  const currentModeObj = modes.find((m) => m.id === mode) || modes[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F9F9F8] text-[#1D1B1B] overflow-hidden select-text font-sans">
      {/* Messages Scroll Area */}
      <div className={`flex-1 overflow-y-auto px-4 pt-6 pb-14 ${isArtifactOpen ? 'max-w-2xl' : 'max-w-3xl'} w-full mx-auto space-y-6 transition-all duration-300`}>
        {messages.length === 0 ? (
          /* Empty / Welcome Hero Canvas */
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5E3DE] flex items-center justify-center shadow-xs mb-5">
              <ClaudeFlower className="w-8 h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#1D1B1B] tracking-tight">
              {conversation ? conversation.title : 'What would you like to build or explore today?'}
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md mt-2.5 mb-8 font-sans">
              Autonomous Python agent and live Artifact rendering powered by NVIDIA NIM flagship cascade routing.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {[
                {
                  tag: 'Live Artifact',
                  title: 'Single-file Interactive Page',
                  prompt: "Generate a simple single-file HTML page with a blue button that alerts 'Hello World' when clicked.",
                },
                {
                  tag: 'Python Agent',
                  title: 'Mathematical Computation',
                  prompt: 'Calculate the 50th Fibonacci number using Python and tell me the result.',
                },
                {
                  tag: 'Reasoning Roadmap',
                  title: 'Career & Curriculum Guide',
                  prompt: 'Create me a root map for students of PCMB after 12th.',
                },
                {
                  tag: 'System Architecture',
                  title: 'Cascade Router Internals',
                  prompt: 'Explain how 40 RPM per-slug cascading and circuit breakers work.',
                },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(item.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-3.5 text-xs text-stone-800 bg-white hover:bg-[#F4F3EE] border border-[#E5E3DE] hover:border-stone-400 rounded-xl shadow-xs transition-all text-left cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {item.tag}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                  <div className="font-semibold text-stone-900 text-xs mb-1">{item.title}</div>
                  <div className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                    "{item.prompt}"
                  </div>
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

            const fallbackCount = msg.fallback_count || 0;
            let fallbackTooltip = '';
            if (fallbackCount > 0) {
              const failedList = (msg.attempts || []).filter(
                (a) => a.status !== 'success' && a.slug !== msg.model_slug
              );
              if (failedList.length > 0) {
                const details = failedList
                  .map((a) => {
                    let codeOrReason = a.status || 'failed';
                    if (a.status === 'rate_limited') codeOrReason = '429';
                    else if (a.status === 'timeout') codeOrReason = 'timeout';
                    else if (a.status === 'dead_model') codeOrReason = '404';
                    else if (a.status === 'skipped_circuit_open') codeOrReason = 'circuit open';
                    else if (a.error && a.error.includes('429')) codeOrReason = '429';
                    else if (a.error && a.error.toLowerCase().includes('timeout')) codeOrReason = 'timeout';
                    return `${a.slug} (${codeOrReason})`;
                  })
                  .join(', ');
                fallbackTooltip = `Failed: ${details}`;
              } else {
                fallbackTooltip = `Recovered via cascade router after ${fallbackCount} ${
                  fallbackCount === 1 ? 'fallback' : 'fallbacks'
                }`;
              }
            }

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
                      className="inline-flex items-center space-x-1 text-[11px] text-stone-500 hover:text-stone-900 bg-white border border-[#E5E3DE] px-2 py-0.5 rounded-md shadow-xs cursor-pointer transition"
                    >
                      <Pencil className="w-3 h-3 text-stone-400" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}

                {/* Assistant Message Header: Model / Latency badge with Fallback struggle */}
                {!isUser && msg.model_slug && (
                  <div className="flex items-center space-x-2 mb-2 px-0.5 text-[11px] text-stone-500 font-sans">
                    <div
                      className={`inline-flex items-center font-mono px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors ${
                        isFailed
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : fallbackCount > 0
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs'
                          : 'bg-[#F0EFEA] text-stone-700 border border-[#E5E3DE]'
                      }`}
                      title={fallbackTooltip || undefined}
                    >
                      {fallbackCount > 0 && <span className="mr-1 text-amber-600 font-bold">⚡</span>}
                      <span>{msg.model_slug}</span>
                      {fallbackCount > 0 && (
                        <span
                          className="ml-1.5 text-[10.5px] text-amber-700 font-semibold cursor-help"
                          title={fallbackTooltip}
                        >
                          ({fallbackCount} {fallbackCount === 1 ? 'fallback' : 'fallbacks'})
                        </span>
                      )}
                    </div>
                    {msg.latency_ms != null && (
                      <span className="font-mono text-stone-400 text-[10.5px]">
                        {(msg.latency_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                )}

                {/* Failed Error Bubble */}
                {isFailed ? (
                  <div className="max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xs bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-3">
                    <div className="p-1 rounded-md bg-rose-100 text-rose-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="font-semibold text-rose-900 text-xs uppercase tracking-wider">
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
                    <div className="w-full max-w-xl bg-white border border-[#E5E3DE] rounded-2xl p-3 shadow-md">
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={3}
                        className="w-full text-sm text-stone-900 bg-transparent focus:outline-none resize-none leading-relaxed"
                      />
                      <div className="flex items-center justify-end space-x-2 mt-2 pt-2 border-t border-[#E5E3DE] text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingMsgId(null)}
                          className="px-3 py-1 rounded-lg text-stone-500 hover:bg-[#F0EFEA] transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-3.5 py-1 rounded-lg bg-stone-900 hover:bg-black text-white font-medium shadow-xs transition cursor-pointer"
                        >
                          Save & Submit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl px-4 py-2.5 rounded-2xl text-[14.5px] leading-relaxed break-words bg-[#F0EFEA] border border-[#E5E3DE]/80 text-[#1D1B1B] font-sans font-medium flex flex-col gap-2.5">
                      {msg.image_url && (
                        <div className="rounded-xl overflow-hidden border border-[#E5E3DE] max-w-sm max-h-72 bg-white shadow-xs">
                          <img
                            src={msg.image_url}
                            alt="Uploaded preview"
                            className="w-full h-auto max-h-72 object-contain rounded-xl"
                          />
                        </div>
                      )}
                      {cleaned && <div>{cleaned}</div>}
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
                      <div className="prose prose-stone max-w-none font-serif text-[#1D1B1B] text-[15.5px] leading-[1.78] prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[#1D1B1B] prose-p:my-2.5 prose-li:my-1 prose-pre:my-3">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre({ children }) {
                              return <>{children}</>;
                            },
                            h1({ children }) {
                              return <h1 className="text-xl font-sans font-bold text-[#1D1B1B] mt-6 mb-3 tracking-tight">{children}</h1>;
                            },
                            h2({ children }) {
                              return <h2 className="text-base font-sans font-semibold text-[#1D1B1B] mt-5 mb-2 tracking-tight border-b border-[#E5E3DE] pb-1">{children}</h2>;
                            },
                            h3({ children }) {
                              return <h3 className="text-sm font-sans font-semibold text-stone-800 mt-4 mb-1.5 tracking-tight">{children}</h3>;
                            },
                            p({ children }) {
                              return <p className="my-2.5 leading-[1.8] text-[#1D1B1B]">{children}</p>;
                            },
                            hr() {
                              return <hr className="my-5 border-[#E5E3DE]" />;
                            },
                            ul({ children }) {
                              return <ul className="my-2.5 space-y-1 list-disc pl-5 font-serif text-[#1D1B1B] leading-[1.75]">{children}</ul>;
                            },
                            ol({ children }) {
                              return <ol className="my-2.5 space-y-1 list-decimal pl-5 font-serif text-[#1D1B1B] leading-[1.75]">{children}</ol>;
                            },
                            li({ children }) {
                              return <li className="pl-1 text-[#1D1B1B]">{children}</li>;
                            },
                            strong({ children }) {
                              return <strong className="font-semibold text-stone-900 font-sans">{children}</strong>;
                            },
                            blockquote({ children }) {
                              return <blockquote className="border-l-2 border-emerald-500 pl-3.5 my-3 text-stone-600 italic">{children}</blockquote>;
                            },
                            table({ children }) {
                              return <div className="overflow-x-auto my-3 rounded-xl border border-[#E5E3DE]"><table className="w-full text-left text-xs font-sans">{children}</table></div>;
                            },
                            thead({ children }) {
                              return <thead className="bg-[#F0EFEA] border-b border-[#E5E3DE] text-stone-700 font-semibold">{children}</thead>;
                            },
                            th({ children }) {
                              return <th className="px-3.5 py-2 font-medium">{children}</th>;
                            },
                            td({ children }) {
                              return <td className="px-3.5 py-2 border-b border-[#E5E3DE] text-stone-800">{children}</td>;
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
                      <div className="flex items-center space-x-1.5 py-2 text-zinc-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"></span>
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></span>
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
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
                          className="flex items-center space-x-1.5 text-xs text-stone-500 hover:text-stone-900 transition cursor-pointer"
                          title="Copy text"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copied</span>
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
                          className="flex items-center space-x-1.5 text-xs text-stone-500 hover:text-stone-900 transition cursor-pointer"
                          title="Retry from here"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
            <span>Saving to database...</span>
          </div>
        )}

        <div ref={messagesEndRef} className="h-6 shrink-0" />
      </div>

      {/* Claude-style Luxury Floating Input Hub - Warm Light Styling */}
      <footer className="p-4 bg-gradient-to-t from-[#F9F9F8] via-[#F9F9F8]/90 to-transparent">
        <div className={`${isArtifactOpen ? 'max-w-2xl' : 'max-w-3xl'} mx-auto transition-all duration-300`}>
          {/* Main Input Box Card */}
          <div className="relative rounded-2xl border border-[#E5E3DE] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] focus-within:border-stone-400 transition-all p-3 backdrop-blur-md">
            {/* Image Thumbnail Preview with X remove button */}
            {selectedImage && (
              <div className="mb-2.5 relative inline-flex items-center gap-2.5 p-1.5 bg-[#F0EFEA] border border-[#E5E3DE] rounded-xl shadow-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-[#E5E3DE] shrink-0">
                  <img
                    src={selectedImage.previewUrl}
                    alt="Upload thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col text-left pr-6">
                  <span className="text-xs font-semibold text-stone-800 max-w-[180px] truncate">
                    {selectedImage.name}
                  </span>
                  <span className="text-[10.5px] text-stone-500 font-mono">
                    {selectedImage.size} • Vision Model
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-300 text-stone-700 hover:bg-stone-400 rounded-full flex items-center justify-center shadow-xs transition cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setActiveMenu(null)}
              rows={1}
              placeholder={
                isStreaming
                  ? 'Generating response...'
                  : isSaving
                  ? 'Saving to MongoDB...'
                  : selectedImage
                  ? 'Ask a question about this image...'
                  : 'Reply to NIM Studio...'
              }
              disabled={isStreaming || isSaving}
              className="w-full bg-transparent text-sm text-[#1D1B1B] placeholder-stone-400 focus:outline-none resize-none leading-relaxed min-h-[44px] max-h-[160px] px-1 py-1 font-sans"
            />

            {/* Input Bottom Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E5E3DE] mt-1">
              <div ref={popoverContainerRef} className="flex items-center space-x-1.5 relative">
                {/* Paperclip Icon for image file uploads */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(null);
                    fileInputRef.current?.click();
                  }}
                  title="Attach image for vision analysis"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    selectedImage
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-stone-500 hover:text-stone-900 hover:bg-[#F0EFEA]'
                  }`}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Tools & MCP Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'tools' ? null : 'tools'))}
                    title="Tools & Capabilities"
                    className={`flex items-center space-x-1 p-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                      activeMenu === 'tools'
                        ? 'bg-[#F0EFEA] text-stone-900'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-[#F0EFEA]'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                  </button>

                  {/* Tools Dropdown Popover */}
                  {activeMenu === 'tools' && (
                    <div className="absolute left-0 bottom-full mb-2.5 w-64 bg-white border border-[#E5E3DE] rounded-2xl shadow-xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between px-2 py-1 border-b border-[#E5E3DE] mb-2 text-[11px] font-semibold text-stone-500 font-mono uppercase tracking-wider">
                        <span>Tools & Capabilities</span>
                        <button
                          type="button"
                          onClick={() => setActiveMenu(null)}
                          className="text-stone-400 hover:text-stone-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="px-2.5 py-2 rounded-xl text-stone-900 bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-between shadow-xs">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="font-semibold text-xs text-stone-900">Code Interpreter</span>
                          </div>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold font-mono">
                            Active
                          </span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-lg text-stone-500 hover:bg-[#F4F3EE] flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            <span className="text-xs text-stone-700">Web Search</span>
                          </div>
                          <span className="text-[10px] text-stone-500 bg-[#F0EFEA] px-1.5 py-0.5 rounded font-mono border border-[#E5E3DE]">
                            Soon
                          </span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-lg text-stone-500 hover:bg-[#F4F3EE] flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            <span className="text-xs text-stone-700">File Context</span>
                          </div>
                          <span className="text-[10px] text-stone-500 bg-[#F0EFEA] px-1.5 py-0.5 rounded font-mono border border-[#E5E3DE]">
                            Soon
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Routing Mode Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenu((prev) => (prev === 'mode' ? null : 'mode'))}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      activeMenu === 'mode'
                        ? 'bg-[#F0EFEA] text-stone-900 border-[#E5E3DE] shadow-xs ring-1 ring-emerald-500/40'
                        : 'bg-[#F0EFEA] hover:bg-[#E5E3DE] text-stone-700 border border-[#E5E3DE]'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>{currentModeObj.name}</span>
                    <ChevronDown className={`w-3 h-3 text-stone-500 transition-transform ${activeMenu === 'mode' ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Mode Dropdown Popover */}
                  {activeMenu === 'mode' && (
                    <div className="absolute left-0 bottom-full mb-2.5 w-80 bg-white border border-[#E5E3DE] rounded-2xl shadow-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 font-mono uppercase tracking-wider border-b border-[#E5E3DE] mb-1">
                        <span>Routing Strategy</span>
                        <span className="text-[10px] text-stone-400 font-normal">Cascade Tiers</span>
                      </div>
                      <div className="space-y-1">
                        {modes.map((m) => {
                          const isSelected = mode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setMode(m.id);
                                setActiveMenu(null);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex flex-col space-y-1 ${
                                isSelected
                                  ? 'bg-[#F0EFEA] text-stone-900 font-medium border border-[#E5E3DE] shadow-xs'
                                  : 'text-stone-700 hover:bg-[#F4F3EE] hover:text-stone-900'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-600' : 'bg-transparent'}`} />
                                  <span className="text-xs font-semibold text-stone-900">{m.name}</span>
                                </div>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                    isSelected
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                                      : 'bg-[#F0EFEA] text-stone-500 border border-[#E5E3DE]'
                                  }`}
                                >
                                  {m.badge}
                                </span>
                              </div>
                              <span className="text-[11.5px] text-stone-500 font-normal pl-3.5 leading-normal">
                                {m.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Upward Send Button (Emerald Green Accent) */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!input.trim() && !selectedImage) || isStreaming || isSaving}
                className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-200 disabled:text-stone-400 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed active:scale-95"
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Claude-style Disclaimer */}
          <p className="text-[11px] text-stone-400 text-center mt-2.5 tracking-tight font-sans">
            NIM Studio can make mistakes. Check important info.
          </p>
        </div>
      </footer>
    </div>
  );
}
