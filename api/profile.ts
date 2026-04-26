import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import { resolveRequestedUserId } from "./_lib/admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestedDemo = getDemoUserId(req.query.demoUserId);
  let userId = requestedDemo;
  if (!userId) {
    const actualUserId = await requireUser(req, res);
    if (!actualUserId) return;
    userId = resolveRequestedUserId(actualUserId, req.query.demoUserId);
  }
  await ensureSchema();

  if (req.method === "GET") {
    const { rows } = await sql`
      SELECT user_id, name, city, home_size, appliances, wake_hour, sleep_hour, onboarded, created_at
      FROM profiles WHERE user_id = ${userId}
    `;
    return res.status(200).json({ profile: rows[0] ?? null });
  }

  if (req.method === "PUT") {
    if (requestedDemo) return res.status(403).json({ error: "demo profiles are read-only" });
    const b = req.body ?? {};
    const onboarded = b.onboarded !== false;
    await sql`
      INSERT INTO profiles (user_id, name, city, home_size, appliances, wake_hour, sleep_hour, onboarded)
      VALUES (
        ${userId},
        ${b.name ?? ""},
        ${b.city ?? "Phoenix"},
        ${b.home_size ?? "Medium"},
        ${JSON.stringify(b.appliances ?? [])}::jsonb,
        ${b.wake_hour ?? 7},
        ${b.sleep_hour ?? 23},
        ${onboarded}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        city = EXCLUDED.city,
        home_size = EXCLUDED.home_size,
        appliances = EXCLUDED.appliances,
        wake_hour = EXCLUDED.wake_hour,
        sleep_hour = EXCLUDED.sleep_hour,
        onboarded = EXCLUDED.onboarded,
        updated_at = now()
    `;
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end();
}

function getDemoUserId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.startsWith("demo:")) return null;
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}
