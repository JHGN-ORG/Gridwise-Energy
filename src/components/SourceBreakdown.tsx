import { getSourceMeta } from "@/lib/intensity";
import { Atom } from "lucide-react";

interface Props {
  breakdown: Record<string, number>; // source -> MW
}

export const SourceBreakdown = ({ breakdown }: Props) => {
  const entries = Object.entries(breakdown)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return <p className="text-muted-foreground text-sm">No live source mix available for this region.</p>;
  }

  const nuclearShare = (breakdown.nuclear ?? 0) / total;

  return (
    <div className="space-y-5">
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {entries.map(([key, mw]) => {
          const meta = getSourceMeta(key);
          const pct = (mw / total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, background: meta.color }}
              title={`${meta.label}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* List */}
      <ul className="space-y-2.5">
        {entries.map(([key, mw]) => {
          const meta = getSourceMeta(key);
          const pct = (mw / total) * 100;
          return (
            <li key={key} className="flex items-center gap-3 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
              />
              <span className="flex-1 text-foreground/90">{meta.label}</span>
              <span className="tabular-nums text-muted-foreground w-16 text-right">
                {pct.toFixed(1)}%
              </span>
              <span className="tabular-nums text-xs text-muted-foreground/60 w-20 text-right">
                {Math.round(mw).toLocaleString()} MW
              </span>
            </li>
          );
        })}
      </ul>

      {/* Nuclear baseline callout */}
      {nuclearShare > 0.02 && (
        <div className="flex gap-3 rounded-2xl border border-border bg-secondary/40 p-4 mt-4">
          <Atom
            className="h-5 w-5 shrink-0 mt-0.5"
            style={{ color: "hsl(var(--source-nuclear))" }}
          />
          <div className="text-sm">
            <div className="font-medium text-foreground">
              Nuclear is providing {(nuclearShare * 100).toFixed(0)}% of the grid right now
            </div>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              Steady, carbon-free, around the clock. Nuclear is what keeps the grid clean
              when the sun sets and wind drops off.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
