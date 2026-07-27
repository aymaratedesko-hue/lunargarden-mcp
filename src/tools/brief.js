// src/tools/brief.js - generate_agent_brief tool.
//
// Aggregates plan_garden_care output into a structured brief for downstream agents.

import { getLunarGardenSignal } from "../lib/astrologyapi.js";
import { getWeatherSoilForecast, getAirQualityUv } from "../lib/openmeteo.js";
import { getSoilProfile } from "../lib/soilgrids.js";
import { evaluateRules, computeConfidence } from "../lib/rules.js";

export const definition = {
  name: "generate_agent_brief",
  description: "Build an inter-agent handoff brief for downstream scheduling/monitoring agents. Includes upcoming actions, watchpoints, and data provenance.",
  inputSchema: {
    type: "object",
    properties: {
      lat: { type: "number", description: "Latitude (-90..90). Required." },
      lon: { type: "number", description: "Longitude (-180..180). Required." },
      plants: { type: "array", items: { type: "string" }, description: "Plant context. Required." },
      window_hours: { type: "number", enum: [24, 48, 72], description: "Forecast horizon. Default 24." },
      audience_agent: { type: "string", description: "Optional audience agent name hint." },
    },
    required: ["lat", "lon", "plants"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      brief_id: { type: "string" },
      summary: { type: "string" },
      upcoming_actions: { type: "array" },
      watchpoints: { type: "array" },
      data_provenance: { type: "array" },
      recommended_followups: { type: "array" },
    },
    required: ["brief_id", "summary", "upcoming_actions", "watchpoints", "data_provenance", "recommended_followups"],
  },
};

function shortId() {
  return Math.random().toString(36).slice(2, 10);
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
  const hours = args.window_hours || 24;
  const plants = args.plants.map((s) => String(s));

  const nowIso = new Date().toISOString();
  const [lunar, weather, uv, soil] = await Promise.all([
    getLunarGardenSignal(env, { datetime: nowIso, lat: args.lat, lon: args.lon }),
    getWeatherSoilForecast({ lat: args.lat, lon: args.lon, hours }),
    getAirQualityUv({ lat: args.lat, lon: args.lon, hours }),
    getSoilProfile({ lat: args.lat, lon: args.lon }),
  ]);

  // Build upcoming_actions from the next 3 weather samples (top 3 by activity match).
  const actions = [];
  const uvByTime = new Map();
  for (const u of uv.hourly || []) uvByTime.set(u.time, u);
  const samples = (weather.hourly || []).slice(0, 6);
  for (const hour of samples) {
    const ctx = {
      weather: { precipitation_mm: hour.precipitation_mm, wind_kmh_max: hour.wind_speed_kmh, uv_index_max: uvByTime.get(hour.time) ? uvByTime.get(hour.time).uv_index : null },
      soil: { soil_moisture_min: soil.profile && soil.profile.length ? soil.profile[0].value : null },
      uv: { uv_index: uvByTime.get(hour.time) ? uvByTime.get(hour.time).uv_index : null },
    };
    const matched = evaluateRules(lunar, ctx);
    const conf = computeConfidence(matched, 0.5);
    actions.push({
      datetime_utc: hour.time,
      activity: "watering",
      confidence: conf,
      cited_rules: matched.map((r) => r.id),
    });
  }

  const watchpoints = [];
  for (const h of weather.hourly || []) {
    if (typeof h.precipitation_mm === "number" && h.precipitation_mm > 8) {
      watchpoints.push({ type: "heavy_rain", time: h.time, value_mm: h.precipitation_mm });
    }
    const uvH = uvByTime.get(h.time);
    if (uvH && typeof uvH.uv_index === "number" && uvH.uv_index > 8) {
      watchpoints.push({ type: "high_uv", time: h.time, value: uvH.uv_index });
    }
    if (typeof h.wind_speed_kmh === "number" && h.wind_speed_kmh > 30) {
      watchpoints.push({ type: "high_wind", time: h.time, value_kmh: h.wind_speed_kmh });
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        brief_id: shortId(),
        summary: `Garden care brief for ${plants.join(", ")} @ lat=${args.lat} lon=${args.lon} (${hours}h horizon). ${actions.length} candidate actions evaluated.`,
        upcoming_actions: actions,
        watchpoints: watchpoints.slice(0, 10),
        data_provenance: [
          weather.source,
          uv.source,
          lunar && lunar.mock ? "mock://astrologyapi.com" : "astrologyapi.com/v1/moon_phase_report+basic_panchang",
          soil.failed ? "soilgrids://fail-soft-empty" : "rest.isric.org/soilgrids/v2.0/properties/query",
        ],
        recommended_followups: [
          "Poll plan_garden_care for a longer horizon (48h or 72h) if next-day schedule is needed.",
          "Ask a second agent to review the brief via agents-guide.md and call tools/list to validate schemas.",
          "If soil_moisture_min is below 0.10, escalate watering urgency via the steward channel.",
        ],
        audience_agent: args.audience_agent || null,
      }),
    }],
  };
}