import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatPane from './components/ChatPane';
import {
  fetchConversations,
  fetchMessages,
  createConversation,
  deleteConversation,
  sendChatMessage,
  checkHealth,
} from './api';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [backendHealth, setBackendHealth] = useState('checking');

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

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400">
            N
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-wide text-white">NIM Dashboard</h1>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Phase 1 DB
              </span>
            </div>
            <p className="text-xs text-slate-400">Self-hosted NVIDIA NIM Multi-Slug Cascade Router</p>
          </div>
        </div>

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
                  : 'bg-red-500'
              }`}
            />
            <span className="text-slate-300">
              API: {backendHealth === 'connected' ? '8000 OK' : backendHealth}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + ChatPane */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelectConversation={(id) => setActiveId(id)}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          isLoading={isLoadingList}
        />
        <ChatPane
          conversation={activeConversation}
          messages={messages}
          input={input}
          setInput={setInput}
          isStreaming={isStreaming}
          isSaving={isSaving}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
