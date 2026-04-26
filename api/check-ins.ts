import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import { resolveRequestedUserId } from "./_lib/admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actualUserId = await requireUser(req, res);
  if (!actualUserId) return;
  const userId = resolveRequestedUserId(actualUserId, req.query.demoUserId);
  await ensureSchema();

  if (req.method === "GET") {
    const date = typeof req.query.date === "string" ? req.query.date : null;
    if (date) {
      const { rows } = await sql`
        SELECT date, usages, per_appliance, total_lbs, saved_lbs
        FROM check_ins WHERE user_id = ${userId} AND date = ${date}
      `;
      return res.status(200).json({ checkIn: rows[0] ?? null });
    }
    const { rows } = await sql`
      SELECT date, usages, per_appliance, total_lbs, saved_lbs
      FROM check_ins WHERE user_id = ${userId} ORDER BY date ASC
    `;
    return res.status(200).json({ checkIns: rows });
  }

  if (req.method === "PUT") {
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

  res.setHeader("Allow", "GET, PUT, POST");
  return res.status(405).end();
}
