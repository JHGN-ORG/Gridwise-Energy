import { Recommendation } from "@/lib/intensity";
import { Zap, Clock, Pause } from "lucide-react";

const ICONS = {
  now: { Icon: Zap, color: "var(--intensity-low)" },
  soon: { Icon: Clock, color: "var(--intensity-medium)" },
  wait: { Icon: Pause, color: "var(--intensity-high)" },
};

export const Recommendations = ({ items }: { items: Recommendation[] }) => (
  <div className="grid gap-3">
    {items.map((rec, i) => {
      const { Icon, color } = ICONS[rec.icon];
      return (
        <div
          key={i}
          className="flex gap-4 rounded-2xl border border-border bg-card-gradient p-4 transition-smooth hover:border-primary/30"
          style={{ transition: "var(--transition-smooth)" }}
        >
          <div
            className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
            style={{
              background: `hsl(${color} / 0.15)`,
              color: `hsl(${color})`,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-foreground">{rec.title}</div>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{rec.detail}</p>
          </div>
        </div>
      );
    })}
  </div>
);
