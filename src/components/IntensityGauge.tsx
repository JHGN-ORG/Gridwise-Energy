import { classifyIntensity, intensityLabel, intensityHeadline } from "@/lib/intensity";

interface Props {
  value: number; // gCO2eq/kWh
}

const MAX = 700; // visual cap

export const IntensityGauge = ({ value }: Props) => {
  const level = classifyIntensity(value);
  const colorVar = `--intensity-${level}`;
  const pct = Math.min(value / MAX, 1);

  // Half-circle gauge geometry
  const r = 130;
  const c = Math.PI * r; // half-circumference
  const dash = c * pct;

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 320 180" className="w-full max-w-md">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="hsl(var(--intensity-low))" />
            <stop offset="50%" stopColor="hsl(var(--intensity-medium))" />
            <stop offset="100%" stopColor="hsl(var(--intensity-high))" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d="M 30 160 A 130 130 0 0 1 290 160"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 30 160 A 130 130 0 0 1 290 160"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 12px hsl(var(${colorVar}) / 0.6))` }}
          className="animate-sweep"
        />
      </svg>
      <div className="-mt-16 flex flex-col items-center">
        <div
          className="text-7xl font-bold tracking-tight tabular-nums"
          style={{ color: `hsl(var(${colorVar}))` }}
        >
          {Math.round(value)}
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">
          gCO₂eq / kWh
        </div>
        <div
          className="mt-4 px-4 py-1.5 rounded-full text-sm font-medium border"
          style={{
            color: `hsl(var(${colorVar}))`,
            borderColor: `hsl(var(${colorVar}) / 0.4)`,
            background: `hsl(var(${colorVar}) / 0.1)`,
          }}
        >
          {intensityLabel(level)} grid
        </div>
        <p className="mt-3 text-base text-foreground/80">{intensityHeadline(level)}</p>
      </div>
    </div>
  );
};
