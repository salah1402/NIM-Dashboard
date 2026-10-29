import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, BarChart3 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatPane from './components/ChatPane';
import ArtifactPane from './components/ArtifactPane';
import DashboardView from './components/DashboardView';
import {
  fetchConversations,
  fetchMessages,
  createConversation,
  deleteConversation,
  sendChatMessage,
  checkHealth,
} from './api';

export const ClaudeLogo = ({ className = "w-5 h-5", ...props }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="presentation" className={className} {...props}>
    <defs>
      <ellipse id="petal-pair" cx="100" cy="100" rx="90" ry="22" />
    </defs>
    <g fill="#10B981" fillRule="evenodd">
      <use href="#petal-pair" transform="rotate(0 100 100)" />
      <use href="#petal-pair" transform="rotate(45 100 100)" />
      <use href="#petal-pair" transform="rotate(90 100 100)" />
      <use href="#petal-pair" transform="rotate(135 100 100)" />
    </g>
  </svg>
);

export default function App() {
  const [view, setView] = useState('chat'); // 'chat' | 'dashboard'
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [backendHealth, setBackendHealth] = useState('checking');
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);

  const handleOpenArtifact = (code) => {
    setActiveArtifact(code);
    setIsArtifactOpen(true);
  };

  const handleCloseArtifact = () => {
    setIsArtifactOpen(false);
    setActiveArtifact(null);
  };

  // Load conversation list and optionally select one; clears stale activeId if not in list
  const loadConversations = useCallback(async (selectId = null) => {
    try {
      setIsLoadingList(true);
      const list = await fetchConversations();
      setConversations(list);

      setActiveId((currentId) => {
        const idToCheck = selectId !== null ? selectId : currentId;
        if (idToCheck && list.some((c) => c.id === idToCheck)) {
          return idToCheck;
        }
        setMessages([]);
        return null;
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // Load messages whenever activeId changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;
    fetchMessages(activeId)
      .then((msgs) => {
        if (isSubscribed) {
          setMessages(msgs);
        }
      })
      .catch((err) => {
        console.error(`Failed to load messages for ${activeId}:`, err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeId]);

  // Initial load: check health & load conversations
  useEffect(() => {
    checkHealth()
      .then((res) => {
        setBackendHealth(res.status === 'ok' ? 'connected' : 'error');
      })
      .catch(() => setBackendHealth('offline'));

    loadConversations();
  }, []);

  // Global keyboard shortcuts (Ctrl+N for new chat, Esc for closing artifact)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      } else if (e.key === 'Escape' && isArtifactOpen) {
        handleCloseArtifact();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isArtifactOpen]);

  const handleNewChat = async () => {
    handleCloseArtifact();
    try {
      const newConv = await createConversation('New chat');
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newConv.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await deleteConversation(convId);
      const updatedList = conversations.filter((c) => c.id !== convId);
      setConversations(updatedList);
      if (activeId === convId) {
        if (updatedList.length > 0) {
          setActiveId(updatedList[0].id);
        } else {
          setActiveId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async (e, customText = null, customImageB64 = null) => {
    if (e && e.preventDefault) e.preventDefault();
    let textToSend = typeof customText === 'string' ? customText : (typeof e === 'string' ? e : input);
    let imageToSend = customImageB64;
    if (typeof e === 'object' && e !== null && !e.preventDefault && (e.text !== undefined || e.imageB64 !== undefined)) {
      textToSend = e.text || '';
      imageToSend = e.imageB64 || null;
    }

    const trimmed = (textToSend || '').trim();
    if ((!trimmed && !imageToSend) || isStreaming || isSaving) return;

    const userMsgId = 'temp-user-' + Date.now();
    const asstMsgId = 'temp-asst-' + Date.now();

    const userMsg = {
      id: userMsgId,
      conversation_id: activeId || '',
      role: 'user',
      content: trimmed,
      image_url: imageToSend,
      created_at: new Date().toISOString(),
    };

    const asstPlaceholder = {
      id: asstMsgId,
      conversation_id: activeId || '',
      role: 'assistant',
      content: '',
      model_slug: null,
      latency_ms: null,
      created_at: new Date().toISOString(),
    };

    // Render user message and placeholder immediately
    setMessages((prev) => [...prev, userMsg, asstPlaceholder]);
    setInput('');
    setIsStreaming(true);

    try {
      await sendChatMessage({
        conversationId: activeId,
        message: trimmed || 'Describe this image',
        imageB64: imageToSend,
        mode,
        onMeta: (meta) => {
          if (meta.conversation_id) {
            setActiveId(meta.conversation_id);
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    model_slug: meta.model_slug,
                    tier: meta.tier,
                    fallback_count: meta.fallback_count,
                    attempts: meta.attempts,
                  }
                : m
            )
          );
        },
        onToolCall: (toolCall) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    tool_calls: [...(m.tool_calls || []), toolCall],
                  }
                : m
            )
          );
        },
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId ? { ...m, content: m.content + token } : m
            )
          );
        },
        onComplete: async (data) => {
          setIsStreaming(false);
          setIsSaving(true);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    model_slug: data.model_slug,
                    latency_ms: data.latency_ms,
                    fallback_count: data.fallback_count != null ? data.fallback_count : m.fallback_count,
                    attempts: data.attempts || m.attempts,
                  }
                : m
            )
          );

          // Update activeId if this was a new conversation created on-the-fly
          const resultingConvId = data.conversation_id || activeId;
          setActiveId(resultingConvId);

          // Refresh conversation list to get auto-derived title and message count
          try {
            const list = await fetchConversations();
            setConversations(list);
          } catch (listErr) {
            console.error('Error refreshing conversation list:', listErr);
          } finally {
            setIsSaving(false);
          }
        },
        onError: async (err) => {
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    content: m.content + `\n\n[⚠️ Response failed: ${err.message}]`,
                    model_slug: 'error',
                  }
                : m
            )
          );
          try {
            const list = await fetchConversations();
            setConversations(list);
          } catch (e) {
            // ignore
          }
        },
      });
    } catch (err) {
      console.error('Chat error:', err);
      setIsStreaming(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F8] text-[#1D1B1B] overflow-hidden font-sans">
      {/* Top Header - Claude Warm Light Styling */}
      <header className="border-b border-[#E5E3DE] bg-[#F9F9F8]/90 backdrop-blur-md px-6 py-2.5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-[#E5E3DE] flex items-center justify-center shadow-xs">
            <ClaudeLogo className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold tracking-tight text-[#1D1B1B]">NIM Studio</h1>
              <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                God Mode
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-sans tracking-tight">
              Flagship Autonomous AI Agent & Cascade Router
            </p>
          </div>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center bg-[#F0EFEA] p-1 rounded-xl border border-[#E5E3DE] shadow-xs">
          <button
            type="button"
            onClick={() => setView('chat')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              view === 'chat'
                ? 'bg-white text-[#1D1B1B] font-semibold shadow-xs'
                : 'text-stone-600 hover:text-[#1D1B1B] hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Chat & Agent</span>
          </button>
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              view === 'dashboard'
                ? 'bg-white text-[#1D1B1B] font-semibold shadow-xs'
                : 'text-stone-600 hover:text-[#1D1B1B] hover:bg-white/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
            <span>Analytics & DB</span>
          </button>
        </div>

        {/* Telemetry Status Badges */}
        <div className="flex items-center space-x-2.5 text-xs font-mono">
          <div className="hidden sm:flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#E5E3DE] text-stone-700 shadow-xs">
            <span className="text-stone-500">Rate Limit:</span>
            <span className="text-emerald-700 font-semibold">40 RPM / Slug</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-[#E5E3DE] shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealth === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-stone-700 font-medium">
              API: {backendHealth === 'connected' ? '8000 OK' : backendHealth}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container: Chat vs Dashboard */}
      <div className={view === 'chat' ? 'flex flex-1 overflow-hidden relative' : 'hidden'}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelectConversation={(id) => {
            setActiveId(id);
            handleCloseArtifact();
          }}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          isLoading={isLoadingList}
        />
        <div className="flex-1 flex overflow-hidden">
          <div className={`${isArtifactOpen ? 'w-1/2' : 'w-full'} flex flex-col h-full transition-all duration-300`}>
            <ChatPane
              conversation={activeConversation}
              messages={messages}
              input={input}
              setInput={setInput}
              mode={mode}
              setMode={setMode}
              isStreaming={isStreaming}
              isSaving={isSaving}
              onSendMessage={handleSendMessage}
              onOpenArtifact={handleOpenArtifact}
              isArtifactOpen={isArtifactOpen}
            />
          </div>
          {isArtifactOpen && (
            <div className="w-1/2 h-full border-l border-[#E5E3DE] transition-all duration-300 flex flex-col">
              <ArtifactPane
                artifact={activeArtifact}
                onClose={handleCloseArtifact}
              />
            </div>
          )}
        </div>
      </div>

      <div className={view === 'dashboard' ? 'flex flex-1 overflow-hidden' : 'hidden'}>
        <DashboardView />
      </div>
    </div>
  );
}
