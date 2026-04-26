import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import {
  createBackboardThread,
  createGridwiseAssistant,
  sendBackboardMessage,
} from "./_lib/backboard.js";

const MAX_MESSAGE_CHARS = 2000;

interface ChatRequest {
  message?: string;
  threadId?: string;
  assistantId?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const body = (req.body ?? {}) as ChatRequest;
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) return res.status(400).json({ error: "message is required" });
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `message must be ${MAX_MESSAGE_CHARS} characters or fewer` });
  }

  try {
    await ensureSchema();

    const assistantId =
      process.env.BACKBOARD_ASSISTANT_ID ??
      body.assistantId ??
      (await createGridwiseAssistant());

    const threadId = body.threadId ?? (await createBackboardThread(assistantId));
    const context = await buildGridwiseContext(userId);
    const content = [
      "GridWise user context:",
      JSON.stringify(context, null, 2),
      "",
      "User question:",
      userMessage,
    ].join("\n");

    const reply = await sendBackboardMessage(threadId, content);

    return res.status(200).json({
      assistantId,
      threadId,
      message: reply || "I could not generate a response from Backboard.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("chat error:", message);
    return res.status(500).json({ error: message });
  }
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
      "Forecast data may still be placeholder-driven elsewhere in the app.",
    ],
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
