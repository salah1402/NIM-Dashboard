import React from 'react';

export default function Sidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isLoading,
}) {
  return (
    <aside className="w-72 bg-[#F9F9F8] border-r border-[#E5E3DE] flex flex-col h-full select-none">
      {/* New Chat Button */}
      <div className="p-3.5 border-b border-[#E5E3DE]">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-[#F0EFEA] text-[#1D1B1B] font-medium text-sm py-2.5 px-4 rounded-xl border border-[#E5E3DE] hover:border-stone-400 shadow-xs transition cursor-pointer"
        >
          <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-stone-400 animate-pulse">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-stone-400">
            No conversations yet. Start a new chat to begin!
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${
                  isActive
                    ? 'bg-white text-[#1D1B1B] font-semibold border border-[#E5E3DE] shadow-xs'
                    : 'text-stone-600 hover:bg-[#F0EFEA] hover:text-[#1D1B1B]'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <svg
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-[#C96442]' : 'text-stone-400 group-hover:text-stone-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <span className="truncate font-medium text-xs text-stone-800">
                    {conv.title || 'New chat'}
                  </span>
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-[#F0EFEA] text-stone-700 font-medium'
                        : 'bg-stone-200/50 text-stone-500'
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
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-600 text-stone-400 p-1 rounded transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#E5E3DE] text-[11px] text-stone-500 flex items-center justify-between bg-[#F9F9F8]">
        <span>SQLite: nim.db</span>
        <span className="text-[#C96442] font-mono font-medium">Coding Agent</span>
      </div>
    </aside>
  );
}
