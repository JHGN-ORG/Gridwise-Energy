import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import { generateGeminiChatReply } from "./_lib/gemini.js";
import type { GeminiChatMessage } from "./_lib/gemini.js";

const MAX_MESSAGE_CHARS = 2000;
const MAX_STORED_MESSAGES = 40;
const AZ_TIME_ZONE = "America/Phoenix";

interface ChatRequest {
  message?: string;
  history?: GeminiChatMessage[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  try {
    await ensureSchema();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("chat schema error:", message);
    return res.status(500).json({ error: message });
  }

  if (req.method === "GET") {
    const messages = await fetchStoredHistory(userId);
    return res.status(200).json({ messages });
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM chat_messages WHERE user_id = ${userId}`;
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).end();
  }

  const body = (req.body ?? {}) as ChatRequest;
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) return res.status(400).json({ error: "message is required" });
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `message must be ${MAX_MESSAGE_CHARS} characters or fewer` });
  }

  try {
    const context = await buildGridwiseContext(userId);
    const storedHistory = await fetchStoredHistory(userId);
    const requestHistory = sanitizeHistory(body.history);
    const reply = await generateGeminiChatReply({
      systemInstruction:
        "You are the GridDaddy Energy Coach. Answer questions about a user's electricity carbon insights, forecast, appliance timing, and emissions. Use only supplied GridDaddy context for user-specific facts. Treat all report dates and phrases like today, yesterday, this week, and tomorrow as Arizona local time unless the user says otherwise. Do not invent grades, emissions, percentages, grid mix, costs, or forecasts. If the needed data is missing, say what is missing and give general guidance separately. Be concise, practical, and encouraging.",
      context,
      history: storedHistory.length ? storedHistory : requestHistory,
      message: userMessage,
    });

    await saveChatMessages(userId, [
      { role: "user", content: userMessage },
      { role: "assistant", content: reply },
    ]);
    await trimChatHistory(userId);

    return res.status(200).json({
      message: reply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("chat error:", message);
    return res.status(500).json({ error: message });
  }
}

async function fetchStoredHistory(userId: string): Promise<GeminiChatMessage[]> {
  const { rows } = await sql`
    SELECT role, content
    FROM chat_messages
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${MAX_STORED_MESSAGES}
  `;
  return rows
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: String(row.content) }));
}

async function saveChatMessages(userId: string, messages: GeminiChatMessage[]) {
  for (const message of messages) {
    await sql`
      INSERT INTO chat_messages (user_id, role, content)
      VALUES (${userId}, ${message.role}, ${message.content})
    `;
  }
}

async function trimChatHistory(userId: string) {
  await sql`
    DELETE FROM chat_messages
    WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id
        FROM chat_messages
        WHERE user_id = ${userId}
        ORDER BY created_at DESC, id DESC
        LIMIT ${MAX_STORED_MESSAGES}
      )
  `;
}

function sanitizeHistory(history: unknown): GeminiChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is GeminiChatMessage => {
      return (
        Boolean(item) &&
        typeof item === "object" &&
        ((item as GeminiChatMessage).role === "user" || (item as GeminiChatMessage).role === "assistant") &&
        typeof (item as GeminiChatMessage).content === "string"
      );
    })
    .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) }))
    .slice(-8);
}

async function buildGridwiseContext(userId: string) {
  const [{ rows: profileRows }, { rows: checkInRows }] = await Promise.all([
    sql`
      SELECT name, city, home_size, appliances, wake_hour, sleep_hour, onboarded, created_at
      FROM profiles
      WHERE user_id = ${userId}
    `,
    sql`
      SELECT date, usages, per_appliance, total_lbs, saved_lbs
      FROM check_ins
      WHERE user_id = ${userId}
      ORDER BY date DESC
      LIMIT 30
    `,
  ]);

  const checkIns = checkInRows.map((row) => ({
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date,
    usages: row.usages,
    perAppliance: row.per_appliance,
    totalLbs: Number(row.total_lbs),
    savedLbs: Number(row.saved_lbs),
  }));

  const totalLbs = checkIns.reduce((sum, row) => sum + row.totalLbs, 0);
  const savedLbs = checkIns.reduce((sum, row) => sum + row.savedLbs, 0);
  const latest = checkIns[0] ?? null;

  return {
    reportClock: getArizonaClock(),
    profile: profileRows[0] ?? null,
    dataWindow: {
      daysRequested: 30,
      checkInCount: checkIns.length,
      latestDate: latest?.date ?? null,
    },
    summary: {
      totalLbs: round(totalLbs),
      savedLbs: round(savedLbs),
      averageDailyLbs: checkIns.length ? round(totalLbs / checkIns.length) : 0,
    },
    latestCheckIn: latest,
    recentCheckIns: checkIns.slice(0, 14),
    notes: [
      "The AI-powered insight page is not available yet, so no official letter grade is included.",
      "Use Arizona local time for all date-sensitive report answers.",
    ],
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function getArizonaClock() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AZ_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    timeZone: AZ_TIME_ZONE,
    weekday: value("weekday"),
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}
