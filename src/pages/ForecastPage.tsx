import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { PaloVerdeCallout } from "@/components/gridwise/PaloVerdeCallout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { forecastCarbonIntensity } from "@/lib/forecast";
import { formatHour, intensityClass } from "@/lib/gridwise";
import { fetchProfile } from "@/lib/repo";
import { CircleAlert, CircleCheck, Loader2, RefreshCw } from "lucide-react";

interface GridData {
  zone: string;
  intensity: { carbonIntensity: number; datetime: string };
  history: { history: { carbonIntensity: number; datetime: string }[] };
}

export default function ForecastPage() {
  const { user, loading: authLoading } = useAuth();
  const [grid, setGrid] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileCity, setProfileCity] = useState<string | null | undefined>(undefined);
  const forecastCity = profileCity ?? "Phoenix";

  useEffect(() => {
    if (authLoading) {
      setProfileCity(undefined);
      return;
    }
    if (!user) {
      setProfileCity(null);
      return;
    }
    setProfileCity(undefined);
    fetchProfile(user.id)
      .then(({ profile }) => setProfileCity(profile?.city ?? null))
      .catch(() => setProfileCity(null));
  }, [authLoading, user]);

  const loadGrid = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grid-intensity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: `${forecastCity}, Arizona` }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      setGrid(data as GridData);
    } catch (err) {
      setGrid(null);
      setError(err instanceof Error ? err.message : "Could not load live grid data");
    } finally {
      setLoading(false);
    }
  }, [forecastCity]);

  useEffect(() => {
    if (profileCity === undefined) return;
    loadGrid();
  }, [loadGrid, profileCity]);

  const forecast = useMemo(() => forecastCarbonIntensity(grid?.history?.history ?? [], 24), [grid]);
  const guidance = useMemo(() => buildGuidance(forecast?.points ?? []), [forecast]);

  return (
    <AppShell title="Grid outlook" subtitle={`ML forecast for the next 24 hours in ${forecastCity}, AZ.`}>
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Predicted carbon intensity</h2>
            <Button variant="ghost" size="icon" onClick={loadGrid} disabled={loading || profileCity === undefined} className="h-8 w-8">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          {loading && !grid ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              Real grid data is unavailable right now: {error}
            </div>
          ) : forecast?.points.length ? (
            <>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {forecast.points.map((point) => {
                  const cls = intensityClass(point.carbonIntensity);
                  return (
                    <div
                      key={point.datetime}
                      className="rounded-xl border p-2 text-center"
                      style={{
                        borderColor: `hsl(var(--intensity-${cls}) / 0.4)`,
                        background: `hsl(var(--intensity-${cls}) / 0.12)`,
                      }}
                    >
                      <div className="text-[10px] text-muted-foreground">{formatHour(point.hour)}</div>
                      <div className={`mt-0.5 text-sm font-semibold text-intensity-${cls}`}>{point.carbonIntensity}</div>
                      <div className="text-[9px] text-muted-foreground">gCO2</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <Legend cls="low" label="Cleaner" />
                <Legend cls="medium" label="Moderate" />
                <Legend cls="high" label="Dirtier" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Zone {grid?.zone ?? "unknown"} | latest update {grid ? formatArizonaDateTime(grid.intensity.datetime) : "unknown"}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              Not enough live history was returned to fit a forecast model.
            </div>
          )}
        </Card>

        {forecast && (
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Model</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Method" value="Linear regression" />
              <Stat label="Confidence" value={forecast.confidence} />
              <Stat label="Fit" value={`${Math.round(forecast.r2 * 100)}%`} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Uses recent Electricity Maps history with a time trend and hour-of-day seasonality. This is a lightweight forecast, not a utility-grade dispatch model.
            </p>
          </Card>
        )}

        {guidance && (
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Data-derived guidance</h2>
            <div className="space-y-3">
              <Reco
                icon={<CircleCheck className="h-5 w-5 text-intensity-low" />}
                title="Predicted cleaner window"
                body={<><span className="font-medium text-intensity-low">{guidance.cleanWindow}</span> is the lowest predicted 3-hour window. Target this window for flexible loads.</>}
              />
              <Reco
                icon={<CircleAlert className="h-5 w-5 text-intensity-high" />}
                title="Predicted dirtier window"
                body={<><span className="font-medium text-intensity-high">{guidance.dirtyWindow}</span> is the highest predicted 3-hour window. Avoid EV charging, dryer runs, and other high-draw appliances here when you can.</>}
              />
            </div>
          </Card>
        )}

        <PaloVerdeCallout />
      </div>
    </AppShell>
  );
}

function buildGuidance(hourly: { hour: number; carbonIntensity: number }[]) {
  if (hourly.length < 3) return null;
  const windows = hourly.slice(0, -2).map((point, index) => {
    const slice = hourly.slice(index, index + 3);
    const avg = slice.reduce((sum, p) => sum + p.carbonIntensity, 0) / slice.length;
    return { start: point.hour, end: hourly[index + 2].hour + 1, avg };
  });
  const clean = windows.reduce((best, cur) => (cur.avg < best.avg ? cur : best), windows[0]);
  const dirty = windows.reduce((best, cur) => (cur.avg > best.avg ? cur : best), windows[0]);
  return {
    cleanWindow: `${formatHour(clean.start)}-${formatHour(clean.end)}`,
    dirtyWindow: `${formatHour(dirty.start)}-${formatHour(dirty.end)}`,
  };
}

function formatArizonaDateTime(datetime: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(datetime));
}

const Legend = ({ cls, label }: { cls: "low" | "medium" | "high"; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--intensity-${cls}))` }} />
    {label}
  </span>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-background/40 p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-semibold capitalize">{value}</div>
  </div>
);

const Reco = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) => (
  <div className="flex gap-3 rounded-xl border border-border bg-background/40 p-3">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</div>
    </div>
  </div>
);
