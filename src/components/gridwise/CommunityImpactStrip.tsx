import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { equivalenciesFor } from "@/lib/equivalencies";

interface ImpactData {
  totalSaved: number;
  contributors: number;
}

// Compact one-line community-impact summary intended for the top of the
// Dashboard. Fetches its own data so the parent page doesn't have to know
// about leaderboard concerns. Renders nothing until data is available so the
// page doesn't jump.
export function CommunityImpactStrip() {
  const [data, setData] = useState<ImpactData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/community-impact")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (!cancelled && json && !json.error) setData(json as ImpactData); })
      .catch(() => { /* silent — this is a nice-to-have */ });
    return () => { cancelled = true; };
  }, []);

  if (!data || data.totalSaved <= 0) return null;
  const treesEquiv = equivalenciesFor(data.totalSaved).find((eq) => eq.label === "Tree-days of CO₂");

  return (
    <Link
      to="/leaderboard"
      className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-intensity-low/15 text-intensity-low">
          <Users className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-foreground font-medium truncate">
            Community has avoided{" "}
            <span className="text-intensity-low font-semibold tabular-nums">
              {data.totalSaved.toFixed(1)} lbs
            </span>{" "}
            of CO₂
          </div>
          <div className="text-muted-foreground mt-0.5 truncate">
            {data.contributors} contributor{data.contributors === 1 ? "" : "s"}
            {treesEquiv ? ` · ≈ ${treesEquiv.value} tree-days of absorption` : ""}
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
