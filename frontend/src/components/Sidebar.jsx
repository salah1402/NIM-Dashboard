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
    <aside className="w-72 bg-[#F9F9F8] border-r border-[#E5E3DE] flex flex-col h-full select-none shrink-0 font-sans text-stone-800">
      {/* Top Action Area */}
      <div className="p-3.5 space-y-2.5 border-b border-[#E5E3DE]">
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-between bg-white hover:bg-[#F0EFEA] text-[#1D1B1B] font-medium text-xs py-2.5 px-3.5 rounded-xl border border-[#E5E3DE] hover:border-stone-400 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-stone-900">New Chat</span>
          </div>
          <span className="text-[10px] font-mono text-stone-500 bg-[#F0EFEA] group-hover:bg-[#E5E3DE] px-1.5 py-0.5 rounded border border-[#E5E3DE]">
            ⌘N
          </span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white text-xs text-stone-900 placeholder-stone-400 pl-8 pr-7 py-1.5 rounded-lg border border-[#E5E3DE] focus:border-stone-400 focus:outline-none transition-all shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-stone-500 font-semibold flex items-center justify-between">
          <span>Recent Sessions</span>
          <span className="font-mono text-[9px] bg-[#F0EFEA] text-stone-600 px-1.5 rounded border border-[#E5E3DE]">
            {conversations.length}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2 py-3 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 bg-[#F0EFEA] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-stone-500">
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
                    ? 'bg-[#F0EFEA] text-[#1D1B1B] font-semibold border border-[#E5E3DE] shadow-xs'
                    : 'text-stone-600 hover:bg-[#F0EFEA] hover:text-[#1D1B1B]'
                }`}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <span className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-emerald-600" />
                )}

                <div className="flex items-center space-x-2.5 min-w-0 flex-1 pl-1">
                  <MessageSquare
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isActive ? 'text-emerald-600' : 'text-stone-400 group-hover:text-stone-600'
                    }`}
                  />
                  <span className="truncate text-xs font-normal text-stone-800">
                    {conv.title || 'New chat'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 ml-2">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      isActive
                        ? 'bg-white text-stone-800 font-medium border border-[#E5E3DE]'
                        : 'bg-white/60 text-stone-500 border border-[#E5E3DE]'
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
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-600 text-stone-400 p-1 rounded hover:bg-stone-200 transition cursor-pointer"
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
      <div className="px-4 py-3.5 border-t border-[#E5E3DE] bg-[#F9F9F8] text-[11px] text-stone-500 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-stone-700">
            <Database className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-medium text-xs">MongoDB Cloud</span>
          </div>
          <span className="text-[10px] font-mono bg-white border border-[#E5E3DE] px-1.5 py-0.5 rounded text-stone-700 font-medium shadow-2xs">
            Atlas
          </span>
        </div>
        <div className="flex items-center justify-between text-[10.5px] text-stone-500 font-mono">
          <span>Active Flagships</span>
          <span className="text-emerald-700 font-semibold flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            3 Tiers Live
          </span>
        </div>
      </div>
    </aside>
  );
}
