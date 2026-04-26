const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: unknown;
}

export interface GeminiChatMessage {
  role: "user" | "assistant";
  content: string;
}

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

export async function generateGeminiChatReply(options: {
  systemInstruction: string;
  context: unknown;
  history?: GeminiChatMessage[];
  message: string;
}) {
  const model = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash";
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey())}`;
  const contents = [
    ...(options.history ?? []).slice(-8).map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: [
            "GridWise user context:",
            JSON.stringify(options.context, null, 2),
            "",
            "User question:",
            options.message,
          ].join("\n"),
        },
      ],
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.4),
        maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 800),
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!reply) throw new Error("Gemini returned an empty response");
  return reply;
}
