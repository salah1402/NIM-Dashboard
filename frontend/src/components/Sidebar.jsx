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
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none">
      {/* New Chat Button */}
      <div className="p-3.5 border-b border-slate-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition shadow-sm hover:shadow-emerald-900/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-slate-500 animate-pulse">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-slate-500">
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
                    ? 'bg-slate-800/90 text-white border border-slate-700/80 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/40 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <svg
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'
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
                  <span className="truncate font-medium text-xs text-slate-200">
                    {conv.title || 'New chat'}
                  </span>
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
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
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-slate-500 p-1 rounded transition"
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
      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span>SQLite: nim.db</span>
        <span className="text-emerald-400 font-mono">Phase 1 DB</span>
      </div>
    </aside>
  );
}
