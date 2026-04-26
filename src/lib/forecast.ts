const AZ_TIME_ZONE = "America/Phoenix";
const MS_PER_HOUR = 60 * 60 * 1000;

export interface CarbonHistoryPoint {
  carbonIntensity: number;
  datetime: string;
}

export interface CarbonForecastPoint {
  hour: number;
  carbonIntensity: number;
  datetime: string;
}

export interface CarbonForecast {
  points: CarbonForecastPoint[];
  confidence: "low" | "medium" | "high";
  r2: number;
  model: string;
}

export function forecastCarbonIntensity(history: CarbonHistoryPoint[], hours = 24): CarbonForecast | null {
  const observed = history
    .map((point) => ({ y: Number(point.carbonIntensity), date: new Date(point.datetime) }))
    .filter((point) => Number.isFinite(point.y) && !Number.isNaN(point.date.getTime()))
    .slice(-72);

  if (observed.length < 6) return null;

  const firstMs = observed[0].date.getTime();
  const rows = observed.map((point) => {
    const t = (point.date.getTime() - firstMs) / MS_PER_HOUR;
    const angle = (2 * Math.PI * hourInArizona(point.date)) / 24;
    return { x: [1, t, Math.sin(angle), Math.cos(angle)], y: point.y };
  });

  const beta = solveRidgeRegression(rows.map((row) => row.x), rows.map((row) => row.y), 0.25);
  if (!beta) return null;

  const fitted = rows.map((row) => dot(beta, row.x));
  const r2 = coefficientOfDetermination(rows.map((row) => row.y), fitted);
  const lastMs = observed[observed.length - 1].date.getTime();
  const lastT = (lastMs - firstMs) / MS_PER_HOUR;
  const minSeen = Math.min(...rows.map((row) => row.y));
  const maxSeen = Math.max(...rows.map((row) => row.y));
  const padding = Math.max(20, (maxSeen - minSeen) * 0.2);

  const points = Array.from({ length: hours }, (_, index) => {
    const date = new Date(lastMs + (index + 1) * MS_PER_HOUR);
    const hour = hourInArizona(date);
    const angle = (2 * Math.PI * hour) / 24;
    const raw = dot(beta, [1, lastT + index + 1, Math.sin(angle), Math.cos(angle)]);
    return {
      hour,
      datetime: date.toISOString(),
      carbonIntensity: Math.round(clamp(raw, Math.max(0, minSeen - padding), maxSeen + padding)),
    };
  });

  return {
    points,
    r2,
    confidence: confidenceFor(observed.length, r2),
    model: "Ridge linear regression with hourly seasonality",
  };
}

function solveRidgeRegression(x: number[][], y: number[], lambda: number) {
  const size = x[0]?.length ?? 0;
  if (!size) return null;
  const a = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const b = Array.from({ length: size }, () => 0);

  for (let row = 0; row < x.length; row++) {
    for (let i = 0; i < size; i++) {
      b[i] += x[row][i] * y[row];
      for (let j = 0; j < size; j++) a[i][j] += x[row][i] * x[row][j];
    }
  }

  for (let i = 0; i < size; i++) a[i][i] += lambda;
  return gaussianElimination(a, b);
}

function gaussianElimination(a: number[][], b: number[]) {
  const n = b.length;
  const matrix = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    }
    if (Math.abs(matrix[pivot][col]) < 1e-9) return null;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];

    const divisor = matrix[col][col];
    for (let j = col; j <= n; j++) matrix[col][j] /= divisor;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = matrix[row][col];
      for (let j = col; j <= n; j++) matrix[row][j] -= factor * matrix[col][j];
    }
  }

  return matrix.map((row) => row[n]);
}

function coefficientOfDetermination(actual: number[], predicted: number[]) {
  const mean = actual.reduce((sum, value) => sum + value, 0) / actual.length;
  const ssTot = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const ssRes = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  if (ssTot <= 1e-9) return 0;
  return clamp(1 - ssRes / ssTot, 0, 1);
}

function confidenceFor(samples: number, r2: number): "low" | "medium" | "high" {
  if (samples >= 48 && r2 >= 0.55) return "high";
  if (samples >= 24 && r2 >= 0.25) return "medium";
  return "low";
}

function hourInArizona(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: AZ_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
}

function dot(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
