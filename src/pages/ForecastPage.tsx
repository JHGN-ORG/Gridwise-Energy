import { AppShell } from "@/components/gridwise/AppShell";
import { PaloVerdeCallout } from "@/components/gridwise/PaloVerdeCallout";
import { Card } from "@/components/ui/card";
import { HOURLY_INTENSITY, formatHour, intensityClass } from "@/lib/gridwise";
import { CircleCheck, CircleAlert } from "lucide-react";

export default function ForecastPage() {
  return (
    <AppShell title="Tomorrow’s grid" subtitle="Plan the next 24 hours around clean power.">
      <div className="space-y-4">
        <Card className="bg-card-gradient border-border p-5">
          <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground mb-4">Hourly carbon intensity</h2>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {HOURLY_INTENSITY.map((g, h) => {
              const cls = intensityClass(g);
              return (
                <div
                  key={h}
                  className="rounded-xl border p-2 text-center"
                  style={{
                    borderColor: `hsl(var(--intensity-${cls}) / 0.4)`,
                    background: `hsl(var(--intensity-${cls}) / 0.12)`,
                  }}
                >
                  <div className="text-[10px] text-muted-foreground">{formatHour(h)}</div>
                  <div className={`text-sm font-semibold mt-0.5 text-intensity-${cls}`}>{g}</div>
                  <div className="text-[9px] text-muted-foreground">gCO₂</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend cls="low" label="Clean (< 230)" />
            <Legend cls="medium" label="Moderate" />
            <Legend cls="high" label="Dirty (> 320)" />
          </div>
        </Card>

        <Card className="bg-card-gradient border-border p-5">
          <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground mb-3">Recommendations</h2>
          <div className="space-y-3">
            <Reco
              icon={<CircleCheck className="h-5 w-5 text-intensity-low" />}
              title="Best windows for high-draw appliances"
              body={<><span className="text-intensity-low font-medium">11pm – 2am</span> — nuclear baseload dominant. Charge the EV, run the dryer, schedule the dishwasher.</>}
            />
            <Reco
              icon={<CircleAlert className="h-5 w-5 text-intensity-high" />}
              title="Avoid this window"
              body={<><span className="text-intensity-high font-medium">5pm – 8pm</span> — peak demand, gas peakers covering for solar drop-off. Skip laundry and EV charging here.</>}
            />
            <Reco
              icon={<CircleCheck className="h-5 w-5 text-intensity-low" />}
              title="Daytime sweet spot"
              body={<><span className="text-intensity-low font-medium">11am – 3pm</span> — peak Arizona solar. Great for pool pumps and pre-cooling the house.</>}
            />
          </div>
        </Card>

        <PaloVerdeCallout />
      </div>
    </AppShell>
  );
}

const Legend = ({ cls, label }: { cls: "low" | "medium" | "high"; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--intensity-${cls}))` }} />
    {label}
  </span>
);

const Reco = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) => (
  <div className="flex gap-3 rounded-xl border border-border bg-background/40 p-3">
    <div className="shrink-0 mt-0.5">{icon}</div>
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</div>
    </div>
  </div>
);
