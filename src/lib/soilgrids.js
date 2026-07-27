// src/lib/soilgrids.js - SoilGrids ISRIC client. FAIL-SOFT.
//
// If the endpoint returns null mean values, or 5xx, or times out, this returns
// { profile: [], failed: true, reason } instead of throwing. Composite tools
// (plan_garden_care) detect the empty profile and skip soil conditioning.

const URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const DEFAULT_PROPERTIES = ["phh2o", "ocd", "clay", "sand"];
const DEFAULT_DEPTHS = ["0-5cm", "5-15cm"];
const TTL_SECONDS = 60 * 60 * 24; // 24h, soil properties are static-ish

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 6000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`SoilGrids HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function flattenSoilgridsResponse(json) {
  const out = [];
  const layers = (json && json.properties && json.properties.layers) || [];
  for (const layer of layers) {
    const name = layer.name;
    const unit = (layer.unit_measure && layer.unit_measure.mapped_units) || "";
    const depths = layer.depths || [];
    for (const d of depths) {
      const meanEntry = (d.values || []).find((v) => v.hasOwnProperty("mean")) || {};
      out.push({
        property: name,
        depth: d.label || d.depth || "",
        value: meanEntry.mean !== undefined ? meanEntry.mean : null,
        unit,
      });
    }
  }
  return out;
}

export async function getSoilProfile(input) {
  const lat = Number(input && input.lat);
  const lon = Number(input && input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { profile: [], failed: true, reason: "lat and lon must be finite numbers" };
  }
  const properties = Array.isArray(input && input.properties) && input.properties.length > 0
    ? input.properties
    : DEFAULT_PROPERTIES;
  const depths = Array.isArray(input && input.depths) && input.depths.length > 0
    ? input.depths
    : DEFAULT_DEPTHS;
  const url = `${URL}?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&property=${properties.map(encodeURIComponent).join(",")}&depth=${depths.map(encodeURIComponent).join(",")}&value=mean`;
  try {
    const json = await getJson(url);
    const profile = flattenSoilgridsResponse(json);
    const anyValue = profile.some((p) => p.value !== null && p.value !== undefined);
    if (!anyValue) {
      // Data layer returning null is a known SoilGrids behavior; fail-soft.
      return {
        profile: [],
        failed: true,
        reason: "SoilGrids returned null mean values (known data-layer gap)",
        source: "rest.isric.org/soilgrids/v2.0/properties/query",
        cache_ttl_seconds: TTL_SECONDS,
      };
    }
    return {
      profile,
      failed: false,
      source: "rest.isric.org/soilgrids/v2.0/properties/query",
      cache_ttl_seconds: TTL_SECONDS,
    };
  } catch (e) {
    return {
      profile: [],
      failed: true,
      reason: e && e.message ? e.message : "unknown error",
      source: "rest.isric.org/soilgrids/v2.0/properties/query",
      cache_ttl_seconds: 60,
    };
  }
}