import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { CommunityImpactStrip } from "@/components/gridwise/CommunityImpactStrip";
import { PaloVerdeCallout } from "@/components/gridwise/PaloVerdeCallout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { IntensityGauge } from "@/components/IntensityGauge";
import { SourceBreakdown } from "@/components/SourceBreakdown";
import { HistoryChart } from "@/components/HistoryChart";
import {
  APPLIANCE_MAP,
  ApplianceUsage,
  HOURLY_INTENSITY,
  HOME_SIZE_INFO,
  Profile,
  baselineDailyLbs,
  buildCheckIn,
  formatRange,
  todayISO,
} from "@/lib/gridwise";
import { fetchCheckIn, upsertCheckIn } from "@/lib/repo";
import { EquivalenciesGrid } from "@/components/gridwise/EquivalenciesGrid";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Leaf, Loader2, RefreshCw, Sparkles, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface GridData {
  location: { display_name: string };
  zone: string;
  intensity: { carbonIntensity: number; datetime: string };
  breakdown: {
    powerConsumptionBreakdown: Record<string, number>;
    fossilFreePercentage?: number;
    renewablePercentage?: number;
  };
  history: { history: { carbonIntensity: number; datetime: string }[] };
}

interface Row { on: boolean; range: [number, number]; }

