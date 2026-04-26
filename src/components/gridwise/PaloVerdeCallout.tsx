import { Atom } from "lucide-react";

export function PaloVerdeCallout() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "hsl(var(--source-nuclear) / 0.15)", color: "hsl(var(--source-nuclear))" }}
      >
        <Atom className="h-4 w-4" />
      </div>
      <p className="leading-snug">
        Powered in part by <span className="text-foreground font-medium">Palo Verde</span> — 4,000 MW of zero-carbon
        baseload, right here in Arizona.
      </p>
    </div>
  );
}
