import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Trash2, Database, Sparkles, X } from 'lucide-react';

export default function Sidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter((c) =>
    (c.title || 'New chat').toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <aside className="w-72 bg-[#0c0c0e] border-r border-zinc-800/80 flex flex-col h-full select-none shrink-0 font-sans">
      {/* Top Action Area */}
      <div className="p-3.5 space-y-2.5 border-b border-zinc-800/80">
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/90 text-zinc-100 font-medium text-xs py-2.5 px-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-[#C96442]" />
            <span className="font-semibold text-zinc-200">New Chat</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 group-hover:bg-zinc-700/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
            ⌘N
          </span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-zinc-900/90 text-xs text-zinc-200 placeholder-zinc-500 pl-8 pr-7 py-1.5 rounded-lg border border-zinc-800/80 focus:border-zinc-700 focus:outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
          <span>Recent Sessions</span>
          <span className="font-mono text-[9px] bg-zinc-800 text-zinc-400 px-1.5 rounded">
            {conversations.length}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2 py-3 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-zinc-500">
            {searchTerm ? 'No matching conversations' : 'No conversations yet. Start a new chat!'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-all relative ${
                  isActive
                    ? 'bg-zinc-800/80 text-zinc-100 font-semibold border border-zinc-700/80 shadow-xs'
                    : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
                }`}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <span className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-[#C96442]" />
                )}

                <div className="flex items-center space-x-2.5 min-w-0 flex-1 pl-1">
                  <MessageSquare
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isActive ? 'text-[#C96442]' : 'text-zinc-500 group-hover:text-zinc-400'
                    }`}
                  />
                  <span className="truncate text-xs font-normal text-zinc-200">
                    {conv.title || 'New chat'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 ml-2">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-zinc-700/80 text-zinc-200 font-medium'
                        : 'bg-zinc-800/60 text-zinc-500'
                    }`}
                  >
                    {conv.message_count ?? 0}
                  </span>
                  {onDeleteConversation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      title="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 text-zinc-500 p-1 rounded hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info Hub */}
      <div className="p-3 border-t border-zinc-800/80 bg-[#0c0c0e] text-[11px] text-zinc-400 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-zinc-300">
            <Database className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-medium text-xs">SQLite Storage</span>
          </div>
          <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
            nim.db
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>Active Flagships</span>
          <span className="text-emerald-400 font-semibold flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
            3 Tiers Live
          </span>
        </div>
      </div>
    </aside>
  );
}
