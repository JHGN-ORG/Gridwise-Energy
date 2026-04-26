import { equivalenciesFor } from "@/lib/equivalencies";

// Shared tile grid for the per-check-in card on the Dashboard and the
// community total card on the Leaderboard. Each tile shows the value, the
// label, and a one-line description so the unit is self-explanatory without
// needing a tooltip.
export function EquivalenciesGrid({ lbsCO2 }: { lbsCO2: number }) {
  if (lbsCO2 <= 0) return null;
  const items = equivalenciesFor(lbsCO2);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((eq) => (
        <div
          key={eq.label}
          className="rounded-xl border border-border bg-background/40 p-3 text-center"
          title={eq.hint}
        >
          <div className="text-lg font-semibold text-intensity-low tabular-nums">{eq.value}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {eq.label}
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-2 leading-snug">
            {eq.description}
          </div>
        </div>
      ))}
    </div>
  );
}
