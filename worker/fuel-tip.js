// Fuel Tip: station-reported Canadian prices via Cardog. Never expose CARDOG_API_KEY in the frontend.
const FUEL_ORIGINS = new Set(["https://tusharkumar95.github.io", "http://localhost:8788", "http://127.0.0.1:8788"]);
function fuelJson(data, status, origin, extra = {}) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", ...extra };
  if (FUEL_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !FUEL_ORIGINS.has(origin)) return fuelJson({error:"Origin not permitted."}, 403, origin);
    if (request.method !== "GET") return fuelJson({error:"Method not allowed."}, 405, origin);
    const input = new URL(request.url).searchParams;
    const lat = Number(input.get("lat")), lng = Number(input.get("lng"));
    const radius = Number(input.get("radius") || "8");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 41 || lat > 84 || lng < -142 || lng > -52 || ![5,8,10,15].includes(radius)) {
      return fuelJson({error:"Provide a Canadian location and a 5, 8, 10 or 15 km radius."}, 400, origin);
    }
    if (!env.CARDOG_API_KEY) {
      return fuelJson({error:"The free fuel-price feed is not connected yet.", code:"FUEL_NOT_CONFIGURED", setup:"Add CARDOG_API_KEY to the Jarvis Cloudflare Worker secrets."}, 503, origin);
    }

    // Round to ~1 km grid for privacy/caching. Never log precise device coordinates.
    const centerLat = Math.round(lat * 100) / 100;
    const centerLng = Math.round(lng * 100) / 100;
    const key = new Request("https://jarvis-fuel-cache.local/fuel/" + centerLat + "/" + centerLng + "/" + radius);
    const cache = typeof caches !== "undefined" ? caches.default : null;
    if (cache) {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        return fuelJson({ ...data, cached:true }, 200, origin);
      }
    }
    const remote = new URL("https://api.cardog.app/v2/fuel/stations");
    remote.searchParams.set("lat", String(centerLat));
    remote.searchParams.set("lng", String(centerLng));
    remote.searchParams.set("radius_km", String(radius));
    remote.searchParams.set("limit", "100");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11000);
    let response;
    try {
      response = await fetch(remote, {headers: {"x-api-key": env.CARDOG_API_KEY, "Cardog-Version": "2026-10-26", "Accept":"application/json"}, signal:controller.signal});
    } catch {
      return fuelJson({error:"Fuel-price provider is temporarily unavailable."}, 502, origin);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 402) return fuelJson({error:"The free monthly fuel-price allowance is exhausted. Try again next month or use GasBuddy.", code:"FREE_LIMIT"}, 503, origin);
    if (!response.ok) return fuelJson({error:"Fuel-price provider could not return prices.", code:"PROVIDER_ERROR"}, 502, origin);
    let raw;
    try { raw = await response.json(); } catch { return fuelJson({error:"Invalid fuel-price response."}, 502, origin); }
    const data = raw?.response?.stations ? raw.response : raw;
    if (!Array.isArray(data?.stations)) return fuelJson({error:"Unexpected fuel-price format."}, 502, origin);
    const stations = data.stations.filter(s => /\bshell\b/i.test(String(s.brand || "") + " " + String(s.name || ""))).map(s => ({
      id:String(s.id || "").slice(0,60), name:String(s.name || "Shell").slice(0,120), brand:String(s.brand || "Shell").slice(0,80),
      address:s.address || {}, location:s.location || {}, distanceKm:Number.isFinite(Number(s.distanceKm)) ? Number(s.distanceKm) : null,
      prices:Array.isArray(s.prices) ? s.prices.filter(p => Number.isFinite(Number(p.centsPerLitre))).map(p => ({
        fuel:String(p.fuel || ""), payment:String(p.payment || ""), centsPerLitre:Number(p.centsPerLitre),
        postedAt:String(p.postedAt || ""), reportedBy:String(p.reportedBy || "")
      })) : []
    }));
    const result = {stations, asOf:String(data.asOf || ""), fetchedAt:new Date().toISOString(), source:"Cardog", sourceKind:"daily_snapshot", radiusKm:radius, cached:false};
    // 18-hour edge cache protects the 50-request free monthly allowance; no secret cached.
    if (cache) {
      const cached = new Response(JSON.stringify(result), {headers:{"Content-Type":"application/json","Cache-Control":"public, max-age=64800"}});
      try { await cache.put(key, cached); } catch {}
    }
    return fuelJson(result, 200, origin);
  }
};
