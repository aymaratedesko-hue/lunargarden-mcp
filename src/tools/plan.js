// src/tools/plan.js - plan_garden_care composite tool.
//
// Pulls lunar + panchang + weather + soil + UV atomic tools in parallel,
// evaluates heuristic rules, computes confidence, returns plan[] with
// per-item context, rationale, cited_rules, data_sources.

import { getLunarGardenSignal } from "../lib/astrologyapi.js";
import { getWeatherSoilForecast, getAirQualityUv } from "../lib/openmeteo.js";
import { getSoilProfile } from "../lib/soilgrids.js";
import { evaluateRules, computeConfidence } from "../lib/rules.js";

const ACTIVITIES = ["watering", "planting", "pruning", "harvesting"];

export const definition = {
  name: "plan_garden_care",
  description: "Composite 24-72h structured garden care plan combining lunar phase + Vedic panchang + weather + soil + UV. Each plan item carries confidence, rationale, and cited rules.",
  inputSchema: {
    type: "object",
    properties: {
      lat: { type: "number", description: "Latitude (-90..90). Required." },
      lon: { type: "number", description: "Longitude (-180..180). Required." },
      plants: { type: "array", items: { type: "string" }, description: "Plant context (e.g. ['tomato','basil']). Required." },
      hours: { type: "number", enum: [24, 48, 72], description: "Forecast horizon. Default 24." },
    },
    required: ["lat", "lon", "plants"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      plan: { type: "array" },
      data_provenance: { type: "array" },
      mock_astrology: { type: "boolean" },
    },
    required: ["plan", "data_provenance"],
  },
};

function pickActivities(plants) {
  // Heuristic plant -> activity mapping.
  const out = new Set();
  for (const p of plants || []) {
    const s = (p || "").toLowerCase();
    if (/(tomato|basil|pepper|lettuce|spinach|kale|herb|leaf)/.test(s)) out.add("watering");
    if (/(seed|root|carrot|potato|onion|garlic|beet|radish)/.test(s)) out.add("planting");
    if (/(tomato|grape|rose|fruit|tree|vine|berry)/.test(s)) out.add("pruning");
    if (/(tomato|lettuce|herb|leaf|fruit|berry)/.test(s)) out.add("harvesting");
  }
  // Always include watering as default.
  out.add("watering");
  return Array.from(out);
}

function buildPlanItem(hour, activity, lunar, ctx, plants) {
  const matched = evaluateRules(lunar, ctx);
  const confidence = computeConfidence(matched, 0.55);
  // Determine recommendation direction.
  const netBoost = matched.reduce((acc, r) => acc + (r.effect === "favors" ? 0.05 : r.effect === "discourages" ? -0.05 : 0), 0);
  const doIt = netBoost >= -0.10;

  const rationale = matched.length > 0
    ? matched.map((r) => r.note).join(" | ")
    : "No strong signals from rules; default recommendation based on time and plants.";

  return {
    datetime_utc: hour.time,
    action: doIt ? activity : `skip ${activity}`,
    plants,
    context: {
      lunar: lunar ? { phase: lunar.phase, moon_sign: lunar.moon_sign, mock: !!lunar.mock } : null,
      panchang: lunar && lunar.panchang ? lunar.panchang : null,
      weather: ctx.weather,
      soil: ctx.soil,
      uv: ctx.uv,
    },
    rationale,
    confidence,
    cited_rules: matched,
    data_sources: [
      ctx.weatherSource,
      ctx.uvSource,
      lunar ? (lunar.mock ? "mock://astrologyapi.com" : "astrologyapi.com/v1/moon_phase_report+basic_panchang") : null,
      ctx.soil.failed ? "soilgrids://failed-fail-soft" : "rest.isric.org/soilgrids/v2.0/properties/query",
    ].filter(Boolean),
  };
}

export async function handler(args, env) {
  if (!args || typeof args.lat !== "number" || typeof args.lon !== "number") {
    throw new Error("lat and lon are required numbers");
  }
  if (!Array.isArray(args.plants) || args.plants.length === 0) {
    throw new Error("plants must be a non-empty array of strings");
  }
  if (args.lat < -90 || args.lat > 90) throw new Error("lat must be between -90 and 90");
  if (args.lon < -180 || args.lon > 180) throw new Error("lon must be between -180 and 180");
  const hours = args.hours || 24;
  const plants = args.plants.map((s) => String(s));

  // Pull all atomic sources in parallel.
  const nowIso = new Date().toISOString();
  const [lunar, weather, uv, soil] = await Promise.all([
    getLunarGardenSignal(env, { datetime: nowIso, lat: args.lat, lon: args.lon }),
    getWeatherSoilForecast({ lat: args.lat, lon: args.lon, hours }),
    getAirQualityUv({ lat: args.lat, lon: args.lon, hours }),
    getSoilProfile({ lat: args.lat, lon: args.lon }),
  ]);

  // Aggregate per-hour weather+uv context.
  const uvByTime = new Map();
  for (const u of uv.hourly || []) uvByTime.set(u.time, u);

  const activities = pickActivities(plants);

  // Sample a few representative hours (start, 1/4, 1/2, 3/4, end of horizon).
  const samples = (weather.hourly || []).filter((_, i) => {
    const n = (weather.hourly || []).length;
    if (n <= 5) return true;
    return i === 0 || i === Math.floor(n * 0.25) || i === Math.floor(n * 0.5) || i === Math.floor(n * 0.75) || i === n - 1;
  });

  const plan = [];
  for (const hour of samples) {
    const uvHour = uvByTime.get(hour.time) || {};
    const ctx = {
      weather: {
        temp_c: hour.temp_c,
        precipitation_mm: hour.precipitation_mm,
        wind_speed_kmh: hour.wind_speed_kmh,
        precipitation_mm_max: hour.precipitation_mm,
        wind_kmh_max: hour.wind_speed_kmh,
        temp_c_min: hour.temp_c,
        temp_c_max: hour.temp_c,
      },
      soil: {
        soil_moisture_min: soil.profile && soil.profile.length
          ? Math.min(...soil.profile.filter((p) => p.property === "soil_moisture").map((p) => p.value).filter((v) => typeof v === "number"))
          : null,
        soil_moisture_max: null,
      },
      uv: { uv_index: uvHour.uv_index, uv_index_max: uvHour.uv_index },
      weatherSource: weather.source,
      uvSource: uv.source,
    };
    for (const activity of activities) {
      plan.push(buildPlanItem(hour, activity, lunar, ctx, plants));
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        plan,
        data_provenance: [
          weather.source,
          uv.source,
          lunar && lunar.mock ? "mock://astrologyapi.com" : "astrologyapi.com/v1/moon_phase_report+basic_panchang",
          soil.failed ? "soilgrids://fail-soft-empty" : "rest.isric.org/soilgrids/v2.0/properties/query",
        ],
        mock_astrology: !!(lunar && lunar.mock),
      }),
    }],
  };
}