export default function DashboardPage({ profile }: { profile: Profile }) {
  const { user, isDemo } = useAuth();
  const today = todayISO();

  // ---- Live grid data ----
  const [grid, setGrid] = useState<GridData | null>(null);
  const [gridLoading, setGridLoading] = useState(true);
  const [gridFallback, setGridFallback] = useState<string | null>(null);

  const fetchGrid = async () => {
    setGridLoading(true);
    setGridFallback(null);
    try {
      const r = await fetch("/api/grid-intensity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: `${profile.city}, Arizona` }),
      });
      const data = await r.json();
      if (!r.ok && data?.error !== "api_unauthorized") throw new Error(data?.error || `HTTP ${r.status}`);
      if (data?.error === "api_unauthorized") {
        setGridFallback(data.message);
        setGrid(null);
      } else if (data?.error) {
        throw new Error(data.message || data.error);
      } else {
        setGrid(data as GridData);
      }
    } catch (e) {
      setGridFallback(e instanceof Error ? e.message : "Could not load live grid");
    } finally {
      setGridLoading(false);
    }
  };

  // Debounce city changes — profile edits can fire multiple updates in
  // quick succession (form re-renders, save round-trip). Without this we'd
  // hit the grid API once per intermediate value.
  useEffect(() => {
    const t = setTimeout(() => { fetchGrid(); }, 500);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [profile.city]);

  // ---- Check-in form ----
  const [rows, setRows] = useState<Record<string, Row> | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof buildCheckIn>> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous in-flight guard. The `submitting` state flag flips after a
  // React commit, which leaves a window where rapid double-clicks can each
  // pass the disabled check and double-POST. The ref closes that window.
  const submitInFlight = useRef(false);

  useEffect(() => {
    if (!user) return;
    fetchCheckIn(user.id, today).then((existing) => {
      const r: Record<string, Row> = {};
      profile.appliances.forEach((id) => {
        const a = APPLIANCE_MAP[id];
        const used = existing?.usages.find((u) => u.applianceId === id);
        r[id] = used
          ? { on: true, range: [used.startHour, used.endHour] }
          : { on: false, range: [18, 18 + a.defaultHours] };
      });
      setRows(r);
      if (existing) setResult(existing);
    });
  }, [user, today, profile.appliances]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((cur) => (cur ? { ...cur, [id]: { ...cur[id], ...patch } } : cur));

  const liveIntensityCurve = useMemo(() => {
    const history = grid?.history?.history ?? [];
    if (history.length < 24) return null;
    return history.slice(-24).map((point) => point.carbonIntensity);
  }, [grid]);

  const submit = async () => {
    if (submitInFlight.current) return;
    if (!user || !rows) return;
    if (isDemo) {
      toast.message("Demo mode is read-only. Sign in to log your own appliance use.");
      return;
    }
    if (!liveIntensityCurve) {
      toast.error("Live grid data is required before calculating your report.");
      return;
    }
    const usages: ApplianceUsage[] = Object.entries(rows)
      .filter(([, r]) => r.on && r.range[1] > r.range[0])
      .map(([id, r]) => ({ applianceId: id as any, startHour: r.range[0], endHour: r.range[1] }));
    if (usages.length === 0) { toast.message("Nothing logged — check at least one appliance."); return; }
    submitInFlight.current = true;
    setSubmitting(true);
    try {
      const ci = buildCheckIn(today, usages, profile.homeSize, liveIntensityCurve);
      await upsertCheckIn(user.id, ci);
      setResult(ci);
      toast.success("Check-in saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  const dateLabel = new Date().toLocaleDateString(undefined, {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const baseline = liveIntensityCurve ? baselineDailyLbs(profile.homeSize, liveIntensityCurve) : 0;

  // Current live intensity from the grid API. The static curve is only a non-rendered fallback.
  const currentHour = new Date().getHours();
  const liveIntensity = grid?.intensity.carbonIntensity ?? HOURLY_INTENSITY[currentHour];
  const fossilFree = grid?.breakdown.fossilFreePercentage ?? 0;
  const renewable = grid?.breakdown.renewablePercentage ?? 0;

  return (
    <AppShell title={`Hi, ${profile.name.split(" ")[0]}`} subtitle={`${profile.city}, AZ · ${dateLabel}`}>
      <div className="space-y-6">
        <PaloVerdeCallout nuclearMW={grid?.breakdown.powerConsumptionBreakdown?.nuclear} />
        <CommunityImpactStrip />

        {/* Live grid header */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 bg-card-gradient border-border p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {grid ? "Live carbon intensity" : "Carbon intensity"}
              </h2>
              <Button variant="ghost" size="icon" onClick={fetchGrid} disabled={gridLoading} className="h-7 w-7">
                {gridLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {grid ? (
              <IntensityGauge value={liveIntensity} />
            ) : (
              <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                Live grid data is required to calculate a report.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-border">
              <Stat label="Fossil-free" value={`${fossilFree.toFixed(0)}%`} accent="low" />
              <Stat label="Renewable" value={`${renewable.toFixed(0)}%`} accent="medium" />
            </div>
            {false && gridFallback && (
              <p className="mt-3 text-xs text-muted-foreground">
                Live API unavailable — using Arizona baseline curve. <span className="opacity-70">({gridFallback.slice(0, 100)}…)</span>
              </p>
            )}
            {gridFallback && (
              <p className="mt-3 text-xs text-muted-foreground">
                Live API unavailable. <span className="opacity-70">({gridFallback.slice(0, 100)}...)</span>
              </p>
            )}
            {grid && (
              <div className="mt-3 text-xs text-muted-foreground">
                Grid zone: {grid.zone} · Updated {new Date(grid.intensity.datetime).toLocaleTimeString()}
              </div>
            )}
          </Card>

          <Card className="bg-card-gradient border-border p-5">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Live energy mix</h2>
            {grid ? (
              <SourceBreakdown breakdown={grid.breakdown.powerConsumptionBreakdown ?? {}} />
            ) : (
              <p className="text-sm text-muted-foreground">Connect to load mix.</p>
            )}
          </Card>
        </div>

        {grid && grid.history.history.length > 0 && (
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Last 24 hours</h2>
            <HistoryChart data={grid.history.history} />
          </Card>
        )}

        {/* Check-in */}
        <Card className="bg-card-gradient border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today’s appliance use</h2>
            <span className="text-[11px] text-muted-foreground">
              {profile.homeSize} home · ×{HOME_SIZE_INFO[profile.homeSize].wattageMultiplier} load
            </span>
          </div>
          {!rows ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">
              {profile.appliances.map((id) => {
                const a = APPLIANCE_MAP[id];
                const r = rows[id];
                if (!r) return null;
                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-4 transition-colors ${
                      r.on ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/20"
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox checked={r.on} onCheckedChange={(v) => update(id, { on: !!v })} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{a.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(a.watts * HOME_SIZE_INFO[profile.homeSize].wattageMultiplier).toLocaleString()} W (adjusted)
                        </div>
                      </div>
                      {r.on && <span className="text-xs text-primary font-medium">{formatRange(r.range[0], r.range[1])}</span>}
                    </label>
                    {r.on && (
                      <div className="mt-4">
                        <Slider
                          min={0} max={24} step={1}
                          value={r.range}
                          onValueChange={(v) => update(id, { range: [v[0], Math.max(v[0] + 1, v[1])] as [number, number] })}
                        />
                        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                          <span>12am</span><span>6am</span><span>noon</span><span>6pm</span><span>12am</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Button className="w-full mt-5" size="lg" onClick={submit} disabled={submitting || !rows || !liveIntensityCurve || isDemo}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isDemo ? "Demo mode is read-only" : "Calculate my impact"}
          </Button>
          {liveIntensityCurve && (
            <p className="mt-3 text-[11px] text-muted-foreground text-center">
              +{baseline.toFixed(2)} lbs/day baseline (always-on phantom load for {profile.homeSize.toLowerCase()} home)
            </p>
          )}
        </Card>

        {result && (
          <Card className="bg-card-gradient border-border p-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your impact today</h2>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="CO₂ emitted" value={`${result.totalLbs.toFixed(2)} lbs`} accent="high" />
              <Stat label="Could have saved" value={`${result.savedLbs.toFixed(2)} lbs`} accent="low" />
            </div>
            <div className="mt-5 space-y-2">
              {result.perAppliance.map((p) => {
                const a = APPLIANCE_MAP[p.applianceId];
                const usage = result.usages.find((u) => u.applianceId === p.applianceId)!;
                const dur = usage.endHour - usage.startHour;
                const isOptimal = usage.startHour === p.optimalStart;
                return (
                  <div key={p.applianceId} className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{a.label}</span>
                      <span className="text-intensity-high font-semibold">{p.lbs.toFixed(2)} lbs</span>
                    </div>
                    <div className="mt-1 text-xs">
                      {isOptimal ? (
                        <span className="inline-flex items-center gap-1 text-intensity-low">
                          <Leaf className="h-3 w-3" /> Optimal time chosen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <TrendingDown className="h-3 w-3 text-intensity-low" />
                          Cleaner if run at{" "}
                          <span className="text-intensity-low font-medium">
                            {formatRange(p.optimalStart, p.optimalStart + dur)}
                          </span>{" "}
                          ({p.optimalLbs.toFixed(2)} lbs)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {result.savedLbs > 0.01 && (
              <>
                <p className="mt-5 text-sm bg-intensity-low/10 border border-[hsl(var(--intensity-low)/0.3)] rounded-xl p-3">
                  <span className="text-intensity-low font-semibold">Shift it next time:</span> you’d have saved{" "}
                  <span className="font-semibold">{result.savedLbs.toFixed(2)} lbs CO₂</span> today.
                </p>
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    That's equivalent to
                  </div>
                  <EquivalenciesGrid lbsCO2={result.savedLbs} />
                </div>
              </>
            )}
          </Card>
        )}

      </div>
    </AppShell>
  );
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent: "low" | "medium" | "high" }) => (
  <div className="rounded-xl border border-border bg-background/40 p-4">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold mt-1 text-intensity-${accent}`}>{value}</div>
  </div>
);
