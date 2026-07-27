// src/tools/soil.js - get_soil_profile tool (fail-soft).

import { getSoilProfile } from "../lib/soilgrids.js";
import { getCache, cacheKey } from "../lib/cache.js";

export const definition = {
  name: "get_soil_profile",
  description: "Get static SoilGrids soil profile for a location. FAIL-SOFT: returns empty profile on failure rather than blocking composite plans.",
  inputSchema: {
    type: "object",
    properties: {
      lat: { type: "number", description: "Latitude (-90..90). Required." },
      lon: { type: "number", description: "Longitude (-180..180). Required." },
      depths: { type: "array", items: { type: "string" }, description: "Soil depth labels (e.g. ['0-5cm','5-15cm']). Optional." },
      properties: { type: "array", items: { type: "string" }, description: "Soil property codes (e.g. ['phh2o','clay']). Optional." },
    },
    required: ["lat", "lon"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      profile: { type: "array" },
      failed: { type: "boolean" },
      reason: { type: "string" },
      source: { type: "string" },
      cache_ttl_seconds: { type: "number" },
    },
    required: ["profile", "failed"],
  },
};

export async function handler(args, env) {
  if (!args || typeof args.lat !== "number" || typeof args.lon !== "number") {
    throw new Error("lat and lon are required numbers");
  }
  if (args.lat < -90 || args.lat > 90) throw new Error("lat must be between -90 and 90");
  if (args.lon < -180 || args.lon > 180) throw new Error("lon must be between -180 and 180");

  const cache = getCache(env);
  const key = cacheKey({ tool: "soil", lat: args.lat, lon: args.lon, depths: args.depths || [], properties: args.properties || [] });
  const cached = await cache.get(key);
  if (cached) return { content: [{ type: "text", text: JSON.stringify(cached) }] };

  const data = await getSoilProfile({ lat: args.lat, lon: args.lon, depths: args.depths, properties: args.properties });
  await cache.put(key, data, data.cache_ttl_seconds || 60);
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}