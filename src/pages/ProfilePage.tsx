import { useEffect, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPLIANCE_MAP, HOME_SIZE_INFO, Profile, ARIZONA_CITIES, APPLIANCES, ApplianceId, ArizonaCity, HomeSize } from "@/lib/gridwise";
import { fetchCheckIns, fetchProfile, saveProfile } from "@/lib/repo";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Pencil, MapPin, Home, Clock, Zap, LogOut, Loader2, Save, X, Trophy } from "lucide-react";
import { toast } from "sonner";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SIZES: HomeSize[] = ["Small", "Medium", "Large"];

export default function ProfilePage() {
  const { user, signOut, isDemo } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkIns, setCheckIns] = useState<{ totalLbs: number; date: string }[]>([]);

  // Edit states
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState<ArizonaCity>("Phoenix");
  const [editHomeSize, setEditHomeSize] = useState<HomeSize>("Medium");
  const [editAppliances, setEditAppliances] = useState<ApplianceId[]>([]);
  const [editWake, setEditWake] = useState(7);
  const [editSleep, setEditSleep] = useState(23);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    if (!user) return;
    fetchProfile(user.id).then((r) => setProfile(r.profile));
    fetchCheckIns(user.id).then((rows) => setCheckIns(rows.map((c) => ({ totalLbs: c.totalLbs, date: c.date }))));
  };

  useEffect(refresh, [user]);

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditCity(profile.city);
    setEditHomeSize(profile.homeSize);
    setEditAppliances(profile.appliances);
    setEditWake(profile.wakeHour);
    setEditSleep(profile.sleepHour);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      await saveProfile(user.id, {
        ...profile,
        name: editName,
        city: editCity,
        homeSize: editHomeSize,
        appliances: editAppliances,
        wakeHour: editWake,
        sleepHour: editSleep,
      });
      toast.success("Profile updated");
      setEditing(false);
      refresh();
    } catch (e) {
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleLeaderboard = async (checked: boolean) => {
    if (!user || !profile) return;
    const p = { ...profile, leaderboardOptIn: checked };
    setProfile(p);
    try {
      await saveProfile(user.id, p);
      toast.success(checked ? "Added to Leaderboard" : "Removed from Leaderboard");
    } catch (e) {
      toast.error("Could not update setting");
      refresh(); // revert on fail
    }
  };

  if (!profile) {
    return (
      <AppShell title="Your profile">
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  const totalLbs = checkIns.reduce((s, c) => s + c.totalLbs, 0);
  const bestDay = checkIns.length ? checkIns.reduce((b, c) => (c.totalLbs < b.totalLbs ? c : b), checkIns[0]) : null;
  const sizeInfo = HOME_SIZE_INFO[profile.homeSize];

  if (editing) {
    return (
      <AppShell title="Edit profile" subtitle="Update your household details.">
        <div className="space-y-4">
          <Card className="bg-card-gradient border-border p-5 space-y-4">
            <Field label="Your Name">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="City">
                <Select value={editCity} onValueChange={(v) => setEditCity(v as ArizonaCity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ARIZONA_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Home Size">
                <Select value={editHomeSize} onValueChange={(v) => setEditHomeSize(v as HomeSize)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Wake Hour">
                <Select value={String(editWake)} onValueChange={(v) => setEditWake(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Sleep Hour">
                <Select value={String(editSleep)} onValueChange={(v) => setEditSleep(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Appliances">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {APPLIANCES.map((a) => {
                  const on = editAppliances.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3 cursor-pointer">
                      <Checkbox 
                        checked={on} 
                        onCheckedChange={() => setEditAppliances(cur => cur.includes(a.id) ? cur.filter(x => x !== a.id) : [...cur, a.id])} 
                      />
                      <span className="text-sm font-medium">{a.label}</span>
                    </label>
                  );
                })}
              </div>
            </Field>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1" disabled={saving}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={saving || !editName.trim() || editAppliances.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save</>}
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Your profile" subtitle="What we know to make better suggestions.">
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-semibold">{profile.name || user?.email}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {user?.email} · Joined {new Date(profile.joinedAt).toLocaleDateString()}
              </div>
            </div>
            {!isDemo && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Info icon={<MapPin className="h-4 w-4" />} label="City" value={`${profile.city}, AZ`} />
            <Info icon={<Home className="h-4 w-4" />} label="Home" value={`${profile.homeSize} · ${sizeInfo.sqft}`} />
            <Info icon={<Clock className="h-4 w-4" />} label="Wake" value={hourLabel(profile.wakeHour)} />
            <Info icon={<Clock className="h-4 w-4" />} label="Sleep" value={hourLabel(profile.sleepHour)} />
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Home-size factor: appliance load ×{sizeInfo.wattageMultiplier} · always-on baseline {sizeInfo.baselineWatts}W
          </div>
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Appliances</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.appliances.map((id) => (
                <span key={id} className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs">
                  {APPLIANCE_MAP[id]?.label || id}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card className="bg-card-gradient border-border p-5">
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="mt-1 bg-primary/10 p-2 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Participate in Rank</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Show your anonymous username and CO₂ savings on the community leaderboard.
              </div>
            </div>
            <div className="flex h-full items-center justify-center">
              <Checkbox 
                className="scale-125 mr-2" 
                checked={profile.leaderboardOptIn} 
                onCheckedChange={(v) => toggleLeaderboard(!!v)} 
                disabled={isDemo}
              />
            </div>
          </label>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card-gradient border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total CO₂ logged</div>
            <div className="text-3xl font-bold mt-1 text-intensity-medium">{totalLbs.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">lbs · {checkIns.length} check-ins</div>
          </Card>
          <Card className="bg-card-gradient border-border p-5">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3 w-3" /> Best day
            </div>
            {bestDay ? (
              <>
                <div className="text-3xl font-bold mt-1 text-intensity-low">{bestDay.totalLbs.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  lbs · {new Date(bestDay.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </>
            ) : <div className="text-sm text-muted-foreground mt-2">No data yet.</div>}
          </Card>
        </div>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </AppShell>
  );
}

const Info = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 p-3">
    <span className="text-primary">{icon}</span>
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
    {children}
  </div>
);

function hourLabel(h: number) {
  const period = h < 12 ? "am" : "pm";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}
