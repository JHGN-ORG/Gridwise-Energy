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
    // TO_CHAR forces a YYYY-MM-DD string regardless of pg-driver Date coercion.
    // Without it, a JS Date returned for a DATE column was JSON-serialized as
    // UTC ISO and shifted one day off in evening Arizona timezones.
    const date = typeof req.query.date === "string" ? req.query.date : null;
    if (date) {
      const { rows } = await sql`
        SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date,
               usages, per_appliance, total_lbs, saved_lbs
        FROM check_ins WHERE user_id = ${userId} AND date = ${date}
      `;
      return res.status(200).json({ checkIn: rows[0] ?? null });
    }
    const { rows } = await sql`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date,
             usages, per_appliance, total_lbs, saved_lbs
      FROM check_ins WHERE user_id = ${userId} ORDER BY date DESC
    `;
    return res.status(200).json({ checkIns: rows });
  }

  if (req.method === "PUT") {
    if (requestedDemo) return res.status(403).json({ error: "demo check-ins are read-only" });
    const ci = req.body ?? {};
    await sql`
      INSERT INTO check_ins (user_id, date, usages, per_appliance, total_lbs, saved_lbs)
      VALUES (
        ${userId},
        ${ci.date},
        ${JSON.stringify(ci.usages ?? [])}::jsonb,
        ${JSON.stringify(ci.per_appliance ?? [])}::jsonb,
        ${ci.total_lbs ?? 0},
        ${ci.saved_lbs ?? 0}
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        usages = EXCLUDED.usages,
        per_appliance = EXCLUDED.per_appliance,
        total_lbs = EXCLUDED.total_lbs,
        saved_lbs = EXCLUDED.saved_lbs,
        updated_at = now()
    `;
    return res.status(204).end();
  }

  if (req.method === "POST") {
    if (requestedDemo) return res.status(403).json({ error: "demo check-ins are read-only" });
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (req.body?.skipIfAny) {
      const { rows: existing } = await sql`SELECT 1 FROM check_ins WHERE user_id = ${userId} LIMIT 1`;
      if (existing.length) return res.status(204).end();
    }
    for (const ci of rows) {
      await sql`
        INSERT INTO check_ins (user_id, date, usages, per_appliance, total_lbs, saved_lbs)
        VALUES (
          ${userId},
          ${ci.date},
          ${JSON.stringify(ci.usages ?? [])}::jsonb,
          ${JSON.stringify(ci.per_appliance ?? [])}::jsonb,
          ${ci.total_lbs ?? 0},
          ${ci.saved_lbs ?? 0}
        )
        ON CONFLICT (user_id, date) DO NOTHING
      `;
    }
    return res.status(204).end();
  }

  if (req.method === "DELETE") {
    if (requestedDemo) return res.status(403).json({ error: "demo check-ins are read-only" });
    const date = typeof req.query.date === "string" ? req.query.date : null;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
      await sql`DELETE FROM check_ins WHERE user_id = ${userId} AND date = ${date}`;
      return res.status(204).end();
    }
    await sql`DELETE FROM check_ins WHERE user_id = ${userId}`;
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, POST, DELETE");
  return res.status(405).end();
}

function getDemoUserId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.startsWith("demo:")) return null;
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}
