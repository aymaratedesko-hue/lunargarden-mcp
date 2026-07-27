// src/lib/scoring.js - Window scoring for find_garden_care_windows.
//
// Pure weather + soil + UV logic. NO astrology here.
// Each hour is scored 0-100. A window is a contiguous run of high-scoring hours.

const ACTIVITY_RULES = {
  watering: {
    // Best: light rain just ended, soil moisture rising, no high UV, low wind.
    ideal: { rain_mm_max: 1.0, soil_moisture_min: 0.15, uv_max: 6, wind_kmh_max: 20, temp_c_min: 5, temp_c_max: 32 },
    score: (h) => {
      let s = 100;
      if (h.precipitation_mm == null) s -= 5;
      if (h.precipitation_mm > 5) s -= 60;
      if (h.precipitation_mm > 1) s -= 10;
      if (typeof h.soil_moisture_m3m3_0to1cm === "number" && h.soil_moisture_m3m3_0to1cm < 0.10) s -= 25;
      if (typeof h.uv_index === "number" && h.uv_index > 7) s -= 30;
      if (typeof h.wind_speed_kmh === "number" && h.wind_speed_kmh > 25) s -= 25;
      if (typeof h.temp_c === "number" && (h.temp_c < 3 || h.temp_c > 35)) s -= 40;
      return Math.max(0, Math.min(100, s));
    },
  },
  pruning: {
    // Best: dry, low wind, low humidity shift (we use temp range proxy).
    ideal: { rain_mm_max: 0.0, wind_kmh_max: 15, uv_max: 6, temp_c_min: 8, temp_c_max: 28 },
    score: (h) => {
      let s = 100;
      if (h.precipitation_mm > 0.1) s -= 70;
      if (typeof h.wind_speed_kmh === "number" && h.wind_speed_kmh > 18) s -= 35;
      if (typeof h.uv_index === "number" && h.uv_index > 7) s -= 20;
      if (typeof h.temp_c === "number" && (h.temp_c < 5 || h.temp_c > 30)) s -= 30;
      return Math.max(0, Math.min(100, s));
    },
  },
  planting: {
    // Best: mild, no heavy rain, soil moist.
    ideal: { rain_mm_max: 3.0, soil_moisture_min: 0.12, wind_kmh_max: 22, uv_max: 7, temp_c_min: 10, temp_c_max: 30 },
    score: (h) => {
      let s = 100;
      if (h.precipitation_mm > 8) s -= 50;
      if (typeof h.soil_moisture_m3m3_0to1cm === "number" && h.soil_moisture_m3m3_0to1cm < 0.08) s -= 35;
      if (typeof h.wind_speed_kmh === "number" && h.wind_speed_kmh > 28) s -= 30;
      if (typeof h.uv_index === "number" && h.uv_index > 8) s -= 15;
      if (typeof h.temp_c === "number" && (h.temp_c < 6 || h.temp_c > 34)) s -= 35;
      return Math.max(0, Math.min(100, s));
    },
  },
  harvesting: {
    // Best: dry, cool, low wind.
    ideal: { rain_mm_max: 0.0, wind_kmh_max: 18, uv_max: 6, temp_c_min: 8, temp_c_max: 26 },
    score: (h) => {
      let s = 100;
      if (h.precipitation_mm > 0.1) s -= 60;
      if (typeof h.wind_speed_kmh === "number" && h.wind_speed_kmh > 22) s -= 30;
      if (typeof h.uv_index === "number" && h.uv_index > 7) s -= 25;
      if (typeof h.temp_c === "number" && (h.temp_c < 4 || h.temp_c > 32)) s -= 30;
      return Math.max(0, Math.min(100, s));
    },
  },
};

function safeNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function summarizeHour(h, uv) {
  return {
    temp_c: safeNum(h.temp_c),
    precipitation_mm: safeNum(h.precipitation_mm),
    wind_speed_kmh: safeNum(h.wind_speed_kmh),
    soil_temp_c_0cm: safeNum(h.soil_temp_c_0cm),
    soil_moisture_m3m3_0to1cm: safeNum(h.soil_moisture_m3m3_0to1cm),
    uv_index: uv ? safeNum(uv.uv_index) : null,
  };
}

