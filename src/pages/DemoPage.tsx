import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/gridwise/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HistoryChart } from "@/components/HistoryChart";
import { APPLIANCE_MAP, CheckIn, streakCount } from "@/lib/gridwise";
import { BarChart3, Leaf, Loader2, LogIn, Sparkles, Trophy } from "lucide-react";

interface DemoProfileRow {
  name: string;
  city: string;
  home_size: string;
  appliances: string[];
  wake_hour: number;
  sleep_hour: number;
  created_at: string;
}

interface DemoCheckInRow {
  date: string;
  usages: { applianceId: keyof typeof APPLIANCE_MAP; startHour: number; endHour: number }[];
  per_appliance: { applianceId: keyof typeof APPLIANCE_MAP; lbs: number; optimalStart: number; optimalLbs: number }[];
  total_lbs: number | string;
  saved_lbs: number | string;
}

interface DemoResponse {
  demoUserId: string;
  profile: DemoProfileRow | null;
  checkIns: DemoCheckInRow[];
}

export default function DemoPage() {
  const [params] = useSearchParams();
  const demoUserId = params.get("demoUserId") || "demo:default";
  const [data, setData] = useState<DemoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/demo-public?demoUserId=${encodeURIComponent(demoUserId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setData(body as DemoResponse);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load demo"))
      .finally(() => setLoading(false));
  }, [demoUserId]);

  const checkIns = useMemo(() => (data?.checkIns ?? []).map(rowToCheckIn), [data]);
  const totalLbs = checkIns.reduce((sum, row) => sum + row.totalLbs, 0);
  const savedLbs = checkIns.reduce((sum, row) => sum + row.savedLbs, 0);
  const latest = checkIns[checkIns.length - 1] ?? null;
  const worst = computeWorstHabit(checkIns);

  if (loading) {
    return (
      <AppShell title="Demo">
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  if (error || !data?.profile) {
    return (
      <AppShell title="Demo">
        <Card className="bg-card-gradient border-border p-6">
          <h2 className="text-lg font-semibold">Demo unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "No demo profile exists yet. Ask an admin to create demo:default."}
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="GridDaddy demo" subtitle={`${data.profile.name} | ${data.profile.city}, AZ | ${data.demoUserId}`}>
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Trophy className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.18em]">Read-only demo account</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This is sample data generated from the admin panel. Sign in to create your own real profile.
              </p>
            </div>
            <Button asChild>
              <Link to="/auth"><LogIn className="mr-2 h-4 w-4" /> Sign in</Link>
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Check-ins" value={String(checkIns.length)} icon={<BarChart3 className="h-4 w-4" />} />
          <Stat label="CO2 logged" value={`${totalLbs.toFixed(1)} lbs`} icon={<Sparkles className="h-4 w-4" />} />
          <Stat label="Could save" value={`${savedLbs.toFixed(1)} lbs`} icon={<Leaf className="h-4 w-4" />} />
          <Stat label="Streak" value={`${streakCount(checkIns)} days`} icon={<Trophy className="h-4 w-4" />} />
        </div>

        {latest && (
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Latest check-in</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Date" value={latest.date} />
              <Stat label="Impact" value={`${latest.totalLbs.toFixed(2)} lbs`} />
            </div>
          </Card>
        )}

        <Card className="bg-card-gradient border-border p-5">
          <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Demo history</h2>
          <HistoryChart data={checkIns.map((row) => ({ datetime: `${row.date}T12:00:00-07:00`, carbonIntensity: row.totalLbs }))} />
        </Card>

        {worst && (
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Pattern</h2>
            <p className="text-sm text-muted-foreground">
              Biggest recurring driver: <span className="font-medium text-foreground">{APPLIANCE_MAP[worst.applianceId]?.label ?? worst.applianceId}</span>,
              contributing about <span className="font-medium text-intensity-high">{worst.lbs.toFixed(2)} lbs</span> across generated check-ins.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function rowToCheckIn(row: DemoCheckInRow): CheckIn {
  return {
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date,
    usages: row.usages ?? [],
    perAppliance: row.per_appliance ?? [],
    totalLbs: Number(row.total_lbs),
    savedLbs: Number(row.saved_lbs),
  };
}

function computeWorstHabit(checkIns: CheckIn[]) {
  const tally = new Map<keyof typeof APPLIANCE_MAP, number>();
  for (const checkIn of checkIns) {
    for (const item of checkIn.perAppliance) {
      tally.set(item.applianceId, (tally.get(item.applianceId) ?? 0) + item.lbs);
    }
  }
  let best: { applianceId: keyof typeof APPLIANCE_MAP; lbs: number } | null = null;
  tally.forEach((lbs, applianceId) => {
    if (!best || lbs > best.lbs) best = { applianceId, lbs };
  });
  return best;
}

const Stat = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <Card className="bg-card-gradient border-border p-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="mt-2 text-2xl font-semibold">{value}</div>
  </Card>
);
