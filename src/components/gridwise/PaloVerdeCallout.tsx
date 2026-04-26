import { Atom } from "lucide-react";

interface Props {
  // Live nuclear contribution to the local zone in MW (from Electricity Maps breakdown).
  // When provided, the callout reports current contribution; otherwise falls back to a
  // generic plant fact. Palo Verde nameplate is ~3,937 MW (3 reactors, ~1,300 MW each).
  nuclearMW?: number;
}

const PALO_VERDE_NAMEPLATE_MW = 3937;

export function PaloVerdeCallout({ nuclearMW }: Props) {
  const live = typeof nuclearMW === "number" && nuclearMW > 0;
  const sharePct = live ? Math.min(100, (nuclearMW! / PALO_VERDE_NAMEPLATE_MW) * 100) : 0;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "hsl(var(--source-nuclear) / 0.15)", color: "hsl(var(--source-nuclear))" }}
      >
        <Atom className="h-4 w-4" />
      </div>
      <div className="leading-snug">
        <div className="text-foreground font-medium">
          Palo Verde Nuclear · 3,937 MW zero-carbon baseload
        </div>
        {live ? (
          <p className="mt-1">
            Your zone is pulling roughly{" "}
            <span className="text-foreground font-medium">{Math.round(nuclearMW!).toLocaleString()} MW</span>{" "}
            of nuclear right now (~{sharePct.toFixed(0)}% of Palo Verde's nameplate). Shifting heavy
            loads onto these hours displaces gas peaker plants almost 1-for-1.
          </p>
        ) : (
          <p className="mt-1">
            Arizona's largest single source of clean electricity — runs ~92% capacity factor, day or
            night. Shifting heavy loads onto nuclear-rich hours is the single biggest lever residential
            users have to displace gas peakers.
          </p>
        )}
      </div>
    </div>
  );
}
