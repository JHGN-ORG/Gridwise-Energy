// GridWise data layer — Supabase-backed, with home-size factors.

export type ApplianceId =
  | "hvac"
  | "ev"
  | "washer"
  | "dryer"
  | "dishwasher"
  | "water_heater"
  | "pool_pump";

export const APPLIANCES: { id: ApplianceId; label: string; watts: number; defaultHours: number }[] = [
  { id: "hvac", label: "HVAC", watts: 3500, defaultHours: 4 },
  { id: "ev", label: "Electric Vehicle", watts: 7200, defaultHours: 3 },
  { id: "washer", label: "Washer", watts: 500, defaultHours: 1 },
  { id: "dryer", label: "Dryer", watts: 5000, defaultHours: 1 },
  { id: "dishwasher", label: "Dishwasher", watts: 1800, defaultHours: 1 },
  { id: "water_heater", label: "Electric Water Heater", watts: 4500, defaultHours: 2 },
  { id: "pool_pump", label: "Pool Pump", watts: 1100, defaultHours: 4 },
];

export const APPLIANCE_MAP: Record<ApplianceId, (typeof APPLIANCES)[number]> = APPLIANCES.reduce(
  (acc, a) => ({ ...acc, [a.id]: a }),
  {} as Record<ApplianceId, (typeof APPLIANCES)[number]>,
);

export const ARIZONA_CITIES = ["Phoenix", "Tucson", "Mesa", "Yuma", "Flagstaff"] as const;
export type ArizonaCity = (typeof ARIZONA_CITIES)[number];

export type HomeSize = "Small" | "Medium" | "Large";

// Home-size factors (per question answers)
export const HOME_SIZE_INFO: Record<HomeSize, {
  label: string;
  description: string;
  wattageMultiplier: number;
  baselineWatts: number; // always-on phantom load
  sqft: string;
}> = {
  Small:  { label: "Small",  description: "Apartment / 1–2 bedroom",  sqft: "< 1,200 sq ft", wattageMultiplier: 0.75, baselineWatts: 200 },
  Medium: { label: "Medium", description: "Typical 3-bedroom home",   sqft: "1,200–2,400 sq ft", wattageMultiplier: 1.0,  baselineWatts: 400 },
  Large:  { label: "Large",  description: "4+ bedroom / large house", sqft: "> 2,400 sq ft", wattageMultiplier: 1.4,  baselineWatts: 700 },
};

export interface Profile {
  name: string;
  city: ArizonaCity;
  homeSize: HomeSize;
  appliances: ApplianceId[];
  wakeHour: number;
  sleepHour: number;
  joinedAt: string;
}

export interface ApplianceUsage {
  applianceId: ApplianceId;
  startHour: number;
  endHour: number;
}

export interface PerAppliance {
  applianceId: ApplianceId;
  lbs: number;
  optimalStart: number;
  optimalLbs: number;
}

export interface CheckIn {
  date: string;
  usages: ApplianceUsage[];
  totalLbs: number;
  perAppliance: PerAppliance[];
  savedLbs: number;
}

// Arizona hourly carbon intensity gCO2/kWh — fallback / forecast curve
export const HOURLY_INTENSITY: number[] = (() => {
  const arr = new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    if (h < 6) arr[h] = 210;
    else if (h < 11) arr[h] = 280;
    else if (h < 15) arr[h] = 190;
    else if (h < 17) arr[h] = 260;
    else if (h < 21) arr[h] = 380;
    else arr[h] = 230;
  }
  return arr;
})();

export const G_PER_KWH_TO_LB_PER_KWH = 0.00220462;

// Apply home-size adjustment to wattage
export function adjustedWatts(watts: number, size: HomeSize): number {
  return watts * HOME_SIZE_INFO[size].wattageMultiplier;
}

// Daily baseline lbs from phantom load (24h * baselineWatts at avg intensity)
export function baselineDailyLbs(size: HomeSize): number {
  const watts = HOME_SIZE_INFO[size].baselineWatts;
  let totalGrams = 0;
  for (let h = 0; h < 24; h++) totalGrams += (watts / 1000) * HOURLY_INTENSITY[h];
  return totalGrams * G_PER_KWH_TO_LB_PER_KWH;
}

export function lbsForRun(watts: number, startHour: number, endHour: number, intensityCurve = HOURLY_INTENSITY): number {
  const hours = Math.max(0, endHour - startHour);
  if (hours === 0) return 0;
  let totalGrams = 0;
  for (let h = startHour; h < endHour; h++) {
    const idx = ((h % 24) + 24) % 24;
    totalGrams += (watts / 1000) * intensityCurve[idx];
  }
  return totalGrams * G_PER_KWH_TO_LB_PER_KWH;
}

export function optimalWindow(watts: number, duration: number, intensityCurve = HOURLY_INTENSITY): { start: number; lbs: number } {
  let best = { start: 0, lbs: Infinity };
  for (let start = 0; start <= 24 - duration; start++) {
    const lbs = lbsForRun(watts, start, start + duration, intensityCurve);
    if (lbs < best.lbs) best = { start, lbs };
  }
  return best;
}

export function intensityClass(g: number): "low" | "medium" | "high" {
  if (g < 230) return "low";
  if (g < 320) return "medium";
  return "high";
}

export function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const period = hh < 12 ? "am" : "pm";
  const display = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${display}${period}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatHour(start)} – ${formatHour(end)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateOffsetISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Build a check-in. Accepts optional intensity curve & home size for personalised math.
export function buildCheckIn(
  date: string,
  usages: ApplianceUsage[],
  homeSize: HomeSize = "Medium",
  intensityCurve: number[] = HOURLY_INTENSITY,
): CheckIn {
  const perAppliance: PerAppliance[] = usages.map((u) => {
    const a = APPLIANCE_MAP[u.applianceId];
    const w = adjustedWatts(a.watts, homeSize);
    const lbs = lbsForRun(w, u.startHour, u.endHour, intensityCurve);
    const duration = Math.max(1, u.endHour - u.startHour);
    const opt = optimalWindow(w, duration, intensityCurve);
    return { applianceId: u.applianceId, lbs, optimalStart: opt.start, optimalLbs: opt.lbs };
  });
  const applianceTotal = perAppliance.reduce((s, p) => s + p.lbs, 0);
  const optimalTotal = perAppliance.reduce((s, p) => s + p.optimalLbs, 0);
  const baseline = baselineDailyLbs(homeSize);
  return {
    date,
    usages,
    totalLbs: applianceTotal + baseline,
    perAppliance,
    savedLbs: Math.max(0, applianceTotal - optimalTotal),
  };
}

export function streakCount(checkIns: CheckIn[]): number {
  const dates = new Set(checkIns.map((c) => c.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = dateOffsetISO(i);
    if (dates.has(d)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}
