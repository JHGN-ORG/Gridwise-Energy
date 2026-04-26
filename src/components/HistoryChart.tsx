import { useMemo } from "react";

interface Point { carbonIntensity: number; datetime: string; }

export const HistoryChart = ({ data }: { data: Point[] }) => {
  const sorted = useMemo(
    () => [...data].sort((a, b) => +new Date(a.datetime) - +new Date(b.datetime)),
    [data]
  );

  if (sorted.length < 2) {
    return <p className="text-muted-foreground text-sm">Not enough history yet.</p>;
  }

  const W = 600, H = 180, P = 24;
  const max = Math.max(...sorted.map(d => d.carbonIntensity), 100);
  const min = Math.min(...sorted.map(d => d.carbonIntensity), 0);
  const range = max - min || 1;

  const x = (i: number) => P + (i / (sorted.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / range) * (H - 2 * P);

  const path = sorted.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.carbonIntensity)}`).join(" ");
  const area = `${path} L ${x(sorted.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`;

  const cleanestIdx = sorted.reduce((best, d, i) => d.carbonIntensity < sorted[best].carbonIntensity ? i : best, 0);
  const dirtiestIdx = sorted.reduce((worst, d, i) => d.carbonIntensity > sorted[worst].carbonIntensity ? i : worst, 0);

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric" });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="histGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.4)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#histGrad)" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Markers */}
        {[
          { i: cleanestIdx, color: "var(--intensity-low)", label: "Cleanest" },
          { i: dirtiestIdx, color: "var(--intensity-high)", label: "Dirtiest" },
        ].map(m => (
          <g key={m.label}>
            <circle cx={x(m.i)} cy={y(sorted[m.i].carbonIntensity)} r="5"
              fill={`hsl(${m.color})`}
              style={{ filter: `drop-shadow(0 0 6px hsl(${m.color} / 0.8))` }}
            />
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
        <span>{fmt(sorted[0].datetime)}</span>
        <span className="text-intensity-low">
          ↓ Cleanest: {Math.round(sorted[cleanestIdx].carbonIntensity)} @ {fmt(sorted[cleanestIdx].datetime)}
        </span>
        <span className="text-intensity-high">
          ↑ Dirtiest: {Math.round(sorted[dirtiestIdx].carbonIntensity)} @ {fmt(sorted[dirtiestIdx].datetime)}
        </span>
        <span>{fmt(sorted[sorted.length - 1].datetime)}</span>
      </div>
    </div>
  );
};
