import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { APPLIANCES, ARIZONA_CITIES, HOME_SIZE_INFO, ApplianceId, ArizonaCity, HomeSize } from "@/lib/gridwise";
import { Database, Loader2, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface DemoProfile {
  user_id: string;
  name: string;
  city: ArizonaCity;
  home_size: HomeSize;
  appliances: ApplianceId[];
  wake_hour: number;
  sleep_hour: number;
}

interface DemoCheckIn {
  date: string;
  total_lbs: number | string;
  saved_lbs: number | string;
  usages: unknown[];
}

interface AdminDemoResponse {
  adminUserId: string;
  demoUserId: string;
  profile: DemoProfile;
  checkIns: DemoCheckIn[];
  chatMessageCount: number;
  error?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCENARIOS = [
  { id: "evening-heavy", label: "Evening Heavy" },
  { id: "mixed", label: "Mixed" },
  { id: "clean-shifter", label: "Clean Shifter" },
];

export default function AdminPage() {
  const [demoUserId, setDemoUserId] = useState("demo:default");
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [checkIns, setCheckIns] = useState<DemoCheckIn[]>([]);
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const [scenario, setScenario] = useState("evening-heavy");
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const load = async (id = demoUserId) => {
    setLoading(true);
    setAccessError(null);
    try {
      const res = await apiFetch(`/api/admin-demo?demoUserId=${encodeURIComponent(id)}`);
      const data = (await res.json()) as AdminDemoResponse;
      setProfile(normalizeProfile(data.profile, data.demoUserId));
      setCheckIns(data.checkIns ?? []);
      setChatMessageCount(data.chatMessageCount ?? 0);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Could not load admin panel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const total = checkIns.reduce((sum, row) => sum + Number(row.total_lbs), 0);
    const saved = checkIns.reduce((sum, row) => sum + Number(row.saved_lbs), 0);
    return { total, saved };
  }, [checkIns]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin-demo?demoUserId=${encodeURIComponent(demoUserId)}`, {
        method: "PUT",
        body: JSON.stringify({ profile }),
      });
      const data = (await res.json()) as AdminDemoResponse;
      setProfile(normalizeProfile(data.profile, data.demoUserId));
      setCheckIns(data.checkIns ?? []);
      toast.success("Demo profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save demo profile");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: string, body: Record<string, unknown> = {}) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin-demo?demoUserId=${encodeURIComponent(demoUserId)}`, {
        method: "POST",
        body: JSON.stringify({ action, ...body }),
      });
      const data = (await res.json()) as AdminDemoResponse;
      setProfile(normalizeProfile(data.profile, data.demoUserId));
      setCheckIns(data.checkIns ?? []);
      setChatMessageCount(data.chatMessageCount ?? 0);
      toast.success("Demo data updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update demo data");
    } finally {
      setSaving(false);
    }
  };

  const switchDemo = () => {
    const clean = demoUserId.trim().startsWith("demo:") ? demoUserId.trim() : `demo:${demoUserId.trim() || "default"}`;
    setDemoUserId(clean);
    load(clean);
  };

  if (loading && !profile) {
    return (
      <AppShell title="Admin">
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  if (accessError) {
    return (
      <AppShell title="Admin">
        <Card className="bg-card-gradient border-border p-6">
          <h2 className="text-lg font-semibold">Admin access unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {accessError}. Add your Auth0 user id to <span className="font-mono">ADMIN_USER_IDS</span> in Vercel/local env.
          </p>
        </Card>
      </AppShell>
    );
  }

  if (!profile) return null;

  return (
    <AppShell title="Admin" subtitle="Create and manipulate demo users for live GridDaddy demos.">
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Demo user id">
              <Input value={demoUserId} onChange={(e) => setDemoUserId(e.target.value)} />
            </Field>
            <Button onClick={switchDemo} disabled={loading || saving} className="self-end">
              <RefreshCw className="mr-2 h-4 w-4" /> Load
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/insights?demoUserId=${encodeURIComponent(demoUserId)}`}>Preview insights</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/profile?demoUserId=${encodeURIComponent(demoUserId)}`}>Preview profile</a>
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-4 text-sm uppercase tracking-[0.18em] text-muted-foreground">Demo profile</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </Field>
              <Field label="City">
                <Select value={profile.city} onValueChange={(city) => setProfile({ ...profile, city: city as ArizonaCity })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ARIZONA_CITIES.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Home size">
                <Select value={profile.home_size} onValueChange={(home_size) => setProfile({ ...profile, home_size: home_size as HomeSize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(HOME_SIZE_INFO) as HomeSize[]).map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Wake hour">
                <Select value={String(profile.wake_hour)} onValueChange={(wake) => setProfile({ ...profile, wake_hour: Number(wake) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((hour) => <SelectItem key={hour} value={String(hour)}>{hour}:00</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Sleep hour">
                <Select value={String(profile.sleep_hour)} onValueChange={(sleep) => setProfile({ ...profile, sleep_hour: Number(sleep) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((hour) => <SelectItem key={hour} value={String(hour)}>{hour}:00</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Appliances</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {APPLIANCES.map((appliance) => {
                  const checked = profile.appliances.includes(appliance.id);
                  return (
                    <label key={appliance.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/30 p-3 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setProfile({
                            ...profile,
                            appliances: value
                              ? [...profile.appliances, appliance.id]
                              : profile.appliances.filter((id) => id !== appliance.id),
                          });
                        }}
                      />
                      {appliance.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <Button onClick={saveProfile} disabled={saving} className="mt-5">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Save profile
            </Button>
          </Card>

          <Card className="bg-card-gradient border-border p-5">
            <h2 className="mb-4 text-sm uppercase tracking-[0.18em] text-muted-foreground">Demo data</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Check-ins" value={String(checkIns.length)} />
              <Stat label="Chat msgs" value={String(chatMessageCount)} />
              <Stat label="CO2 logged" value={`${summary.total.toFixed(1)} lbs`} />
              <Stat label="Could save" value={`${summary.saved.toFixed(1)} lbs`} />
            </div>

            <div className="mt-5 space-y-3">
              <Field label="Scenario">
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCENARIOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Days">
                <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </Field>
              <Button className="w-full" onClick={() => runAction("generateCheckIns", { scenario, days })} disabled={saving}>
                <Wand2 className="mr-2 h-4 w-4" /> Generate check-ins
              </Button>
              <Button variant="outline" className="w-full" onClick={() => runAction("clearCheckIns")} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear check-ins
              </Button>
              <Button variant="outline" className="w-full" onClick={() => runAction("clearChat")} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear chat history
              </Button>
            </div>
          </Card>
        </div>

        <Card className="bg-card-gradient border-border p-5">
          <h2 className="mb-4 text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent generated check-ins</h2>
          <div className="space-y-2">
            {checkIns.length ? checkIns.slice(0, 10).map((row) => (
              <div key={String(row.date)} className="grid grid-cols-4 gap-3 rounded-xl border border-border bg-background/30 p-3 text-sm">
                <span>{String(row.date).slice(0, 10)}</span>
                <span>{Number(row.total_lbs).toFixed(2)} lbs</span>
                <span>{Number(row.saved_lbs).toFixed(2)} saved</span>
                <span>{Array.isArray(row.usages) ? row.usages.length : 0} usages</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No demo check-ins yet.</p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function normalizeProfile(profile: DemoProfile, demoUserId: string): DemoProfile {
  return {
    user_id: profile.user_id ?? demoUserId,
    name: profile.name ?? "Demo Dana",
    city: profile.city ?? "Phoenix",
    home_size: profile.home_size ?? "Medium",
    appliances: Array.isArray(profile.appliances) ? profile.appliances : [],
    wake_hour: Number(profile.wake_hour ?? 7),
    sleep_hour: Number(profile.sleep_hour ?? 23),
  };
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
    {children}
  </label>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-background/30 p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);
