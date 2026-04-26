import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { PaloVerdeCallout } from "@/components/gridwise/PaloVerdeCallout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatHour, intensityClass } from "@/lib/gridwise";
import { CircleAlert, CircleCheck, Loader2, RefreshCw } from "lucide-react";

interface GridData {
  zone: string;
  intensity: { carbonIntensity: number; datetime: string };
  history: { history: { carbonIntensity: number; datetime: string }[] };
}

interface HourlyPoint {
  hour: number;
  carbonIntensity: number;
  datetime: string;
}

export default function ForecastPage() {
  const [grid, setGrid] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGrid = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grid-intensity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: "Phoenix, Arizona" }),
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
  };

  useEffect(() => {
    loadGrid();
  }, []);

  const hourly = useMemo(() => {
    const raw = grid?.history?.history ?? [];
    return raw.slice(-24).map((point): HourlyPoint => ({
      hour: hourInArizona(point.datetime),
      carbonIntensity: point.carbonIntensity,
      datetime: point.datetime,
    }));
  }, [grid]);

  const guidance = useMemo(() => buildGuidance(hourly), [hourly]);

  return (
    <AppShell title="Grid outlook" subtitle="Based on the latest live grid history available for Phoenix, AZ.">
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent carbon intensity</h2>
            <Button variant="ghost" size="icon" onClick={loadGrid} disabled={loading} className="h-8 w-8">
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
          ) : hourly.length ? (
            <>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {hourly.map((point) => {
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
                      <div className={`mt-0.5 text-sm font-semibold text-intensity-${cls}`}>{Math.round(point.carbonIntensity)}</div>
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
              No live history was returned, so GridWise is not showing a forecast.
            </div>
          )}
        </Card>

        {guidance && (
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Data-derived guidance</h2>
            <div className="space-y-3">
              <Reco
                icon={<CircleCheck className="h-5 w-5 text-intensity-low" />}
                title="Cleaner recent window"
                body={<><span className="font-medium text-intensity-low">{guidance.cleanWindow}</span> had the lowest recent carbon intensity. If tomorrow follows the same pattern, target this window for flexible loads.</>}
              />
              <Reco
                icon={<CircleAlert className="h-5 w-5 text-intensity-high" />}
                title="Dirtier recent window"
                body={<><span className="font-medium text-intensity-high">{guidance.dirtyWindow}</span> was the highest recent window. Avoid EV charging, dryer runs, and other high-draw appliances here when you can.</>}
              />
            </div>
          </Card>
        )}

        <PaloVerdeCallout />
      </div>
    </AppShell>
  );
}

function buildGuidance(hourly: HourlyPoint[]) {
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

function hourInArizona(datetime: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      hour: "numeric",
      hour12: false,
    }).format(new Date(datetime)),
  );
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

const Reco = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) => (
  <div className="flex gap-3 rounded-xl border border-border bg-background/40 p-3">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</div>
    </div>
  </div>
);
