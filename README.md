# LunarGarden MCP

A public Model Context Protocol (MCP) server for astrology-aware garden care planning.

LunarGarden combines real external astrology data (lunar phase + Vedic panchang), hourly weather + soil forecasts, and static soil profiles into a structured 24-72 hour care plan with rationales and confidence scores.

## Stack

- **Cloudflare Worker** (`src/worker.js`)
- **Model Context Protocol** server (JSON-RPC 2.0 over HTTP at `/mcp`)
- **Same-origin frontend** (`index.html`, `styles.css`, `app.js`) served from the Worker
- **Caching** via Cloudflare KV with in-memory fallback for local development

## External APIs

| Source | Auth | Used for |
|---|---|---|
| AstrologyAPI.com | HTTP Basic (`ASTROLOGY_API_USER_ID` + `ASTROLOGY_API_KEY`) | `moon_phase_report`, `basic_panchang` |
| Open-Meteo Forecast | None | Hourly weather + soil temp/moisture |
| Open-Meteo Air Quality | None | Hourly UV index |
| SoilGrids ISRIC | None (optional, fail-soft) | Static soil properties |

## MCP Tools

| Tool | Purpose |
|---|---|
| `get_lunar_garden_signal` | Lunar phase + moon sign + Vedic panchang |
| `get_weather_soil_forecast` | Hourly weather + soil forecast (24-72h) |
| `get_soil_profile` | Static SoilGrids baseline (fail-soft) |
| `get_air_quality_uv` | Hourly UV index (24-72h) |
| `find_garden_care_windows` | Optimal outdoor work windows |
| `plan_garden_care` | Composite 24-72h structured care plan |
| `explain_care_decision` | Explainability for one plan item |
| `generate_agent_brief` | Inter-agent handoff brief |

Full schemas, input/output contracts, and example calls are documented in `/agents-guide.md` (served at the same origin).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | Frontend HTML |
| `GET`  | `/styles.css` | Frontend stylesheet |
| `GET`  | `/app.js` | Frontend logic + MCP client |
| `GET`  | `/healthz` | Liveness probe |
| `GET`  | `/agents-guide.md` | Public MCP agent documentation |
| `POST` | `/mcp` | JSON-RPC 2.0 MCP endpoint |

## Development

```bash
# Install
npm install

# Local dev server (memory cache, no real AstrologyAPI calls)
npx wrangler dev

# Production deploy (after explicit approval only)
npx wrangler deploy
```

## Secrets (production)

```bash
wrangler secret put ASTROLOGY_API_USER_ID
wrangler secret put ASTROLOGY_API_KEY
```

Real AstrologyAPI calls are disabled unless both env vars are present AND the `LIVE_ASTROLOGY` environment variable is explicitly set to `"true"`.

## Safety

- All secrets live in Cloudflare Worker secrets, never in source.
- Same-origin only: the browser never calls upstream APIs directly.
- Cache TTL: lunar 1h, weather 15min, soil 24h, UV 15min.
- SoilGrids is fail-soft: empty profile does not block composite output.
- Invalid input returns HTTP 400 with a clear `error.message`.

## License

MIT