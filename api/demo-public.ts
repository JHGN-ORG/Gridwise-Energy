import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, sql } from "./_lib/db.js";

const DEFAULT_DEMO_USER_ID = "demo:default";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  await ensureSchema();

  const demoUserId = cleanDemoUserId(String(req.query.demoUserId || DEFAULT_DEMO_USER_ID));
  if (!demoUserId) return res.status(400).json({ error: "demoUserId must start with demo:" });

  const [{ rows: profileRows }, { rows: checkIns }] = await Promise.all([
    sql`
      SELECT user_id, name, city, home_size, appliances, wake_hour, sleep_hour, onboarded, created_at
      FROM profiles
      WHERE user_id = ${demoUserId}
    `,
    sql`
      SELECT date, usages, per_appliance, total_lbs, saved_lbs
      FROM check_ins
      WHERE user_id = ${demoUserId}
      ORDER BY date ASC
    `,
  ]);

  return res.status(200).json({
    demoUserId,
    profile: profileRows[0] ?? null,
    checkIns,
  });
}

function cleanDemoUserId(value: string) {
  const trimmed = value.trim() || DEFAULT_DEMO_USER_ID;
  if (!trimmed.startsWith("demo:")) return null;
  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}
