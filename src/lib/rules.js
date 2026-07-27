// src/lib/rules.js - Astrology-to-gardening heuristic mapping.
//
// This is INTENTIONAL HEURISTIC, not scientific claim. Rules are cited sources
// from gardening-by-the-moon traditions (a folk practice). Each rule carries a
// "source" tag so explain_care_decision can cite it.

export const RULES = [
  {
    id: "moon.waxing_plant_above_ground",
    appliesTo: ["planting", "transplanting"],
    when: (lunar) => lunar && (lunar.phase || "").toLowerCase().includes("waxing"),
    effect: "favors",
    confidence_boost: 0.05,
    note: "Waxing moon: tradition suggests stronger above-ground growth.",
    sources: ["gardenbythemoon.com", "almanac.com/gardening/moon-phase"],
  },
  {
    id: "moon.waning_plant_below_ground",
    appliesTo: ["planting"],
    when: (lunar) => lunar && (lunar.phase || "").toLowerCase().includes("waning"),
    effect: "favors",
    confidence_boost: 0.04,
    note: "Waning moon: tradition suggests stronger root development.",
    sources: ["gardenbythemoon.com"],
  },
  {
    id: "moon.full_avoid_pruning",
    appliesTo: ["pruning"],
    when: (lunar) => lunar && (lunar.phase || "").toLowerCase().includes("full"),
    effect: "discourages",
    confidence_boost: 0.0,
    note: "Full moon: tradition suggests higher sap flow, avoid heavy pruning.",
    sources: ["almanac.com/gardening/moon-phase"],
  },
  {
    id: "panchang.water_sign_nourish",
    appliesTo: ["watering", "planting"],
    when: (lunar) => {
      const sign = (lunar && lunar.moon_sign) || "";
      return ["Cancer", "Scorpio", "Pisces"].includes(sign);
    },
    effect: "favors",
    confidence_boost: 0.06,
    note: "Water signs (Cancer, Scorpio, Pisces): tradition suggests fertile windows.",
    sources: ["astrology.com/moon-signs"],
  },
  {
    id: "panchang.dry_sign_harvest",
    appliesTo: ["harvesting", "pruning"],
    when: (lunar) => {
      const sign = (lunar && lunar.moon_sign) || "";
      return ["Aries", "Leo", "Sagittarius"].includes(sign);
    },
    effect: "favors",
    confidence_boost: 0.05,
    note: "Fire signs: tradition suggests drier, better for harvest / pruning.",
    sources: ["astrology.com/moon-signs"],
  },
  {
    id: "weather.heavy_rain_postpone_watering",
    appliesTo: ["watering", "planting"],
    when: (ctx) => ctx && ctx.weather && ctx.weather.precipitation_mm_max > 5,
    effect: "discourages",
    confidence_boost: -0.30,
    note: "Heavy rain forecast: postpone watering / planting to avoid oversaturation.",
    sources: ["local-agronomy-guidelines"],
  },
  {
    id: "weather.high_uv_postpone_transplant",
    appliesTo: ["transplanting", "pruning"],
    when: (ctx) => ctx && ctx.weather && ctx.weather.uv_index_max > 8,
    effect: "discourages",
    confidence_boost: -0.25,
    note: "High UV index: postpone transplanting / heavy pruning to reduce plant stress.",
    sources: ["local-agronomy-guidelines"],
  },
  {
    id: "weather.low_wind_favors_all",
    appliesTo: ["planting", "pruning", "harvesting", "watering"],
    when: (ctx) => ctx && ctx.weather && ctx.weather.wind_kmh_max < 12,
    effect: "favors",
    confidence_boost: 0.04,
    note: "Low wind: gentler conditions for outdoor tasks.",
    sources: ["local-agronomy-guidelines"],
  },
  {
    id: "soil.dry_urgency_watering",
    appliesTo: ["watering"],
    when: (ctx) => ctx && ctx.soil && ctx.soil.soil_moisture_min !== null && ctx.soil.soil_moisture_min < 0.10,
    effect: "favors",
    confidence_boost: 0.20,
    note: "Low soil moisture: watering becomes urgent.",
    sources: ["local-agronomy-guidelines"],
  },
];

export function evaluateRules(lunar, ctx) {
  const matched = [];
  for (const rule of RULES) {
    try {
      if (rule.when(lunar, ctx)) matched.push(rule);
    } catch (_e) {
      // rule evaluation failures are non-fatal; skip.
    }
  }
  return matched;
}

export function computeConfidence(matchedRules, baseConfidence) {
  const base = typeof baseConfidence === "number" ? baseConfidence : 0.5;
  let delta = 0;
  for (const r of matchedRules) {
    delta += (typeof r.confidence_boost === "number" ? r.confidence_boost : 0);
  }
  return Math.max(0, Math.min(1, base + delta));
}