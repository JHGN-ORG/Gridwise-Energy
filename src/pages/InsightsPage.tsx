import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { fetchCheckIns, fetchProfile } from "@/lib/repo";
import {
  APPLIANCE_MAP,
  CheckIn,
  Profile,
  dateOffsetISO,
  formatHour,
  streakCount,
} from "@/lib/gridwise";
import { Atom, Award, Flame, Flag, Leaf, Loader2, Sparkles } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function InsightsPage() {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCheckIns(user.id).then(setCheckIns);
    fetchProfile(user.id).then((r) => setProfile(r.profile));
  }, [user]);

  const last7 = useMemo(() => {
    if (!checkIns) return [];
    const days: { date: string; lbs: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dateOffsetISO(i);
      const ci = checkIns.find((c) => c.date === d);
      const dt = new Date(d);
      days.push({ date: d, lbs: ci ? +ci.totalLbs.toFixed(2) : 0, label: dt.toLocaleDateString(undefined, { weekday: "short" }) });
    }
    return days;
  }, [checkIns]);

  if (!checkIns || !profile) {
    return (
      <AppShell title="Insights">
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  if (checkIns.length < 3) {
    return (
      <AppShell title="Insights" subtitle="Your trends, side-by-side with the grid.">
        <Card className="bg-card-gradient border-border p-8 text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Keep checking in!</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Log at least 3 days to unlock your weekly trend, worst habits, and savings opportunities.
          </p>
        </Card>
      </AppShell>
    );
  }

  const worst = computeWorstHabit(checkIns);
  const opportunity = computeBestOpportunity(checkIns);
  const streak = streakCount(checkIns);

  return (
    <AppShell title="Insights" subtitle={`${profile.city}, AZ · personalized to your home`}>
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Last 7 days · CO₂ (lbs)</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="lbs" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="bg-card-gradient border-border p-5">
            <div className="flex items-center gap-2 text-intensity-high mb-2">
              <Flame className="h-4 w-4" />
              <h3 className="text-xs uppercase tracking-[0.18em]">Worst habit</h3>
            </div>
            {worst ? (
              <>
                <div className="text-lg font-semibold">{APPLIANCE_MAP[worst.applianceId].label}</div>
                <div className="text-sm text-muted-foreground mt-1">Run mostly around <span className="text-foreground">{formatHour(worst.hour)}</span></div>
                <div className="mt-3 text-sm"><span className="text-intensity-high font-semibold">{worst.lbs.toFixed(2)} lbs</span> CO₂ across your check-ins.</div>
              </>
            ) : <div className="text-sm text-muted-foreground">Not enough data.</div>}
          </Card>

          <Card className="bg-card-gradient border-border p-5">
            <div className="flex items-center gap-2 text-intensity-low mb-2">
              <Leaf className="h-4 w-4" />
              <h3 className="text-xs uppercase tracking-[0.18em]">Best opportunity</h3>
            </div>
            {opportunity ? (
              <>
                <div className="text-lg font-semibold">{APPLIANCE_MAP[opportunity.applianceId].label}</div>
                <div className="text-sm text-muted-foreground mt-1">Shift to <span className="text-intensity-low font-medium">{formatHour(opportunity.optimalStart)}</span></div>
                <div className="mt-3 text-sm">Save <span className="text-intensity-low font-semibold">~{opportunity.savings.toFixed(2)} lbs</span> CO₂/week.</div>
              </>
            ) : <div className="text-sm text-muted-foreground">You’re running things at clean times — nice.</div>}
          </Card>
        </div>

        <Card className="nuclear-glow rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "hsl(var(--source-nuclear) / 0.2)", color: "hsl(var(--source-nuclear))" }}>
              <Atom className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nuclear contribution</h3>
              <p className="mt-2 text-sm leading-relaxed">
                This week, an estimated <span className="text-foreground font-semibold">48%</span> of your Arizona electricity came from zero-emission sources — including{" "}
                <span className="text-foreground font-semibold">Palo Verde Nuclear Generating Station</span>, the largest nuclear plant in the US by output.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Tag color="195 90% 60%" label="Nuclear · 28%" />
                <Tag color="45 95% 60%" label="Solar · 15%" />
                <Tag color="190 60% 70%" label="Wind · 5%" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-card-gradient border-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Streak</h3>
              <div className="text-3xl font-bold mt-1">{streak} <span className="text-base font-normal text-muted-foreground">days</span></div>
              <div className="text-xs text-muted-foreground mt-1">Keep it going — daily check-ins compound.</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              {streak >= 7 ? <Award className="h-6 w-6" /> : <Flag className="h-6 w-6" />}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

const Tag = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
    style={{ borderColor: `hsl(${color} / 0.4)`, color: `hsl(${color})`, background: `hsl(${color} / 0.08)` }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${color})` }} />
    {label}
  </span>
);

function computeWorstHabit(checkIns: CheckIn[]) {
  const tally = new Map<string, { applianceId: any; hour: number; lbs: number }>();
  for (const ci of checkIns) {
    for (const u of ci.usages) {
      const lbs = ci.perAppliance.find((p) => p.applianceId === u.applianceId)?.lbs ?? 0;
      const key = `${u.applianceId}:${u.startHour}`;
      const prev = tally.get(key);
      tally.set(key, { applianceId: u.applianceId, hour: u.startHour, lbs: (prev?.lbs ?? 0) + lbs });
    }
  }
  let best: { applianceId: any; hour: number; lbs: number } | null = null;
  tally.forEach((v) => { if (!best || v.lbs > best.lbs) best = v; });
  return best;
}

function computeBestOpportunity(checkIns: CheckIn[]) {
  const tally = new Map<string, { applianceId: any; gap: number; optimalStart: number }>();
  for (const ci of checkIns) {
    for (const p of ci.perAppliance) {
      const gap = p.lbs - p.optimalLbs;
      const cur = tally.get(p.applianceId);
      tally.set(p.applianceId, { applianceId: p.applianceId, gap: (cur?.gap ?? 0) + gap, optimalStart: p.optimalStart });
    }
  }
  let best: { applianceId: any; gap: number; optimalStart: number } | null = null;
  tally.forEach((v) => { if (!best || v.gap > best.gap) best = v; });
  if (!best || best.gap < 0.05) return null;
  const days = checkIns.length;
  return { applianceId: best.applianceId, optimalStart: best.optimalStart, savings: (best.gap / days) * 7 };
}
