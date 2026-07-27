// src/lib/openmeteo.js - Open-Meteo Forecast + Air Quality clients.
//
// Both APIs are public, no auth, no quota. Cache TTL defaults are short (15 min)
// because weather changes frequently.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const HOURS_FIELD = "hourly=temperature_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_1cm";
const UV_FIELD = "hourly=uv_index,uv_index_clear_sky";

const FORECAST_TTL_SECONDS = 60 * 15; // 15 min
const UV_TTL_SECONDS = 60 * 15;        // 15 min

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
      const text = await res.text().catch(() => "");
      throw new Error(`Open-Meteo HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Public: get hourly weather + soil forecast.
// input: { lat, lon, hours } where hours in {24, 48, 72}, default 24.
// Returns: { hourly[], source, cache_ttl_seconds }
export async function getWeatherSoilForecast(input) {
  const lat = Number(input && input.lat);
  const lon = Number(input && input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("lat and lon must be finite numbers");
  }
  const hours = Number.isFinite(Number(input && input.hours)) ? Number(input.hours) : 24;
  const safeHours = [24, 48, 72].includes(hours) ? hours : 24;
  const url = `${FORECAST_URL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&${HOURS_FIELD}&forecast_hours=${safeHours}&timezone=UTC`;
  const data = await getJson(url);
  const h = data.hourly || {};
  const out = [];
  const len = Math.min((h.time || []).length, safeHours);
  for (let i = 0; i < len; i++) {
    out.push({
      time: h.time[i],
      temp_c: h.temperature_2m ? h.temperature_2m[i] : null,
      precipitation_mm: h.precipitation ? h.precipitation[i] : null,
      wind_speed_kmh: h.wind_speed_10m ? h.wind_speed_10m[i] : null,
      soil_temp_c_0cm: h.soil_temperature_0cm ? h.soil_temperature_0cm[i] : null,
      soil_moisture_m3m3_0to1cm: h.soil_moisture_0_to_1cm ? h.soil_moisture_0_to_1cm[i] : null,
    });
  }
  return {
    hourly: out,
    source: "open-meteo.com/v1/forecast",
    cache_ttl_seconds: FORECAST_TTL_SECONDS,
    requested_hours: safeHours,
  };
}

// Public: get hourly UV + air quality.
// input: { lat, lon, hours } where hours in {24, 48, 72}, default 24.
export async function getAirQualityUv(input) {
  const lat = Number(input && input.lat);
  const lon = Number(input && input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("lat and lon must be finite numbers");
  }
  const hours = Number.isFinite(Number(input && input.hours)) ? Number(input.hours) : 24;
  const safeHours = [24, 48, 72].includes(hours) ? hours : 24;
  const url = `${AIR_QUALITY_URL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&${UV_FIELD}&forecast_hours=${safeHours}&timezone=UTC`;
  const data = await getJson(url);
  const h = data.hourly || {};
  const out = [];
  const len = Math.min((h.time || []).length, safeHours);
  for (let i = 0; i < len; i++) {
    out.push({
      time: h.time[i],
      uv_index: h.uv_index ? h.uv_index[i] : null,
      uv_index_clear_sky: h.uv_index_clear_sky ? h.uv_index_clear_sky[i] : null,
    });
  }
  return {
    hourly: out,
    source: "air-quality-api.open-meteo.com/v1/air-quality",
    cache_ttl_seconds: UV_TTL_SECONDS,
    requested_hours: safeHours,
  };
}