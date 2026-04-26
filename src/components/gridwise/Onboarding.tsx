import { useState } from "react";
import {
  APPLIANCES,
  ARIZONA_CITIES,
  ApplianceId,
  ArizonaCity,
  HOME_SIZE_INFO,
  HomeSize,
  Profile,
  formatHour,
} from "@/lib/gridwise";
import { saveProfile } from "@/lib/repo";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SIZES: HomeSize[] = ["Small", "Medium", "Large"];

export function Onboarding({ onComplete, initial }: { onComplete: () => void; initial?: Profile | null }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState<ArizonaCity>(initial?.city ?? "Phoenix");
  const [homeSize, setHomeSize] = useState<HomeSize>(initial?.homeSize ?? "Medium");
  const [appliances, setAppliances] = useState<ApplianceId[]>(initial?.appliances ?? ["hvac", "dishwasher", "washer", "dryer"]);
  const [wakeHour, setWakeHour] = useState<number>(initial?.wakeHour ?? 7);
  const [sleepHour, setSleepHour] = useState<number>(initial?.sleepHour ?? 23);

  const toggleAppliance = (id: ApplianceId) =>
    setAppliances((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    const profile: Profile = {
      name: name.trim() || "Friend",
      city,
      homeSize,
      appliances,
      wakeHour,
      sleepHour,
      joinedAt: initial?.joinedAt ?? new Date().toISOString(),
    };
    try {
      await saveProfile(user.id, profile, true);
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    {
      title: "Welcome to GridDaddy",
      subtitle: "Let’s get to know you.",
      valid: name.trim().length >= 1,
      content: (
        <div className="space-y-5">
          <Field label="Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" autoFocus />
          </Field>
          <Field label="Arizona city">
            <Select value={city} onValueChange={(v) => setCity(v as ArizonaCity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ARIZONA_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      ),
    },
    {
      title: "Your home",
      subtitle: "How big is the place? This adjusts your appliance load.",
      valid: true,
      content: (
        <div className="space-y-2">
          {SIZES.map((s) => {
            const info = HOME_SIZE_INFO[s];
            const on = homeSize === s;
            return (
              <button
                key={s}
                onClick={() => setHomeSize(s)}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                  on ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{info.label} <span className="text-muted-foreground font-normal">· {info.sqft}</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">{info.description}</div>
                  </div>
                  {on && <Check className="h-5 w-5 text-primary" />}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Appliance load ×{info.wattageMultiplier} · always-on baseline {info.baselineWatts}W
                </div>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "What do you run?",
      subtitle: "Pick everything you have at home.",
      valid: appliances.length > 0,
      content: (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {APPLIANCES.map((a) => {
            const on = appliances.includes(a.id);
            return (
              <label
                key={a.id}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  on ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-muted-foreground/40"
                }`}
              >
                <Checkbox checked={on} onCheckedChange={() => toggleAppliance(a.id)} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.watts.toLocaleString()} W</div>
                </div>
                {on && <Check className="h-4 w-4 text-primary" />}
              </label>
            );
          })}
        </div>
      ),
    },
    {
      title: "Your daily rhythm",
      subtitle: "When are you usually up?",
      valid: true,
      content: (
        <div className="space-y-5">
          <Field label="Typical wake time">
            <Select value={String(wakeHour)} onValueChange={(v) => setWakeHour(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Typical sleep time">
            <Select value={String(sleepHour)} onValueChange={(v) => setSleepHour(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      ),
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
<<<<<<< HEAD
        <div className="mb-6 flex items-center gap-3 text-lg font-semibold">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
            <Zap className="h-7 w-7" />
          </div>
          GridDaddy
=======
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold">
          <img src="/logo.png" alt="GridDaddy Logo" className="h-16 w-auto object-contain" />
>>>>>>> 9bb5c2fe44b87d645348614f7df38ccb3617c860
        </div>
        <Card className="bg-card-gradient border-border p-6 sm:p-8">
          <div className="flex gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{cur.title}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{cur.subtitle}</p>
          <div className="animate-fade-in-up" key={step}>{cur.content}</div>
          <div className="flex gap-2 mt-8">
            {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="flex-1">Back</Button>}
            <Button
              disabled={!cur.valid || busy}
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="flex-1"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isLast ? "Get started" : "Continue"} <ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
    {children}
  </div>
);
