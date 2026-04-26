// Edge function: geocode address + fetch live grid carbon intensity & power breakdown
// Uses Electricity Maps API (server-side key) and OSM Nominatim for geocoding.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EM_BASE = "https://api.electricitymap.org/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELECTRICITY_MAPS_API_KEY");
    if (!apiKey) throw new Error("ELECTRICITY_MAPS_API_KEY not configured");

    const { address } = await req.json();
    if (!address || typeof address !== "string" || address.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Geocode via Nominatim (free, no key)
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const geoRes = await fetch(geoUrl, {
      headers: { "User-Agent": "GridCarbonTracker/1.0 (lovable.dev)" },
    });
    if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
    const geoData = await geoRes.json();
    if (!Array.isArray(geoData) || geoData.length === 0) {
      return new Response(JSON.stringify({ error: "Address not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { lat, lon, display_name } = geoData[0];

    const emHeaders = { "auth-token": apiKey };
    const q = `?lat=${lat}&lon=${lon}`;

    // 2. Parallel: latest intensity, power breakdown, 24h history
    const [intensityRes, breakdownRes, historyRes] = await Promise.all([
      fetch(`${EM_BASE}/carbon-intensity/latest${q}`, { headers: emHeaders }),
      fetch(`${EM_BASE}/power-breakdown/latest${q}`, { headers: emHeaders }),
      fetch(`${EM_BASE}/carbon-intensity/history${q}`, { headers: emHeaders }),
    ]);

    if (intensityRes.status === 401 || intensityRes.status === 403) {
      const txt = await intensityRes.text();
      let zoneKey = "this region";
      try { zoneKey = JSON.parse(txt).error?.match(/zoneKey=([^,]+)/)?.[1] ?? zoneKey; } catch { /* ignore */ }
      return new Response(
        JSON.stringify({
          error: "api_unauthorized",
          message: `Your Electricity Maps API key doesn't have access to ${zoneKey}. Free personal keys are limited to one demo zone — request a commercial or educational key at api-portal.electricitymaps.com for global coverage.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!intensityRes.ok) {
      const txt = await intensityRes.text();
      throw new Error(`Electricity Maps intensity [${intensityRes.status}]: ${txt}`);
    }
    if (!breakdownRes.ok) {
      const txt = await breakdownRes.text();
      throw new Error(`Electricity Maps breakdown [${breakdownRes.status}]: ${txt}`);
    }

    const intensity = await intensityRes.json();
    const breakdown = await breakdownRes.json();
    const history = historyRes.ok ? await historyRes.json() : { history: [] };

    return new Response(
      JSON.stringify({
        location: { lat: Number(lat), lon: Number(lon), display_name },
        zone: intensity.zone,
        intensity, // { carbonIntensity, datetime, ... }
        breakdown, // { powerConsumptionBreakdown, fossilFreePercentage, renewablePercentage, ... }
        history,   // { history: [{ carbonIntensity, datetime }] }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("grid-intensity error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
