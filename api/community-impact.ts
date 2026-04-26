import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, sql } from "./_lib/db.js";

// Lightweight aggregate endpoint. The /api/leaderboard endpoint already
// returns communityTotal, but it also serializes the top-100 board which is
// wasteful for callers (e.g. Dashboard) that only want the headline number.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT
        COALESCE(SUM(saved_lbs), 0) AS "totalSaved",
        COUNT(DISTINCT user_id)     AS "contributors"
      FROM check_ins;
    `;
    const row = rows[0] ?? {};
    // Same caching policy as /api/leaderboard — both are global aggregates.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      totalSaved: Number(row.totalSaved ?? 0),
      contributors: Number(row.contributors ?? 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("community-impact error:", message);
    return res.status(500).json({ error: message });
  }
}
