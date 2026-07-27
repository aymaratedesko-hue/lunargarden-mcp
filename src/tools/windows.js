// src/tools/windows.js - find_garden_care_windows tool.

import { getWeatherSoilForecast, getAirQualityUv } from "../lib/openmeteo.js";
import { scoreWindows } from "../lib/scoring.js";

export const definition = {
  name: "find_garden_care_windows",
  description: "Find optimal outdoor work windows in the next 24-72h based on weather, soil moisture, and UV constraints. Pure weather logic, no astrology.",
  inputSchema: {
    type: "object",
    properties: {
      lat: { type: "number", description: "Latitude (-90..90). Required." },
      lon: { type: "number", description: "Longitude (-180..180). Required." },
      activity: { type: "string", enum: ["watering", "pruning", "planting", "harvesting"], description: "Type of garden work. Required." },
      hours: { type: "number", enum: [24, 48, 72], description: "Forecast horizon. Default 24." },
      min_window_minutes: { type: "number", description: "Minimum window duration in minutes. Default 60." },
    },
    required: ["lat", "lon", "activity"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      windows: { type: "array" },
      source: { type: "string" },
      score_threshold: { type: "number" },
    },
    required: ["windows", "source"],
  },
};

export async function handler(args, _env) {
  if (!args || typeof args.lat !== "number" || typeof args.lon !== "number") {
    throw new Error("lat and lon are required numbers");
  }
  if (!args.activity || typeof args.activity !== "string") {
    throw new Error("activity is required (watering | pruning | planting | harvesting)");
  }
  if (args.lat < -90 || args.lat > 90) throw new Error("lat must be between -90 and 90");
  if (args.lon < -180 || args.lon > 180) throw new Error("lon must be between -180 and 180");
  const hours = args.hours || 24;
  const minWin = args.min_window_minutes || 60;

  // Pull both atomic sources in parallel.
  const [weather, uv] = await Promise.all([
    getWeatherSoilForecast({ lat: args.lat, lon: args.lon, hours }),
    getAirQualityUv({ lat: args.lat, lon: args.lon, hours }),
  ]);

  const windows = scoreWindows(args.activity, weather.hourly, uv.hourly, minWin);
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        windows,
        score_threshold: 70,
        activity: args.activity,
        source: "open-meteo.com/v1/forecast + air-quality-api.open-meteo.com/v1/air-quality",
      }),
    }],
  };
}