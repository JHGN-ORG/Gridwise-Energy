import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, sql } from "./_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  try {
    await ensureSchema();

    // Query leaderboard, joining profiles with their total saved_lbs
    const { rows: leaderboard } = await sql`
      SELECT 
        p.user_id as "userId",
        p.name,
        p.city,
        COALESCE((SELECT SUM(saved_lbs) FROM check_ins c WHERE c.user_id = p.user_id), 0) AS "totalSaved"
      FROM profiles p
      WHERE p.leaderboard_opt_in = true
      ORDER BY "totalSaved" DESC, p.created_at ASC
      LIMIT 100;
    `;

    const { rows: communityTotalRow } = await sql`
      SELECT SUM(saved_lbs) as "total" FROM check_ins
    `;
    const communityTotal = communityTotalRow[0]?.total ?? 0;

    return res.status(200).json({
      leaderboard: leaderboard.map((r, i) => ({
        rank: i + 1,
        userId: String(r.userId),
        name: String(r.name),
        city: String(r.city),
        totalSaved: Number(r.totalSaved),
      })),
      communityTotal: Number(communityTotal),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("leaderboard error:", message);
    return res.status(500).json({ error: message });
  }
}
