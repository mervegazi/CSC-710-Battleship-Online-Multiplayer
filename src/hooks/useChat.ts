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

    /**
     * Fetch messages from DB. Handles both initial load and polling updates.
     * Silent update by default (loading=false), but can trigger loading state if needed.
     */
    const loadMessages = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);

        const { data, error: fetchError } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("channel", channel)
            .order("created_at", { ascending: false })
            .limit(INITIAL_LOAD_COUNT);

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
            if (isInitial) {
                setError(fetchError.message);
                setLoading(false);
            }
            return;
        }

        if (data) {
            const newMessages = (data as ChatMessage[]).reverse();
            setMessages((prev) => {
                // Simple check to avoid unnecessary re-renders
                // If the last message ID and total count are the same, assume no change
                // (Though strictly speaking an edit/delete in middle would require deep check, 
                // but for append-only chat this is efficient)
                const lastPrev = prev[prev.length - 1];
                const lastNew = newMessages[newMessages.length - 1];

                if (
                    prev.length === newMessages.length &&
                    lastPrev?.id === lastNew?.id
                ) {
                    return prev;
                }
                return newMessages;
            });
        }

        if (isInitial) setLoading(false);
    }, [channel]);

    // Initial load and Realtime subscription
    useEffect(() => {
        if (!user) return;

        let cancelled = false;

        // 1. Initial Load
        loadMessages(true);

        // 2. Realtime Subscription
        const realtimeChannel = supabase
            .channel(`chat-${channel}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages",
                },
                (payload: any) => {
                    if (!cancelled) {
                        const newMsg = payload.new as ChatMessage;
                        // Client-side filtering
                        if (newMsg.channel !== channel) return;

                        setMessages((prev) => {
                            // Avoid duplicates
                            if (prev.some((m) => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Chat subscribed');
                }
            });

        channelRef.current = realtimeChannel;

        // 3. Polling Fallback (every 3s)
        const interval = setInterval(() => {
            if (!cancelled) {
                loadMessages(false);
            }
        }, 3000);

        return () => {
            cancelled = true;
            clearInterval(interval);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [user, channel, loadMessages]);


    /**
     * Send a chat message to the lobby channel.
     */
    const sendMessage = async (text: string) => {
        if (!text.trim() || !user) return;

        setSending(true);
        setError(null);

        try {
            if (text.length > MAX_MESSAGE_LENGTH) {
                throw new Error(
                    `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`
                );
            }

            // Optimistic update
            const optimisticMsg: ChatMessage = {
                id: crypto.randomUUID(),
                sender_id: user.id,
                sender_name: displayName,
                message: text.trim(),
                channel,
                created_at: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, optimisticMsg]);

            const { error: sendError } = await supabase.from("chat_messages").insert({
                sender_id: user.id,
                sender_name: displayName, // Denormalize name for simplicity
                message: text.trim(),
                channel,
            });

            if (sendError) throw new Error(sendError.message);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to send message";
            setError(message);

            // Revert optimistic update on error (reload from server)
            loadMessages(false);
        } finally {
            setSending(false);
        }
    };

    return { messages, sending, loading, error, sendMessage };
}
