import { useEffect, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APPLIANCE_MAP, HOME_SIZE_INFO, Profile } from "@/lib/gridwise";
import { fetchCheckIns, fetchProfile } from "@/lib/repo";
import { Onboarding } from "@/components/gridwise/Onboarding";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Pencil, MapPin, Home, Clock, Zap, LogOut, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, signOut, isDemo } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkIns, setCheckIns] = useState<{ totalLbs: number; date: string }[]>([]);

  const refresh = () => {
    if (!user) return;
    fetchProfile(user.id).then((r) => setProfile(r.profile));
    fetchCheckIns(user.id).then((rows) => setCheckIns(rows.map((c) => ({ totalLbs: c.totalLbs, date: c.date }))));
  };

  useEffect(refresh, [user]);

  if (!profile) {
    return (
      <AppShell title="Your profile">
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  if (editing) {
    return <Onboarding initial={profile} onComplete={() => { setEditing(false); refresh(); }} />;
  }

  const totalLbs = checkIns.reduce((s, c) => s + c.totalLbs, 0);
  const bestDay = checkIns.length ? checkIns.reduce((b, c) => (c.totalLbs < b.totalLbs ? c : b), checkIns[0]) : null;
  const sizeInfo = HOME_SIZE_INFO[profile.homeSize];

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
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
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
                  {APPLIANCE_MAP[id].label}
                </span>
              ))}
            </div>
          </div>
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

function hourLabel(h: number) {
  const period = h < 12 ? "am" : "pm";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}
