import { useState, useRef, useEffect } from "react";
import { useChat } from "../../hooks/useChat";
import { useAuth } from "../../hooks/useAuth";
import type { ChatMessage } from "../../types";

export function LobbyChat() {
  const { user } = useAuth();
  const { messages, sending, loading, error, sendMessage } = useChat("lobby");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const isOwnMessage = (msg: ChatMessage) => msg.sender_id === user?.id;

  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-300">
          💬 Lobby Chat
        </h3>
        <span className="text-xs text-slate-500">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages area */}
      <div
        ref={chatContainerRef}
        className="flex h-64 flex-col gap-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700"
      >
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">
              No messages yet. Say hello! 👋
            </p>
          </div>
        )}

        {!loading &&
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`group flex items-start gap-2 rounded px-2 py-1.5 transition-colors hover:bg-slate-800/50 ${isOwnMessage(msg) ? "bg-blue-950/20" : ""
                }`}
            >
              {/* Sender name */}
              <span
                className={`shrink-0 text-xs font-semibold ${isOwnMessage(msg) ? "text-blue-400" : "text-emerald-400"
                  }`}
              >
                {isOwnMessage(msg)
                  ? "You"
                  : msg.sender_name ?? "Player"}
              </span>

              {/* Message text */}
              <span className="min-w-0 flex-1 break-words text-sm text-slate-300">
                {msg.message}
              </span>

              {/* Timestamp */}
              <span className="shrink-0 text-[10px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                {formatTime(msg.created_at)}
              </span>
            </div>
          ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="border-t border-red-900/30 bg-red-950/20 px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-slate-800 px-4 py-3"
      >
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          disabled={sending}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Send"
          )}
        </button>
      </form>
    </div>
  );
}
