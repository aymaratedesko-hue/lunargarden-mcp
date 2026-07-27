// src/tools/weather.js - get_weather_soil_forecast tool.

import { getWeatherSoilForecast } from "../lib/openmeteo.js";
import { getCache, cacheKey } from "../lib/cache.js";

export const definition = {
  name: "get_weather_soil_forecast",
  description: "Get hourly weather + soil temperature/moisture forecast (24/48/72h) for a location from Open-Meteo.",
  inputSchema: {
    type: "object",
    properties: {
      lat: { type: "number", description: "Latitude (-90..90). Required." },
      lon: { type: "number", description: "Longitude (-180..180). Required." },
      hours: { type: "number", enum: [24, 48, 72], description: "Forecast horizon in hours. Default 24." },
    },
    required: ["lat", "lon"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      hourly: { type: "array" },
      source: { type: "string" },
      cache_ttl_seconds: { type: "number" },
      requested_hours: { type: "number" },
    },
    required: ["hourly", "source"],
  },
};

export async function handler(args, env) {
  if (!args || typeof args.lat !== "number" || typeof args.lon !== "number") {
    throw new Error("lat and lon are required numbers");
  }
  if (args.lat < -90 || args.lat > 90) throw new Error("lat must be between -90 and 90");
  if (args.lon < -180 || args.lon > 180) throw new Error("lon must be between -180 and 180");
  const hours = args.hours || 24;

  const cache = getCache(env);
  const key = cacheKey({ tool: "weather", lat: args.lat, lon: args.lon, hours });
  const cached = await cache.get(key);
  if (cached) return { content: [{ type: "text", text: JSON.stringify(cached) }] };

  const data = await getWeatherSoilForecast({ lat: args.lat, lon: args.lon, hours });
  await cache.put(key, data, data.cache_ttl_seconds || 900);
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}