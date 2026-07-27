# Test Plan - LunarGarden MCP (Gate 2)

This document describes the minimum verification suite for the Gate 2
public skeleton of the LunarGarden MCP server. All tests below are
expected to run without any live API credentials except where noted.

## 1. Mock mode (default)

- Default state: `LIVE_ASTROLOGY` is unset (or not `"true"`).
- `get_lunar_garden_signal` returns deterministic mock data shaped exactly
  like the real AstrologyAPI response.
- The output's `mock` field is `true`.
- `plan_garden_care` and `generate_agent_brief` complete successfully using
  mock lunar + panchang + Open-Meteo + SoilGrids data.

## 2. `/healthz`

- `GET /healthz` returns HTTP 200 with body `OK` (text/plain).
- Cache headers: `no-store` so liveness probes always reflect current state.

## 3. `/agents-guide.md`

- `GET /agents-guide.md` returns HTTP 200 with body in `text/markdown`.
- Response includes exactly 8 tool sections with the names documented under
  the Tool list section.
- No real credentials appear in the body.

## 4. `/mcp initialize`

- `POST /mcp` with `{ "jsonrpc": "2.0", "id": 1, "method": "initialize", ... }`
  returns HTTP 200.
- Response contains `result.protocolVersion` (hardcoded `"2025-06-18"` in
  `src/jsonrpc.js`).
- Response contains `result.serverInfo` and `result.capabilities`.

## 5. `/mcp tools/list` returns exactly 8 tools

- `POST /mcp { "method": "tools/list" }` returns HTTP 200.
- `result.tools.length === 8`.
- Names (in any order):
  1. `get_lunar_garden_signal`
  2. `get_weather_soil_forecast`
  3. `get_soil_profile`
  4. `get_air_quality_uv`
  5. `find_garden_care_windows`
  6. `plan_garden_care`
  7. `explain_care_decision`
  8. `generate_agent_brief`

## 6. `/mcp tools/call` all 8 tools in mock mode

For each tool name from section 5, send a `tools/call` request with a
minimal valid `arguments` object and verify:

- HTTP 200 with a JSON-RPC success response.
- `result.structuredContent` (or `result.content[0].text`) contains the
  schema fields documented in `agents-guide.md`.
- No live AstrologyAPI request is made (mock flag set; no outbound HTTP to
  `astrologyapi.com`).

Tools that may need network access in non-mock mode (Open-Meteo, SoilGrids)
must be exercised with their real endpoints only when explicit mock-off
testing is requested in a later gate. SoilGrids must remain fail-soft.

## 7. Invalid input safe errors

For each tool, send `tools/call` with one obviously invalid input (for
example: `lat: "not a number"`, `lat: 999`, `hours: 13`, empty `plants[]`)
and verify:

- HTTP 400 with a JSON-RPC error object.
- `error.code === -32602` (Invalid params).
- `error.message` is human-readable and contains no secrets.

## 8. Same-origin frontend

- `app.js` (both the standalone file and the inlined copy in
  `src/data.js`) only calls `fetch("/mcp")` and `fetch("/agents-guide.md")`.
- No `fetch`/`XMLHttpRequest` to any external origin appears in the served
  HTML or JS.
- `index.html` references only same-origin assets (`/styles.css`,
  `/app.js`).

## 9. Secret scan

- Repository must contain zero real credentials.
- Allowed env-var names: `ASTROLOGY_API_USER_ID`, `ASTROLOGY_API_KEY`,
  `LIVE_ASTROLOGY`, `CACHE`, `ENVIRONMENT`.
- Disallowed: any string resembling an actual API key, bearer token,
  email address, or KV namespace ID outside placeholder strings.

## 10. Gate 2B live AstrologyAPI scope

If/when live AstrologyAPI verification is authorized in a later gate, the
server MUST call exactly these two AstrologyAPI endpoints and no others:

- `POST astrologyapi.com/v1/moon_phase_report`
- `POST astrologyapi.com/v1/basic_panchang`

Both via Basic Auth using `ASTROLOGY_API_USER_ID` and `ASTROLOGY_API_KEY`
injected server-side. No additional AstrologyAPI endpoints are permitted
in this gate.