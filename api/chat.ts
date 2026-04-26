import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import { generateGeminiChatReply } from "./_lib/gemini.js";
import type { GeminiChatMessage } from "./_lib/gemini.js";
import { resolveRequestedUserId } from "./_lib/admin.js";

const MAX_MESSAGE_CHARS = 2000;
const MAX_STORED_MESSAGES = 40;
const AZ_TIME_ZONE = "America/Phoenix";

interface ChatRequest {
  message?: string;
  history?: GeminiChatMessage[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestedDemo = getDemoUserId(req.query.demoUserId);
  let userId = requestedDemo;
  if (!userId) {
    const actualUserId = await requireUser(req, res);
    if (!actualUserId) return;
    userId = resolveRequestedUserId(actualUserId, req.query.demoUserId);
  }

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
    // Compute the user's local "today" once and pin it into the system
    // instruction. Without this the model leans on its own training-cutoff
    // date and consistently reports "today" as one day off from Arizona local.
    const az = context.reportClock;
    const reply = await generateGeminiChatReply({
      systemInstruction: [
        `Current date and time: ${az.weekday}, ${az.date}, ${az.time} local time in ${az.timeZone} (Arizona, no DST).`,
        `Treat this as the authoritative "now". When the user says "today", they mean ${az.date}; "yesterday" means the prior calendar date in Arizona; "this week" means the calendar week containing ${az.date}. Ignore any internal sense of the current date — it is wrong.`,
        "",
        "You are GridDaddy — a practical, plainspoken energy coach for residential users in Arizona. Your job is to help people shift heavy electrical loads (HVAC, EV charging, dryers, dishwashers, water heaters, pool pumps) to the cleanest hours of the local grid, so they reduce CO₂ without changing what they actually do. You are not an environmentalist — you are an optimizer.",
        "",
        "Voice: direct, specific, no hedging. Sound like a friend who happens to know the local grid. No emojis. No exclamation marks. No 'sustainability' lectures.",
        "",
        "GROUNDING RULES (these are non-negotiable):",
        "- Quote actual numbers from the supplied context. Never invent emissions figures, percentages, grid mix, costs, or forecasts.",
        "- When recommending a time-shift, pull the specific cleaner window from perAppliance[].optimalStart and the savings from perAppliance[].optimalLbs. Format like: 'Run it 2pm–4pm instead — saves about 0.34 lbs CO₂ per cycle.'",
        "- When summarizing impact, translate lbs CO₂ into one of these equivalents: ÷ 0.89 → miles in an avg gas car (e.g. '4.2 lbs ≈ 4.7 miles avoided'); ÷ 0.0822 → smartphone full charges; × 365 ÷ 48 → tree-days of absorption. Pick whichever feels most concrete for the question.",
        "- When the user asks about their rank, use leaderboard.targetCompetitor.recentlyShiftedAppliances to suggest specific shifts that would close the gap.",
        "- When applianceSummary is available, base 'worst habit' / 'biggest opportunity' answers on it directly. Highest totalLbs = worst habit. Highest avgSavingsOpportunityLbs = biggest opportunity.",
        "- If the data needed for a precise answer is missing, say what's missing in one sentence, then give general guidance separately.",
        "",
        "RESPONSE SHAPE for typical questions (be brief — under 200 words):",
        "1. One-sentence direct answer.",
        "2. The single most relevant number from context (cite the field, e.g. 'your dryer averages 0.41 lbs/run').",
        "3. One concrete next action with a specific time window if applicable.",
        "4. Optional: an equivalency line if it makes the impact tangible.",
        "",
        "EXAMPLES:",
        "",
        "Q: What's my worst habit?",
        "A: Your dryer. Across your last 30 days, dryer runs total 12.4 lbs CO₂ — more than any other appliance. Most of that is because you've been running it 6pm–7pm during the evening peak. Shift dryer cycles to 2pm–3pm and you'd save ~0.28 lbs per load. Over a typical week (4 loads) that's about 1.1 lbs avoided — roughly 1.2 miles of gasoline driving.",
        "",
        "Q: When should I run the dishwasher tonight?",
        "A: Run it 11pm–midnight. Tonight's grid intensity drops sharply after 10pm in your zone (Palo Verde nuclear holds the baseload while solar is offline and gas peakers shut down). Your last dishwasher cycle hit 0.18 lbs at 7pm — running it at 11pm cuts that to roughly 0.11 lbs.",
        "",
        "Q: How do I close the gap with the person ahead of me?",
        "A: They're 4.2 lbs ahead of you and have been shifting their EV charging — that's where you have the most ground to make up. Your EV runs are averaging 1.8 lbs each at 6pm–9pm. Switching to an overnight charge (1am–4am) would cut roughly 0.6 lbs per session. Three sessions and you've passed them.",
      ].join("\n"),
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
      SELECT name, city, home_size, appliances, wake_hour, sleep_hour, onboarded, leaderboard_opt_in, created_at
      FROM profiles
      WHERE user_id = ${userId}
    `,
    // TO_CHAR keeps the date as a YYYY-MM-DD string regardless of pg driver
    // settings. Previously we relied on `typeof row.date === "string"` which
    // wasn't always true — when @vercel/postgres returned a JS Date, the
    // fallthrough JSON-stringified it as a UTC ISO timestamp, which was
    // visibly one day off in Arizona evenings.
    sql`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date,
             usages, per_appliance, total_lbs, saved_lbs
      FROM check_ins
      WHERE user_id = ${userId}
      ORDER BY date DESC
      LIMIT 30
    `,
  ]);

  const clock = getArizonaClock();
  const todayDate = clock.date;
  const yesterdayDate = isoDateOffset(todayDate, -1);

  const checkIns = checkInRows.map((row) => ({
    date: String(row.date),
    usages: row.usages as Array<{ applianceId: string; startHour: number; endHour: number }>,
    perAppliance: row.per_appliance as Array<{ applianceId: string; lbs: number; optimalStart: number; optimalLbs: number }>,
    totalLbs: Number(row.total_lbs),
    savedLbs: Number(row.saved_lbs),
  }));

  const totalLbs = checkIns.reduce((sum, row) => sum + row.totalLbs, 0);
  const savedLbs = checkIns.reduce((sum, row) => sum + row.savedLbs, 0);
  const latest = checkIns[0] ?? null;
  const profileData = profileRows[0];

  const leaderboardContext = await buildLeaderboardContext(userId, profileData);

  // Pre-compute the human label so the model never has to infer it from raw
  // dates. With this in place the model can quote `relativeLabel` directly.
  const labelFor = (date: string) =>
    date === todayDate ? "today" : date === yesterdayDate ? "yesterday" : `${daysBetween(date, todayDate)} days ago`;

  return {
    reportClock: clock,
    profile: profileData ?? null,
    dataWindow: {
      daysRequested: 30,
      checkInCount: checkIns.length,
      latestDate: latest?.date ?? null,
      latestRelative: latest ? labelFor(latest.date) : null,
    },
    summary: {
      totalLbs: round(totalLbs),
      savedLbs: round(savedLbs),
      averageDailyLbs: checkIns.length ? round(totalLbs / checkIns.length) : 0,
    },
    // Latest day kept in full so the model can answer "what did I do today" precisely.
    latestCheckIn: latest && { ...latest, relativeLabel: labelFor(latest.date) },
    // Pre-aggregated per-appliance stats across the full 30-day window. Replaces
    // dumping 14 raw check-ins (≈ 4 KB of JSON) into the prompt every turn.
    applianceSummary: summarizeByAppliance(checkIns),
    // Last 7 days kept in compact form (no usages/perAppliance arrays).
    recentDaysCompact: checkIns.slice(0, 7).map((c) => ({
      date: c.date,
      relativeLabel: labelFor(c.date),
      totalLbs: round(c.totalLbs),
      savedLbs: round(c.savedLbs),
    })),
    leaderboard: leaderboardContext,
    notes: [
      `Today in Arizona is ${todayDate}. A check-in with that exact date is TODAY's check-in — never call it yesterday's.`,
      "When describing when a check-in happened, prefer the pre-computed relativeLabel ('today' / 'yesterday' / 'N days ago') over re-deriving it from the date string.",
      "The AI-powered insight page is not available yet, so no official letter grade is included.",
      "applianceSummary aggregates across the full 30-day window — use it for habit/trend questions.",
      "If the user asks about their rank or how to improve, use the leaderboard context to analyze the competitor ahead of them and suggest shifting similar appliances to catch up.",
      "IMPORTANT DISCLAIMER: Occasionally remind the user that you are an AI assistant and can make mistakes, especially regarding complex energy forecasting."
    ],
  };
}

// Pure date-string arithmetic on YYYY-MM-DD inputs. Avoids JS Date timezone
// pitfalls — we operate on the calendar date directly.
function isoDateOffset(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const out = new Date(t);
  return `${out.getUTCFullYear()}-${String(out.getUTCMonth() + 1).padStart(2, "0")}-${String(out.getUTCDate()).padStart(2, "0")}`;
}

function daysBetween(earlier: string, later: string): number {
  const [y1, m1, d1] = earlier.split("-").map(Number);
  const [y2, m2, d2] = later.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// Aggregate per-appliance stats so the model gets habit-level signal without
// having to scan a full check-in array. Cuts prompt size and gives the LLM
// pre-computed answers to most "which appliance is my worst" questions.
function summarizeByAppliance(checkIns: Array<{
  perAppliance: Array<{ applianceId: string; lbs: number; optimalLbs: number }>;
}>) {
  const buckets = new Map<string, { runs: number; totalLbs: number; totalOptimalLbs: number }>();
  for (const ci of checkIns) {
    for (const p of ci.perAppliance ?? []) {
      const bucket = buckets.get(p.applianceId) ?? { runs: 0, totalLbs: 0, totalOptimalLbs: 0 };
      bucket.runs += 1;
      bucket.totalLbs += Number(p.lbs) || 0;
      bucket.totalOptimalLbs += Number(p.optimalLbs) || 0;
      buckets.set(p.applianceId, bucket);
    }
  }
  return Array.from(buckets.entries())
    .map(([applianceId, b]) => ({
      applianceId,
      runs: b.runs,
      totalLbs: round(b.totalLbs),
      avgLbsPerRun: b.runs ? round(b.totalLbs / b.runs) : 0,
      avgSavingsOpportunityLbs: b.runs ? round((b.totalLbs - b.totalOptimalLbs) / b.runs) : 0,
    }))
    .sort((a, b) => b.totalLbs - a.totalLbs);
}

// Targeted leaderboard lookup: returns only the user's own rank/total and the
// single competitor immediately above them. Replaces the previous full-board
// scan that ran on every chat message.
async function buildLeaderboardContext(userId: string, profileData: { leaderboard_opt_in?: boolean } | undefined) {
  if (!profileData) return null;
  if (!profileData.leaderboard_opt_in) {
    return { status: "User has explicitly opted out of the leaderboard. Suggest they opt back in via their profile page to see their rank." };
  }

  const { rows } = await sql`
    WITH totals AS (
      SELECT p.user_id, p.name, p.created_at,
             COALESCE(SUM(c.saved_lbs), 0) AS total_saved
      FROM profiles p
      LEFT JOIN check_ins c ON c.user_id = p.user_id
      WHERE p.leaderboard_opt_in = true
      GROUP BY p.user_id, p.name, p.created_at
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY total_saved DESC, created_at ASC) AS rnk,
             COUNT(*) OVER () AS total_users
      FROM totals
    ),
    me AS (
      SELECT rnk, total_saved, total_users FROM ranked WHERE user_id = ${userId}
    )
    SELECT r.user_id, r.name, r.total_saved, r.rnk, r.total_users,
           CASE WHEN r.user_id = ${userId} THEN 'me' ELSE 'target' END AS role
    FROM ranked r, me
    WHERE r.user_id = ${userId} OR r.rnk = me.rnk - 1
  `;

  const meRow = rows.find((r) => r.role === "me");
  if (!meRow) return null;

  const targetRow = rows.find((r) => r.role === "target");
  let targetCompetitor: {
    name: string;
    rank: number;
    totalSavedLbs: number;
    recentlyShiftedAppliances: string[];
  } | null = null;

  if (targetRow) {
    // Single follow-up query for the target's recent usage signals. O(3 rows).
    const { rows: targetCheckIns } = await sql`
      SELECT usages FROM check_ins WHERE user_id = ${String(targetRow.user_id)} ORDER BY date DESC LIMIT 3
    `;
    const recentUsages = targetCheckIns
      .flatMap((r) => (r.usages as Array<{ applianceId: string }>) ?? [])
      .map((u) => u.applianceId);
    targetCompetitor = {
      name: String(targetRow.name),
      rank: Number(targetRow.rnk),
      totalSavedLbs: Number(targetRow.total_saved),
      recentlyShiftedAppliances: Array.from(new Set(recentUsages)),
    };
  }

  return {
    myRank: Number(meRow.rnk),
    totalOptedInUsers: Number(meRow.total_users),
    myTotalSavedLbs: Number(meRow.total_saved),
    targetCompetitor,
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

function getDemoUserId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.startsWith("demo:")) return null;
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}
