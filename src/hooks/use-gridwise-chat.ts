import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface GridwiseChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  assistantId?: string;
  threadId?: string;
  message: string;
}

export function useGridwiseChat() {
  const [messages, setMessages] = useState<GridwiseChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            threadId,
            assistantId,
          }),
        });
        const data = (await res.json()) as ChatResponse;
        setThreadId(data.threadId ?? null);
        setAssistantId(data.assistantId ?? null);
        setMessages((cur) => [...cur, { role: "assistant", content: data.message }]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not send message";
        setError(message);
        setMessages((cur) => [...cur, { role: "assistant", content: message }]);
      } finally {
        setLoading(false);
      }
    },
    [assistantId, threadId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setThreadId(null);
    setAssistantId(null);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    reset,
    loading,
    error,
    threadId,
  };
}
