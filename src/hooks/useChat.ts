import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { ChatMessage } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseChatReturn {
    messages: ChatMessage[];
    sending: boolean;
    loading: boolean;
    error: string | null;
    sendMessage: (text: string) => Promise<void>;
}

const MAX_MESSAGE_LENGTH = 500;
const INITIAL_LOAD_COUNT = 50;

export function useChat(channel = "lobby"): UseChatReturn {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    const displayName =
        profile?.display_name ??
        (user?.user_metadata as { display_name?: string } | undefined)
            ?.display_name ??
        "Player";

    // Load initial messages and subscribe to new ones
    useEffect(() => {
        if (!user) return;

        let cancelled = false;

        // Fetch the last N messages
        const loadMessages = async () => {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("channel", channel)
                .order("created_at", { ascending: false })
                .limit(INITIAL_LOAD_COUNT);

            if (cancelled) return;

            if (fetchError) {
                // If table doesn't exist yet, show empty chat silently
                if (
                    fetchError.code === "42P01" ||
                    fetchError.message?.includes("does not exist")
                ) {
                    console.warn("chat_messages table does not exist yet.");
                    setMessages([]);
                    setLoading(false);
                    return;
                }
                setError(fetchError.message);
                setLoading(false);
                return;
            }

            // Data comes in descending order, reverse for chronological display
            setMessages((data as ChatMessage[]).reverse());
            setLoading(false);
        };

        loadMessages();

        // Subscribe to new inserts on chat_messages for this channel
        const realtimeChannel = supabase
            .channel(`chat-${channel}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages",
                    filter: `channel=eq.${channel}`,
                },
                (payload) => {
                    if (!cancelled) {
                        const newMsg = payload.new as ChatMessage;
                        setMessages((prev) => {
                            // Avoid duplicates (e.g. from optimistic insert)
                            if (prev.some((m) => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                    }
                }
            )
            .subscribe();

        channelRef.current = realtimeChannel;

        return () => {
            cancelled = true;
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [user, channel]);

    /**
     * Send a chat message to the lobby channel.
     */
    const sendMessage = useCallback(
        async (text: string) => {
            if (!user) return;

            const trimmed = text.trim();
            if (!trimmed) return;
            if (trimmed.length > MAX_MESSAGE_LENGTH) {
                setError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less.`);
                return;
            }

            setSending(true);
            setError(null);

            // Create an optimistic message that shows immediately
            const tempId = `temp-${Date.now()}`;
            const optimisticMsg: ChatMessage = {
                id: tempId,
                sender_id: user.id,
                sender_name: displayName,
                message: trimmed,
                channel,
                created_at: new Date().toISOString(),
            };

            // Show it immediately in the UI
            setMessages((prev) => [...prev, optimisticMsg]);

            try {
                const { data, error: insertError } = await supabase
                    .from("chat_messages")
                    .insert({
                        sender_id: user.id,
                        sender_name: displayName,
                        message: trimmed,
                        channel,
                    })
                    .select()
                    .single();

                if (insertError) {
                    throw new Error(insertError.message);
                }

                // Replace the temp message with the real one from DB
                if (data) {
                    setMessages((prev) =>
                        prev.map((m) => (m.id === tempId ? (data as ChatMessage) : m))
                    );
                }
            } catch (err) {
                // Remove the optimistic message on failure
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                const message =
                    err instanceof Error ? err.message : "Failed to send message";
                setError(message);
            } finally {
                setSending(false);
            }
        },
        [user, displayName, channel]
    );

    return { messages, sending, loading, error, sendMessage };
}
