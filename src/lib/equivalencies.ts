// Real-world equivalencies for lbs of CO₂.
// Sources: EPA Greenhouse Gas Equivalencies Calculator (2024).
//   - Passenger vehicle: 0.89 lbs CO₂ per mile (avg gasoline car).
//   - Smartphone charge: 0.0822 lbs CO₂ per full charge.
//   - Mature tree sequestration: ~48 lbs CO₂ per year ≈ 0.131 lbs/day.
// Each helper returns the equivalent count for the given lbs of CO₂.

const LBS_PER_MILE = 0.89;
const LBS_PER_CHARGE = 0.0822;
const LBS_PER_TREE_DAY = 48 / 365;

export interface Equivalency {
  label: string;
  value: string;
  // One-line plain-English description of what the unit means in real-world
  // terms. Shown in the UI so the number is self-explanatory.
  description: string;
  // Short attribution / conversion factor, shown as a tooltip for anyone
  // who wants to double-check the math.
  hint: string;
}

const fmt = (n: number, digits = 1) =>
  n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(digits);

export function equivalenciesFor(lbsCO2: number): Equivalency[] {
  const lbs = Math.max(0, lbsCO2);
  return [
    {
      label: "Miles not driven",
      value: fmt(lbs / LBS_PER_MILE),
      description: "Tailpipe CO₂ from the average US gas car over that distance.",
      hint: "Avg US gas car ≈ 0.89 lbs CO₂ / mile (EPA, 2024)",
    },
    {
      label: "Phone charges",
      value: fmt(lbs / LBS_PER_CHARGE, 0),
      description: "Equivalent to fully charging a smartphone this many times.",
      hint: "≈ 0.082 lbs CO₂ per full smartphone charge (EPA, 2024)",
    },
    {
      label: "Tree-days of CO₂",
      value: fmt(lbs / LBS_PER_TREE_DAY, 0),
      description: "How long one mature tree would need to absorb this much CO₂.",
      hint: "1 mature tree absorbs ≈ 48 lbs CO₂ / year (EPA, 2024)",
    },
  ];
}
