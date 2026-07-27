# LunarGarden MCP - Agents Guide

This document describes the public Model Context Protocol (MCP) interface for LunarGarden, served at `GET /agents-guide.md` on the same origin as the application.

## Transport

- Protocol: MCP-compatible JSON-RPC 2.0 over HTTP
- Endpoint: `POST /mcp` (same-origin)
- Content-Type: `application/json`
- Implementation: a hand-written JSON-RPC 2.0 + MCP router in `src/jsonrpc.js`; the `@modelcontextprotocol/sdk` npm package is **not** used at runtime.
- Advertised `protocolVersion`: hardcoded to `"2025-06-18"` in `src/jsonrpc.js` (not detected from an SDK). Update the constant there if the MCP spec date changes.

## Initialization

```
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": { "name": "<agent>", "version": "<x.y.z>" }
  }
}
```

The server returns its declared protocol version (`2025-06-18`) and server capabilities. There is no runtime version negotiation; clients should treat the documented date as the supported version until this file is updated.

## Tool list

`POST /mcp { "method": "tools/list" }` returns the schemas for all 8 tools:

1. `get_lunar_garden_signal`
2. `get_weather_soil_forecast`
3. `get_soil_profile`
4. `get_air_quality_uv`
5. `find_garden_care_windows`
6. `plan_garden_care`
7. `explain_care_decision`
8. `generate_agent_brief`

Schemas for inputs and outputs follow the MCP `tools/list` specification. Each tool's full schema is returned by the server and not duplicated here to avoid drift.

## Tool semantics

### 1. get_lunar_garden_signal

Combined lunar and panchang data relevant to gardening.

Input:
```
{
  "datetime"?: "YYYY-MM-DDTHH:MM:SSZ",  // optional, default = now
  "lat"?: number,                         // optional, default 0 (equator)
  "lon"?: number                          // optional, default 0
}
```

Output highlights:
```
{
  "phase": "Waxing Gibbous" | ...,
  "illumination_pct": number,
  "age_days": number,
  "moon_sign": "Taurus" | ...,
  "moon_degree": number,
  "panchang": {
    "tithi": string,
    "nakshatra": string,
    "yoga": string,
    "karana": string,
    "vaara": string,
    "sunrise": "HH:MM",
    "sunset": "HH:MM",
    "moonrise": "HH:MM",
    "moonset": "HH:MM"
  },
  "source": "astrologyapi.com/v1/moon_phase_report|basic_panchang",
  "mock": boolean                          // true if served from local mock mode
}
```

### 2. get_weather_soil_forecast

Hourly weather + soil temperature/moisture forecast (24/48/72h).

Input:
```
{
  "lat": number,            // required
  "lon": number,            // required
  "hours"?: number          // optional, one of 24, 48, 72 (default 24)
}
```

Output highlights: `hourly[]` with `time, temp_c, precipitation_mm, precipitation_probability_pct, wind_speed_kmh, soil_temp_c_0cm, soil_moisture_m3m3_0to1cm`.

### 3. get_soil_profile

SoilGrids static baseline (optional, fail-soft).

Input:
```
{
  "lat": number,            // required
  "lon": number,            // required
  "depths"?: string[],      // optional
  "properties"?: string[]   // optional
}
```

Output: `profile[]` or `[]` if SoilGrids fails. Each entry: `property, depth, value, unit`.

### 4. get_air_quality_uv

Hourly UV index (24/48/72h).

Input:
```
{
  "lat": number,            // required
  "lon": number,            // required
  "hours"?: number          // optional, default 24
}
```

Output: `hourly[]` with `time, uv_index, uv_index_clear_sky`.

### 5. find_garden_care_windows

Optimal outdoor work windows based on weather + soil + UV constraints. Pure weather logic, no astrology.

Input:
```
{
  "lat": number,
  "lon": number,
  "activity": "watering" | "pruning" | "planting" | "harvesting",
  "hours"?: number,            // default 24
  "min_window_minutes"?: number // default 60
}
```

Output: `windows[]` each with `start_utc, end_utc, duration_minutes, score (0-100), weather_summary, soil_summary, uv_summary`.

### 6. plan_garden_care

Composite 24-72h structured care plan combining all atomic tools.

Input:
```
{
  "lat": number,
  "lon": number,
  "plants": string[],      // e.g. ["tomato", "basil"]
  "hours"?: number         // default 24
}
```

Output: `plan[]` each with `datetime_utc, action, plants[], lunar_context, panchang_context, weather_context, soil_context, uv_context, rationale, confidence (0-1)`.

### 7. explain_care_decision

Explainability for one plan item, citing rules + data sources.

Input:
```
{
  "plan_item": object,         // one item from plan_garden_care output
  "include_context"?: boolean  // default false
}
```

Output: `decision_summary, factors[], cited_rules[], cited_data_sources[], counterfactuals[]`.

### 8. generate_agent_brief

Inter-agent handoff brief for downstream agents (scheduling, monitoring).

Input:
```
{
  "lat": number,
  "lon": number,
  "plants": string[],
  "window_hours"?: number,    // default 24
  "audience_agent"?: string   // optional agent name hint
}
```

Output: `brief_id, summary, upcoming_actions[], watchpoints[], data_provenance, recommended_followups[]`.

## Error handling

All tools return JSON-RPC 2.0 standard error objects with a `code` and `message`. Invalid input returns HTTP 400 with a JSON body containing `error.message`. Internal errors return HTTP 500 with a redacted message (no secrets leaked).

## Data provenance

Each tool output includes a `source` field naming the upstream API. Composite tools (`plan_garden_care`, `generate_agent_brief`) include `data_provenance` listing all sources touched.

## Mock mode

When `LIVE_ASTROLOGY` is not `"true"` (the default in Gate 2), `get_lunar_garden_signal` returns deterministic mock data shaped exactly like the real response. The output's `mock` flag is set to `true` so callers can distinguish.

## Health check

`GET /healthz` returns HTTP 200 with body `OK`. Used for liveness probes.