// score all hours, find contiguous runs of score >= threshold, return windows.
export function scoreWindows(activity, weatherHourly, uvHourly, minWindowMinutes) {
  const rule = ACTIVITY_RULES[activity] || ACTIVITY_RULES.watering;
  const minWin = Math.max(30, Math.floor(minWindowMinutes || 60));
  const threshold = 70;

  // Align weather + uv by time.
  const uvByTime = new Map();
  for (const u of (uvHourly || [])) {
    uvByTime.set(u.time, u);
  }

  const scored = [];
  for (const h of (weatherHourly || [])) {
    const merged = summarizeHour(h, uvByTime.get(h.time));
    const s = rule.score(merged);
    scored.push({ time: h.time, score: s, hour: merged });
  }

  // Find runs.
  const windows = [];
  let runStart = -1;
  let runSum = 0;
  let runCount = 0;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].score >= threshold) {
      if (runStart === -1) runStart = i;
      runSum += scored[i].score;
      runCount += 1;
    } else {
      if (runStart !== -1) {
        const startTime = scored[runStart].time;
        const endTime = scored[i - 1].time;
        const durationMin = runCount * 60;
        if (durationMin >= minWin) {
          windows.push({
            start_utc: startTime,
            end_utc: endTime,
            duration_minutes: durationMin,
            score: Math.round(runSum / runCount),
            weather_summary: summarizeRun(scored.slice(runStart, i), "weather"),
            soil_summary: summarizeRun(scored.slice(runStart, i), "soil"),
            uv_summary: summarizeRun(scored.slice(runStart, i), "uv"),
          });
        }
        runStart = -1;
        runSum = 0;
        runCount = 0;
      }
    }
  }
  // Tail run.
  if (runStart !== -1) {
    const startTime = scored[runStart].time;
    const endTime = scored[scored.length - 1].time;
    const durationMin = runCount * 60;
    if (durationMin >= minWin) {
      windows.push({
        start_utc: startTime,
        end_utc: endTime,
        duration_minutes: durationMin,
        score: Math.round(runSum / runCount),
        weather_summary: summarizeRun(scored.slice(runStart), "weather"),
        soil_summary: summarizeRun(scored.slice(runStart), "soil"),
        uv_summary: summarizeRun(scored.slice(runStart), "uv"),
      });
    }
  }

  // Sort by score desc then duration desc.
  windows.sort((a, b) => (b.score - a.score) || (b.duration_minutes - a.duration_minutes));
  return windows;
}

function summarizeRun(hours, kind) {
  if (!hours.length) return null;
  if (kind === "weather") {
    const temps = hours.map((h) => h.hour.temp_c).filter((v) => v !== null);
    const winds = hours.map((h) => h.hour.wind_speed_kmh).filter((v) => v !== null);
    const precs = hours.map((h) => h.hour.precipitation_mm).filter((v) => v !== null);
    return {
      temp_c_min: temps.length ? Math.min(...temps) : null,
      temp_c_max: temps.length ? Math.max(...temps) : null,
      wind_kmh_max: winds.length ? Math.max(...winds) : null,
      precipitation_mm_max: precs.length ? Math.max(...precs) : null,
    };
  }
  if (kind === "soil") {
    const moist = hours.map((h) => h.hour.soil_moisture_m3m3_0to1cm).filter((v) => v !== null);
    const stemp = hours.map((h) => h.hour.soil_temp_c_0cm).filter((v) => v !== null);
    return {
      soil_moisture_min: moist.length ? Math.min(...moist) : null,
      soil_moisture_max: moist.length ? Math.max(...moist) : null,
      soil_temp_c_min: stemp.length ? Math.min(...stemp) : null,
      soil_temp_c_max: stemp.length ? Math.max(...stemp) : null,
    };
  }
  if (kind === "uv") {
    const uvs = hours.map((h) => h.hour.uv_index).filter((v) => v !== null);
    return {
      uv_index_min: uvs.length ? Math.min(...uvs) : null,
      uv_index_max: uvs.length ? Math.max(...uvs) : null,
    };
  }
  return null;
}