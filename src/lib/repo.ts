import { supabase } from "@/integrations/supabase/client";
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
  user_id: string;
  date: string;
  usages: { applianceId: ApplianceId; startHour: number; endHour: number }[];
  per_appliance: { applianceId: ApplianceId; lbs: number; optimalStart: number; optimalLbs: number }[];
  total_lbs: number;
  saved_lbs: number;
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
  date: r.date,
  usages: r.usages ?? [],
  perAppliance: r.per_appliance ?? [],
  totalLbs: Number(r.total_lbs),
  savedLbs: Number(r.saved_lbs),
});

export async function fetchProfile(userId: string): Promise<{ profile: Profile | null; onboarded: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,name,city,home_size,appliances,wake_hour,sleep_hour,onboarded,created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { profile: null, onboarded: false };
  return { profile: rowToProfile(data as unknown as ProfileRow), onboarded: !!data.onboarded };
}

export async function saveProfile(userId: string, p: Profile, markOnboarded = true) {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        name: p.name,
        city: p.city,
        home_size: p.homeSize,
        appliances: p.appliances,
        wake_hour: p.wakeHour,
        sleep_hour: p.sleepHour,
        onboarded: markOnboarded,
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function fetchCheckIns(userId: string): Promise<CheckIn[]> {
  const { data, error } = await supabase
    .from("check_ins")
    .select("user_id,date,usages,per_appliance,total_lbs,saved_lbs")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data as unknown as CheckInRow[]) ?? []).map(rowToCheckIn);
}

export async function fetchCheckIn(userId: string, date: string): Promise<CheckIn | null> {
  const { data, error } = await supabase
    .from("check_ins")
    .select("user_id,date,usages,per_appliance,total_lbs,saved_lbs")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCheckIn(data as unknown as CheckInRow) : null;
}

export async function upsertCheckIn(userId: string, ci: CheckIn) {
  const row = {
    user_id: userId,
    date: ci.date,
    usages: ci.usages,
    per_appliance: ci.perAppliance,
    total_lbs: ci.totalLbs,
    saved_lbs: ci.savedLbs,
  };
  const { error } = await supabase
    .from("check_ins")
    .upsert(row as any, { onConflict: "user_id,date" });
  if (error) throw error;
}

// Seed 14 days of realistic data on first onboarding (only if user has no check-ins yet)
export async function seedInitialCheckIns(userId: string, profile: Profile) {
  const existing = await fetchCheckIns(userId);
  if (existing.length > 0) return;
  const owned = profile.appliances.length ? profile.appliances : (["hvac", "dishwasher", "washer"] as ApplianceId[]);

  const rows: any[] = [];
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
    rows.push({
      user_id: userId,
      date: ci.date,
      usages: ci.usages,
      per_appliance: ci.perAppliance,
      total_lbs: ci.totalLbs,
      saved_lbs: ci.savedLbs,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("check_ins").upsert(rows as any, { onConflict: "user_id,date" });
    if (error) throw error;
  }
}
