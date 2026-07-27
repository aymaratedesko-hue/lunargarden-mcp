// src/lib/astrologyapi.js - AstrologyAPI.com client with HTTP Basic Auth + mock mode.
//
// Real calls are DISABLED unless:
//   - env.ASTROLOGY_API_USER_ID is present AND
//   - env.ASTROLOGY_API_KEY is present AND
//   - env.LIVE_ASTROLOGY === "true"
//
// In mock mode, deterministic placeholder data is returned shaped exactly like
// the real response, with mock = true so callers can distinguish.

const BASE_URL = "https://json.astrologyapi.com/v1";
const LIVE_TTL_SECONDS = 60 * 60;          // 1 hour
const MOCK_TTL_SECONDS = 60 * 5;           // 5 minutes

function canCallLive(env) {
  return Boolean(env && env.ASTROLOGY_API_USER_ID && env.ASTROLOGY_API_KEY && env.LIVE_ASTROLOGY === "true");
}

function basicAuthHeader(env) {
  const token = btoa(`${env.ASTROLOGY_API_USER_ID}:${env.ASTROLOGY_API_KEY}`);
  return `Basic ${token}`;
}

function isoToDateParts(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return {
      day: now.getUTCDate(),
      month: now.getUTCMonth() + 1,
      year: now.getUTCFullYear(),
      hour: now.getUTCHours(),
      min: now.getUTCMinutes(),
    };
  }
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    min: d.getUTCMinutes(),
  };
}

function pickLatLon(input) {
  const lat = typeof input.lat === "number" ? input.lat : 0;
  const lon = typeof input.lon === "number" ? input.lon : 0;
  return { lat, lon };
}

function tzoneFromLatLon(lat, lon) {
  // Approximate: 15 degrees per hour, clamped to a sane range.
  const tz = Math.round(lon / 15);
  return Math.max(-12, Math.min(14, tz));
}

function moonPhaseMock(seedHour) {
  // Deterministic lunar phase from current UTC hour for stable test fixtures.
  const cycle = [
    { phase: "New Moon", illumination_pct: 0, age_days: 0 },
    { phase: "Waxing Crescent", illumination_pct: 25, age_days: 3.7 },
    { phase: "First Quarter", illumination_pct: 50, age_days: 7.4 },
    { phase: "Waxing Gibbous", illumination_pct: 75, age_days: 11.1 },
    { phase: "Full Moon", illumination_pct: 100, age_days: 14.8 },
    { phase: "Waning Gibbous", illumination_pct: 75, age_days: 18.5 },
    { phase: "Last Quarter", illumination_pct: 50, age_days: 22.2 },
    { phase: "Waning Crescent", illumination_pct: 25, age_days: 25.9 },
  ];
  const idx = ((seedHour || 0) % cycle.length + cycle.length) % cycle.length;
  return cycle[idx];
}

function moonSignMock(seedHour) {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  return signs[((seedHour || 0) % signs.length + signs.length) % signs.length];
}

function basicPanchangMock(seedHour) {
  const tithis = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima", "Amavasya"];
  const nakshatras = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanistha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
  const yogas = ["Vishkumbha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"];
  const vaaras = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const karanas = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti", "Shakuni", "Chatushpada", "Naga", "Kimstughna"];
  const i = (seedHour || 0) % tithis.length;
  return {
    tithi: tithis[i],
    nakshatra: nakshatras[i % nakshatras.length],
    yoga: yogas[i % yogas.length],
    karana: karanas[i % karanas.length],
    vaara: vaaras[i % vaaras.length],
    sunrise: "06:00",
    sunset: "18:30",
    moonrise: "07:15",
    moonset: "19:45",
  };
}

async function postAstrologyApi(env, endpoint, body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 6000);
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": basicAuthHeader(env),
        "Content-Type": "application/json",
        "Accept-Language": "en",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AstrologyAPI ${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Public: fetch combined lunar + panchang signal.
// Returns: { phase, illumination_pct, age_days, moon_sign, moon_degree,
//            panchang: { tithi, nakshatra, yoga, karana, vaara,
//                        sunrise, sunset, moonrise, moonset },
//            source, mock }
export async function getLunarGardenSignal(env, input) {
  const datetime = (input && input.datetime) || new Date().toISOString();
  const { lat, lon } = pickLatLon(input || {});
  const tzone = tzoneFromLatLon(lat, lon);
  const parts = isoToDateParts(datetime);

  if (!canCallLive(env)) {
    const seedHour = parts.hour;
    const phase = moonPhaseMock(seedHour);
    return {
      ...phase,
      moon_sign: moonSignMock(seedHour),
      moon_degree: ((seedHour * 12) % 360),
      panchang: basicPanchangMock(seedHour),
      source: "mock://astrologyapi.com/v1/moon_phase_report+basic_panchang",
      mock: true,
      cache_ttl_seconds: MOCK_TTL_SECONDS,
    };
  }

  // Live mode: call both endpoints in parallel.
  const moonBody = { ...parts, lat, lon, tzone, house_type: "placidus" };
  const panchangBody = { ...parts, lat, lon, tzone };

  const [moonRes, panchangRes] = await Promise.all([
    postAstrologyApi(env, "moon_phase_report", moonBody),
    postAstrologyApi(env, "basic_panchang", panchangBody),
  ]);

  return {
    phase: moonRes.phase || moonRes.moon_phase || "Unknown",
    illumination_pct: typeof moonRes.illumination === "number" ? moonRes.illumination : (moonRes.illumination_pct || 0),
    age_days: typeof moonRes.age === "number" ? moonRes.age : (moonRes.age_days || 0),
    moon_sign: moonRes.moon_sign || moonRes.sign || "Unknown",
    moon_degree: moonRes.moon_degree || moonRes.degree || 0,
    panchang: {
      tithi: panchangRes.tithi || "Unknown",
      nakshatra: panchangRes.nakshatra || "Unknown",
      yoga: panchangRes.yoga || "Unknown",
      karana: panchangRes.karana || "Unknown",
      vaara: panchangRes.vaara || "Unknown",
      sunrise: panchangRes.sunrise || "",
      sunset: panchangRes.sunset || "",
      moonrise: panchangRes.moonrise || "",
      moonset: panchangRes.moonset || "",
    },
    source: "astrologyapi.com/v1/moon_phase_report+basic_panchang",
    mock: false,
    cache_ttl_seconds: LIVE_TTL_SECONDS,
  };
}