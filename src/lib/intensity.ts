// Intensity scale (gCO2eq/kWh) — based on Electricity Maps thresholds
export type IntensityLevel = "low" | "medium" | "high";

export function classifyIntensity(gco2: number): IntensityLevel {
  if (gco2 < 150) return "low";
  if (gco2 < 400) return "medium";
  return "high";
}

export function intensityLabel(level: IntensityLevel): string {
  return { low: "Clean", medium: "Moderate", high: "Dirty" }[level];
}

export function intensityHeadline(level: IntensityLevel): string {
  return {
    low: "Great time to use power",
    medium: "Use power thoughtfully",
    high: "Shift heavy usage if you can",
  }[level];
}

export type SourceKey =
  | "nuclear" | "solar" | "wind" | "hydro" | "geothermal" | "biomass"
  | "gas" | "coal" | "oil" | "unknown" | "hydro discharge" | "battery discharge";

export const SOURCE_META: Record<string, { label: string; color: string; clean: boolean; renewable: boolean }> = {
  nuclear:     { label: "Nuclear",      color: "hsl(var(--source-nuclear))",    clean: true,  renewable: false },
  solar:       { label: "Solar",        color: "hsl(var(--source-solar))",      clean: true,  renewable: true },
  wind:        { label: "Wind",         color: "hsl(var(--source-wind))",       clean: true,  renewable: true },
  hydro:       { label: "Hydro",        color: "hsl(var(--source-hydro))",      clean: true,  renewable: true },
  geothermal:  { label: "Geothermal",   color: "hsl(var(--source-geothermal))", clean: true,  renewable: true },
  biomass:     { label: "Biomass",      color: "hsl(var(--source-biomass))",    clean: false, renewable: true },
  gas:         { label: "Natural Gas",  color: "hsl(var(--source-gas))",        clean: false, renewable: false },
  coal:        { label: "Coal",         color: "hsl(var(--source-coal))",       clean: false, renewable: false },
  oil:         { label: "Oil",          color: "hsl(var(--source-oil))",        clean: false, renewable: false },
  unknown:     { label: "Unknown",      color: "hsl(var(--source-unknown))",    clean: false, renewable: false },
  "hydro discharge":   { label: "Hydro Storage",   color: "hsl(var(--source-hydro))", clean: true, renewable: true },
  "battery discharge": { label: "Battery",         color: "hsl(var(--source-wind))",  clean: true, renewable: true },
};

export function getSourceMeta(key: string) {
  return SOURCE_META[key.toLowerCase()] ?? SOURCE_META.unknown;
}

export interface Recommendation {
  title: string;
  detail: string;
  icon: "now" | "soon" | "wait";
}

export function buildRecommendations(
  level: IntensityLevel,
  history: { carbonIntensity: number; datetime: string }[]
): Recommendation[] {
  // Find the cleanest hour in the next ~24h projection — we use historical 24h
  // as a proxy for daily pattern (best-effort consumer guidance)
  const cleanest = history.length
    ? history.reduce((a, b) => (a.carbonIntensity < b.carbonIntensity ? a : b))
    : null;
  const cleanHour = cleanest
    ? new Date(cleanest.datetime).toLocaleTimeString([], { hour: "numeric" })
    : "overnight";

  if (level === "low") {
    return [
      { icon: "now", title: "Run the dishwasher now", detail: "The grid is at its cleanest — your kWh are mostly carbon-free." },
      { icon: "now", title: "Charge your EV", detail: "Plug in now to lock in the low-carbon mix." },
      { icon: "now", title: "Pre-cool or pre-heat", detail: "Bank thermal energy while it's clean." },
    ];
  }
  if (level === "medium") {
    return [
      { icon: "soon", title: "Delay the dishwasher", detail: `Try around ${cleanHour} when grid is typically cleaner.` },
      { icon: "soon", title: "Schedule EV charging", detail: "Set your charger to start during the off-peak window." },
      { icon: "now", title: "Light usage is fine", detail: "Lights, laptops, and cooking have minor impact right now." },
    ];
  }
  return [
    { icon: "wait", title: "Hold off on the dishwasher", detail: `Wait until ~${cleanHour} — gas and coal are doing the heavy lifting.` },
    { icon: "wait", title: "Pause EV charging", detail: "Each kWh now is significantly more carbon-intensive." },
    { icon: "wait", title: "Skip the dryer", detail: "Air-dry instead, or wait for the cleaner overnight window." },
  ];
}
