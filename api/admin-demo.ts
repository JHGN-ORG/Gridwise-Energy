import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import { isAdminUser } from "./_lib/admin.js";

const DEMO_PREFIX = "demo:";
const DEFAULT_DEMO_USER_ID = "demo:default";
const INTENSITY_CURVE = [210, 210, 210, 210, 210, 210, 280, 280, 280, 280, 280, 190, 190, 190, 190, 260, 260, 380, 380, 380, 380, 230, 230, 230];
const G_TO_LB = 0.00220462;

const APPLIANCES: Record<string, { watts: number; defaultHours: number }> = {
  hvac: { watts: 3500, defaultHours: 4 },
  ev: { watts: 7200, defaultHours: 3 },
  washer: { watts: 500, defaultHours: 1 },
  dryer: { watts: 5000, defaultHours: 1 },
  dishwasher: { watts: 1800, defaultHours: 1 },
  water_heater: { watts: 4500, defaultHours: 2 },
  pool_pump: { watts: 1100, defaultHours: 4 },
};

const HOME_SIZE: Record<string, { multiplier: number; baselineWatts: number }> = {
  Small: { multiplier: 0.75, baselineWatts: 200 },
  Medium: { multiplier: 1, baselineWatts: 400 },
  Large: { multiplier: 1.4, baselineWatts: 700 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const adminUserId = await requireUser(req, res);
  if (!adminUserId) return;
  if (!isAdminUser(adminUserId)) return res.status(403).json({ error: "admin access required", userId: adminUserId });

  await ensureSchema();

  const demoUserId = cleanDemoUserId(String(req.query.demoUserId || req.body?.demoUserId || DEFAULT_DEMO_USER_ID));
  if (!demoUserId) return res.status(400).json({ error: "demoUserId must start with demo:" });

  if (req.method === "GET") {
    return res.status(200).json(await loadDemo(demoUserId, adminUserId));
  }

  if (req.method === "PUT") {
    await upsertProfile(demoUserId, req.body?.profile ?? {});
    return res.status(200).json(await loadDemo(demoUserId, adminUserId));
  }

  if (req.method === "POST") {
    const action = String(req.body?.action ?? "");
    if (action === "generateCheckIns") {
      const profile = await getProfile(demoUserId);
      await generateCheckIns(demoUserId, profile, Number(req.body?.days ?? 14), String(req.body?.scenario ?? "evening-heavy"));
      return res.status(200).json(await loadDemo(demoUserId, adminUserId));
    }
    if (action === "clearCheckIns") {
      await sql`DELETE FROM check_ins WHERE user_id = ${demoUserId}`;
      return res.status(200).json(await loadDemo(demoUserId, adminUserId));
    }
    if (action === "clearChat") {
      await sql`DELETE FROM chat_messages WHERE user_id = ${demoUserId}`;
      return res.status(200).json(await loadDemo(demoUserId, adminUserId));
    }
    return res.status(400).json({ error: "unknown action" });
  }

  res.setHeader("Allow", "GET, PUT, POST");
  return res.status(405).end();
}

function cleanDemoUserId(value: string) {
  const trimmed = value.trim() || DEFAULT_DEMO_USER_ID;
  if (!trimmed.startsWith(DEMO_PREFIX)) return null;
  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}

async function loadDemo(demoUserId: string, adminUserId: string) {
  const profile = await getProfile(demoUserId);
  const { rows: checkIns } = await sql`
    SELECT date, usages, per_appliance, total_lbs, saved_lbs
    FROM check_ins
    WHERE user_id = ${demoUserId}
    ORDER BY date DESC
    LIMIT 30
  `;
  const { rows: chatRows } = await sql`SELECT count(*)::int AS count FROM chat_messages WHERE user_id = ${demoUserId}`;
  return {
    adminUserId,
    demoUserId,
    profile,
    checkIns,
    chatMessageCount: chatRows[0]?.count ?? 0,
  };
}

async function getProfile(demoUserId: string) {
  const { rows } = await sql`
    SELECT user_id, name, city, home_size, appliances, wake_hour, sleep_hour, onboarded, created_at
    FROM profiles
    WHERE user_id = ${demoUserId}
  `;
  return rows[0] ?? defaultProfile(demoUserId);
}

function defaultProfile(demoUserId: string) {
  return {
    user_id: demoUserId,
    name: "Demo Dana",
    city: "Phoenix",
    home_size: "Medium",
    appliances: ["hvac", "dishwasher", "dryer", "ev"],
    wake_hour: 7,
    sleep_hour: 23,
    onboarded: true,
    created_at: new Date().toISOString(),
  };
}

async function upsertProfile(demoUserId: string, body: Record<string, unknown>) {
  const profile = {
    ...defaultProfile(demoUserId),
    ...body,
  };
  await sql`
    INSERT INTO profiles (user_id, name, city, home_size, appliances, wake_hour, sleep_hour, onboarded)
    VALUES (
      ${demoUserId},
      ${String(profile.name || "Demo Dana")},
      ${String(profile.city || "Phoenix")},
      ${String(profile.home_size || "Medium")},
      ${JSON.stringify(Array.isArray(profile.appliances) ? profile.appliances : [])}::jsonb,
      ${Number(profile.wake_hour ?? 7)},
      ${Number(profile.sleep_hour ?? 23)},
      true
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      city = EXCLUDED.city,
      home_size = EXCLUDED.home_size,
      appliances = EXCLUDED.appliances,
      wake_hour = EXCLUDED.wake_hour,
      sleep_hour = EXCLUDED.sleep_hour,
      onboarded = true,
      updated_at = now()
  `;
}

async function generateCheckIns(demoUserId: string, profile: any, days: number, scenario: string) {
  const count = Math.max(1, Math.min(60, Math.round(days || 14)));
  const appliances = Array.isArray(profile.appliances) && profile.appliances.length
    ? profile.appliances
    : ["hvac", "dishwasher", "dryer"];

  await sql`DELETE FROM check_ins WHERE user_id = ${demoUserId}`;

  for (let i = count - 1; i >= 0; i--) {
    const date = dateOffsetArizona(i);
    const usages = buildDemoUsages(appliances, scenario, i);
    const checkIn = buildCheckIn(date, usages, String(profile.home_size || "Medium"));
    await sql`
      INSERT INTO check_ins (user_id, date, usages, per_appliance, total_lbs, saved_lbs)
      VALUES (
        ${demoUserId},
        ${checkIn.date},
        ${JSON.stringify(checkIn.usages)}::jsonb,
        ${JSON.stringify(checkIn.per_appliance)}::jsonb,
        ${checkIn.total_lbs},
        ${checkIn.saved_lbs}
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        usages = EXCLUDED.usages,
        per_appliance = EXCLUDED.per_appliance,
        total_lbs = EXCLUDED.total_lbs,
        saved_lbs = EXCLUDED.saved_lbs,
        updated_at = now()
    `;
  }
}

function buildDemoUsages(appliances: string[], scenario: string, daysAgo: number) {
  const progress = daysAgo % 7;
  const cleaner = scenario === "clean-shifter";
  const mixed = scenario === "mixed";
  return appliances.flatMap((id) => {
    const spec = APPLIANCES[id];
    if (!spec) return [];
    if (id === "pool_pump") return [{ applianceId: id, startHour: cleaner ? 11 : 15, endHour: cleaner ? 15 : 19 }];
    if (id === "ev") return [{ applianceId: id, startHour: cleaner ? 0 : mixed ? 22 : 18, endHour: cleaner ? 3 : mixed ? 25 : 21 }];
    if (id === "hvac") return [{ applianceId: id, startHour: cleaner ? 13 : 17, endHour: cleaner ? 16 : 21 }];
    if (id === "dryer") return progress % 2 === 0 ? [{ applianceId: id, startHour: cleaner ? 22 : 18, endHour: cleaner ? 23 : 19 }] : [];
    if (id === "dishwasher") return [{ applianceId: id, startHour: cleaner ? 23 : mixed ? 21 : 19, endHour: cleaner ? 24 : mixed ? 22 : 20 }];
    if (id === "washer") return [{ applianceId: id, startHour: cleaner ? 14 : 17, endHour: cleaner ? 15 : 18 }];
    if (id === "water_heater") return [{ applianceId: id, startHour: 6, endHour: 8 }];
    return [{ applianceId: id, startHour: cleaner ? 12 : 18, endHour: cleaner ? 12 + spec.defaultHours : 18 + spec.defaultHours }];
  });
}

function buildCheckIn(date: string, usages: any[], homeSize: string) {
  const per_appliance = usages.map((usage) => {
    const watts = adjustedWatts(APPLIANCES[usage.applianceId]?.watts ?? 1000, homeSize);
    const lbs = lbsForRun(watts, usage.startHour, usage.endHour);
    const duration = Math.max(1, usage.endHour - usage.startHour);
    const opt = optimalWindow(watts, duration);
    return { applianceId: usage.applianceId, lbs, optimalStart: opt.start, optimalLbs: opt.lbs };
  });
  const applianceTotal = per_appliance.reduce((sum, row) => sum + row.lbs, 0);
  const optimalTotal = per_appliance.reduce((sum, row) => sum + row.optimalLbs, 0);
  const baseline = lbsForRun(HOME_SIZE[homeSize]?.baselineWatts ?? 400, 0, 24);
  return {
    date,
    usages,
    per_appliance,
    total_lbs: applianceTotal + baseline,
    saved_lbs: Math.max(0, applianceTotal - optimalTotal),
  };
}

function adjustedWatts(watts: number, homeSize: string) {
  return watts * (HOME_SIZE[homeSize]?.multiplier ?? 1);
}

function lbsForRun(watts: number, startHour: number, endHour: number) {
  let grams = 0;
  for (let h = startHour; h < endHour; h++) {
    grams += (watts / 1000) * INTENSITY_CURVE[((h % 24) + 24) % 24];
  }
  return grams * G_TO_LB;
}

function optimalWindow(watts: number, duration: number) {
  let best = { start: 0, lbs: Infinity };
  for (let start = 0; start <= 24 - duration; start++) {
    const lbs = lbsForRun(watts, start, start + duration);
    if (lbs < best.lbs) best = { start, lbs };
  }
  return best;
}

function dateOffsetArizona(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
