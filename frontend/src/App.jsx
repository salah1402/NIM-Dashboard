import React, { useState, useEffect, useCallback } from 'react';
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

  // Load conversation list and optionally select one
  const loadConversations = useCallback(async (selectId = null) => {
    try {
      setIsLoadingList(true);
      const list = await fetchConversations();
      setConversations(list);

      if (list.length > 0) {
        // If a specific conversation was requested to be selected, use it
        // Otherwise, if no active conversation is set, auto-select the most recent
        const targetId = selectId || activeId || list[0].id;
        const exists = list.some((c) => c.id === targetId);
        const finalId = exists ? targetId : list[0].id;
        setActiveId(finalId);
      } else {
        setActiveId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [activeId]);

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

  // Initial load: check health & load conversations (auto-select most recent on refresh)
  useEffect(() => {
    checkHealth()
      .then((res) => {
        setBackendHealth(res.status === 'ok' ? 'connected' : 'error');
      })
      .catch(() => setBackendHealth('offline'));

    loadConversations();
  }, []);

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

  const handleSendMessage = async (e, customText = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const textToSend = typeof customText === 'string' ? customText : (typeof e === 'string' ? e : input);
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming || isSaving) return;

    const userMsgId = 'temp-user-' + Date.now();
    const asstMsgId = 'temp-asst-' + Date.now();

    const userMsg = {
      id: userMsgId,
      conversation_id: activeId || '',
      role: 'user',
      content: trimmed,
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
        message: trimmed,
        mode,
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
          // Refresh list in case conversation was created before error
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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="border-b border-[#E5E3DE] bg-[#F9F9F8] px-6 py-2.5 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center font-serif font-bold text-[#C96442]">
            N
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-tight text-[#1D1B1B]">NIM Dashboard</h1>
            </div>
            <p className="text-xs text-stone-500">Autonomous Coding Agent & Multi-Slug Cascade Router</p>
          </div>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center bg-[#F0EFEA] p-1 rounded-xl border border-[#E5E3DE]">
          <button
            type="button"
            onClick={() => setView('chat')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              view === 'chat'
                ? 'bg-white text-[#1D1B1B] font-medium shadow-xs'
                : 'text-stone-500 hover:text-[#1D1B1B] hover:bg-stone-200/40'
            }`}
          >
            <span>💬 Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              view === 'dashboard'
                ? 'bg-white text-[#1D1B1B] font-medium shadow-xs'
                : 'text-stone-500 hover:text-[#1D1B1B] hover:bg-stone-200/40'
            }`}
          >
            <span>📊 Dashboard</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="hidden sm:flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#E5E3DE] text-stone-600 shadow-xs">
            <span className="text-stone-400">Rate Limit:</span>
            <span className="text-emerald-700 font-semibold">40 RPM / Slug</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-[#E5E3DE] shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealth === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-stone-600">
              API: {backendHealth === 'connected' ? '8000 OK' : backendHealth}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container: Chat vs Dashboard with state preserved */}
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
