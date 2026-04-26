import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface GridwiseChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  message: string;
}

interface ChatHistoryResponse {
  messages: GridwiseChatMessage[];
}

export function useGridwiseChat() {
  const [messages, setMessages] = useState<GridwiseChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/chat");
      const data = (await res.json()) as ChatHistoryResponse;
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chat history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setMessages((cur) => [...cur, { role: "user", content: trimmed }]);

      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            message: trimmed,
            history: messages.slice(-8),
          }),
        });
        const data = (await res.json()) as ChatResponse;
        setMessages((cur) => [...cur, { role: "assistant", content: data.message }]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not send message";
        setError(message);
        setMessages((cur) => [...cur, { role: "assistant", content: message }]);
      } finally {
        setLoading(false);
      }
    },
    [messages],
  );

  const reset = useCallback(() => {
    const clear = async () => {
      setError(null);
      try {
        await apiFetch("/api/chat", { method: "DELETE" });
        setMessages([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not clear chat history");
      }
    };
    void clear();
  }, []);

  const clearLocal = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    reset,
    clearLocal,
    loading,
    historyLoading,
    error,
  };
}
