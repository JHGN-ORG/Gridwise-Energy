import { apiFetch } from "./api";
import {
  ApplianceId,
  ArizonaCity,
  CheckIn,
  HomeSize,
  Profile,
  buildCheckIn,
  dateOffsetISO,
  HOURLY_INTENSITY,
} from "./gridwise";

interface ProfileRow {
  user_id: string;
  name: string;
  city: string;
  home_size: string;
  appliances: ApplianceId[];
  wake_hour: number;
  sleep_hour: number;
  onboarded: boolean;
  created_at: string;
}

interface CheckInRow {
  date: string;
  usages: { applianceId: ApplianceId; startHour: number; endHour: number }[];
  per_appliance: { applianceId: ApplianceId; lbs: number; optimalStart: number; optimalLbs: number }[];
  total_lbs: number | string;
  saved_lbs: number | string;
}

const rowToProfile = (r: ProfileRow): Profile => ({
  name: r.name,
  city: (r.city as ArizonaCity) ?? "Phoenix",
  homeSize: (r.home_size as HomeSize) ?? "Medium",
  appliances: Array.isArray(r.appliances) ? r.appliances : [],
  wakeHour: r.wake_hour,
  sleepHour: r.sleep_hour,
  joinedAt: r.created_at,
});

const rowToCheckIn = (r: CheckInRow): CheckIn => ({
  date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
  usages: r.usages ?? [],
  perAppliance: r.per_appliance ?? [],
  totalLbs: Number(r.total_lbs),
  savedLbs: Number(r.saved_lbs),
});

const profileToBody = (p: Profile, onboarded: boolean) => ({
  name: p.name,
  city: p.city,
  home_size: p.homeSize,
  appliances: p.appliances,
  wake_hour: p.wakeHour,
  sleep_hour: p.sleepHour,
  onboarded,
});

const checkInToBody = (ci: CheckIn) => ({
  date: ci.date,
  usages: ci.usages,
  per_appliance: ci.perAppliance,
  total_lbs: ci.totalLbs,
  saved_lbs: ci.savedLbs,
});

export async function fetchProfile(_userId: string): Promise<{ profile: Profile | null; onboarded: boolean }> {
  const res = await apiFetch("/api/profile");
  const { profile } = (await res.json()) as { profile: ProfileRow | null };
  if (!profile) return { profile: null, onboarded: false };
  return { profile: rowToProfile(profile), onboarded: !!profile.onboarded };
}

export async function saveProfile(_userId: string, p: Profile, markOnboarded = true) {
  await apiFetch("/api/profile", { method: "PUT", body: JSON.stringify(profileToBody(p, markOnboarded)) });
}

export async function fetchCheckIns(_userId: string): Promise<CheckIn[]> {
  const res = await apiFetch("/api/check-ins");
  const { checkIns } = (await res.json()) as { checkIns: CheckInRow[] };
  return (checkIns ?? []).map(rowToCheckIn);
}

export async function fetchCheckIn(_userId: string, date: string): Promise<CheckIn | null> {
  const res = await apiFetch(`/api/check-ins?date=${encodeURIComponent(date)}`);
  const { checkIn } = (await res.json()) as { checkIn: CheckInRow | null };
  return checkIn ? rowToCheckIn(checkIn) : null;
}

export async function upsertCheckIn(_userId: string, ci: CheckIn) {
  await apiFetch("/api/check-ins", { method: "PUT", body: JSON.stringify(checkInToBody(ci)) });
}

// Seed 14 days of realistic data on first onboarding (only if user has no check-ins yet)
export async function seedInitialCheckIns(_userId: string, profile: Profile) {
  const owned = profile.appliances.length ? profile.appliances : (["hvac", "dishwasher", "washer"] as ApplianceId[]);

  const rows: ReturnType<typeof checkInToBody>[] = [];
  for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
    const date = dateOffsetISO(daysAgo);
    const progress = (14 - daysAgo) / 13;
    const usages: { applianceId: ApplianceId; startHour: number; endHour: number }[] = [];
    if (owned.includes("hvac")) {
      const len = Math.round(5 - progress * 2);
      const start = 17 - Math.round(progress * 4);
      usages.push({ applianceId: "hvac", startHour: start, endHour: start + len });
    }
    if (owned.includes("dishwasher")) {
      const start = 19 + Math.round(progress * 4);
      usages.push({ applianceId: "dishwasher", startHour: start, endHour: start + 1 });
    }
    if (owned.includes("dryer")) {
      const start = 18 - Math.round(progress * 5);
      usages.push({ applianceId: "dryer", startHour: start, endHour: start + 1 });
    }
    if (owned.includes("washer")) {
      const start = 17 - Math.round(progress * 4);
      usages.push({ applianceId: "washer", startHour: start, endHour: start + 1 });
    }
    if (owned.includes("ev")) {
      const start = progress > 0.5 ? 0 : 18;
      usages.push({ applianceId: "ev", startHour: start, endHour: start + 3 });
    }
    if (owned.includes("water_heater")) {
      usages.push({ applianceId: "water_heater", startHour: 6, endHour: 8 });
    }
    if (owned.includes("pool_pump")) {
      usages.push({ applianceId: "pool_pump", startHour: 11, endHour: 15 });
    }
    const ci = buildCheckIn(date, usages, profile.homeSize, HOURLY_INTENSITY);
    rows.push(checkInToBody(ci));
  }
  if (rows.length) {
    await apiFetch("/api/check-ins", {
      method: "POST",
      body: JSON.stringify({ rows, skipIfAny: true }),
    });
  }
}
