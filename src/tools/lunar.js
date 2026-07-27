// src/tools/lunar.js - get_lunar_garden_signal tool.

import { getLunarGardenSignal } from "../lib/astrologyapi.js";
import { getCache, cacheKey } from "../lib/cache.js";

export const definition = {
  name: "get_lunar_garden_signal",
  description: "Get combined lunar phase + Vedic panchang signal for gardening at a given location and time.",
  inputSchema: {
    type: "object",
    properties: {
      datetime: { type: "string", description: "ISO 8601 datetime (UTC). Optional, defaults to now." },
      lat: { type: "number", description: "Latitude (-90..90). Optional, defaults to 0." },
      lon: { type: "number", description: "Longitude (-180..180). Optional, defaults to 0." },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      phase: { type: "string" },
      illumination_pct: { type: "number" },
      age_days: { type: "number" },
      moon_sign: { type: "string" },
      moon_degree: { type: "number" },
      panchang: {
        type: "object",
        properties: {
          tithi: { type: "string" },
          nakshatra: { type: "string" },
          yoga: { type: "string" },
          karana: { type: "string" },
          vaara: { type: "string" },
          sunrise: { type: "string" },
          sunset: { type: "string" },
          moonrise: { type: "string" },
          moonset: { type: "string" },
        },
      },
      source: { type: "string" },
      mock: { type: "boolean" },
      cache_ttl_seconds: { type: "number" },
    },
    required: ["phase", "illumination_pct", "moon_sign", "panchang", "source", "mock"],
  },
};

export async function handler(args, env) {
  const datetime = (args && args.datetime) || new Date().toISOString();
  const lat = typeof args.lat === "number" ? args.lat : 0;
  const lon = typeof args.lon === "number" ? args.lon : 0;

  // Validate ranges.
  if (lat < -90 || lat > 90) throw new Error("lat must be between -90 and 90");
  if (lon < -180 || lon > 180) throw new Error("lon must be between -180 and 180");

  const cache = getCache(env);
  const key = cacheKey({ tool: "lunar", datetime, lat, lon });
  const cached = await cache.get(key);
  if (cached) return { content: [{ type: "text", text: JSON.stringify(cached) }] };

  const data = await getLunarGardenSignal(env, { datetime, lat, lon });
  await cache.put(key, data, data.cache_ttl_seconds || 300);
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}