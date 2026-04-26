import type { VercelRequest, VercelResponse } from "@vercel/node";

const EM_BASE = "https://api.electricitymap.org/v3";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  try {
    const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;
    if (!apiKey) throw new Error("ELECTRICITY_MAPS_API_KEY not configured");

    const address = typeof req.body?.address === "string" ? req.body.address : "";
    if (address.trim().length < 2) {
      return res.status(400).json({ error: "Address is required" });
    }

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "GridCarbonTracker/1.0 (griddaddy.us)" } },
    );
    if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
    const geoData = (await geoRes.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(geoData) || geoData.length === 0) {
      return res.status(404).json({ error: "Address not found" });
    }
    const { lat, lon, display_name } = geoData[0];

    const emHeaders = { "auth-token": apiKey };
    const q = `?lat=${lat}&lon=${lon}`;

    const [intensityRes, breakdownRes, historyRes] = await Promise.all([
      fetch(`${EM_BASE}/carbon-intensity/latest${q}`, { headers: emHeaders }),
      fetch(`${EM_BASE}/power-breakdown/latest${q}`, { headers: emHeaders }),
      fetch(`${EM_BASE}/carbon-intensity/history${q}`, { headers: emHeaders }),
    ]);

    if (intensityRes.status === 401 || intensityRes.status === 403) {
      const txt = await intensityRes.text();
      let zoneKey = "this region";
      try {
        zoneKey = JSON.parse(txt).error?.match(/zoneKey=([^,]+)/)?.[1] ?? zoneKey;
      } catch {
        /* ignore */
      }
      return res.status(200).json({
        error: "api_unauthorized",
        message: `Your Electricity Maps API key doesn't have access to ${zoneKey}. Free personal keys are limited to one demo zone — request a commercial or educational key at api-portal.electricitymaps.com for global coverage.`,
      });
    }
    if (!intensityRes.ok) {
      throw new Error(`Electricity Maps intensity [${intensityRes.status}]: ${await intensityRes.text()}`);
    }
    if (!breakdownRes.ok) {
      throw new Error(`Electricity Maps breakdown [${breakdownRes.status}]: ${await breakdownRes.text()}`);
    }

    const intensity = await intensityRes.json();
    const breakdown = await breakdownRes.json();
    const history = historyRes.ok ? await historyRes.json() : { history: [] };

    return res.status(200).json({
      location: { lat: Number(lat), lon: Number(lon), display_name },
      zone: (intensity as any).zone,
      intensity,
      breakdown,
      history,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("grid-intensity error:", msg);
    return res.status(500).json({ error: msg });
  }
}
