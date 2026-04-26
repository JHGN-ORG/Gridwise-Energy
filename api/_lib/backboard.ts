const BACKBOARD_BASE_URL = "https://app.backboard.io/api";

export interface BackboardAssistant {
  assistant_id?: string;
  id?: string;
}

export interface BackboardThread {
  thread_id?: string;
  id?: string;
}

export interface BackboardMessage {
  content?: string;
  text?: string;
  message?: string;
  assistant_id?: string;
  thread_id?: string;
}

function apiKey() {
  const key = process.env.BACKBOARD_API_KEY;
  if (!key) throw new Error("BACKBOARD_API_KEY is not configured");
  return key;
}

async function backboardFetch<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", apiKey());

  const res = await fetch(`${BACKBOARD_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backboard ${res.status} ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function createGridwiseAssistant() {
  const assistant = await backboardFetch<BackboardAssistant>("/assistants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "GridWise Energy Coach",
      system_prompt:
        "You are the GridWise Energy Coach. Answer questions about a user's electricity carbon insights, forecast, appliance timing, and emissions. Use only supplied GridWise context for user-specific facts. Do not invent grades, emissions, percentages, grid mix, costs, or forecasts. If the needed data is missing, say what is missing and give general guidance separately. Be concise, practical, and encouraging.",
    }),
  });

  const assistantId = assistant.assistant_id ?? assistant.id;
  if (!assistantId) throw new Error("Backboard did not return an assistant id");
  return assistantId;
}

export async function createBackboardThread(assistantId: string) {
  const thread = await backboardFetch<BackboardThread>(`/assistants/${assistantId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const threadId = thread.thread_id ?? thread.id;
  if (!threadId) throw new Error("Backboard did not return a thread id");
  return threadId;
}

export async function sendBackboardMessage(threadId: string, content: string) {
  const form = new FormData();
  const requestedMemoryMode = process.env.BACKBOARD_MEMORY_MODE ?? "Readonly";
  const memoryMode =
    process.env.BACKBOARD_ASSISTANT_ID && requestedMemoryMode.toLowerCase() === "auto"
      ? "Readonly"
      : requestedMemoryMode;

  form.set("content", content);
  form.set("stream", "false");
  form.set("memory", memoryMode);

  if (process.env.BACKBOARD_LLM_PROVIDER) {
    form.set("llm_provider", process.env.BACKBOARD_LLM_PROVIDER);
  }
  if (process.env.BACKBOARD_MODEL_NAME) {
    form.set("model_name", process.env.BACKBOARD_MODEL_NAME);
  }

  const message = await backboardFetch<BackboardMessage>(`/threads/${threadId}/messages`, {
    method: "POST",
    body: form,
  });

  return message.content ?? message.text ?? message.message ?? "";
}
