// src/data.js - Inlined static assets served by the Worker.
// This avoids needing a separate Pages deployment during Gate 2 development.
// In production with [assets] binding, this can be replaced with env.ASSETS.fetch().

export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LunarGarden MCP</title>
  <link rel="stylesheet" href="/styles.css" />
  <link rel="icon" href="data:," />
</head>
<body>
  <header class="site-header">
    <h1>LunarGarden MCP</h1>
    <p class="subtitle">Astrology-aware garden care planning - same-origin MCP server</p>
    <p class="metadata">
      <span class="meta-item">Transport: JSON-RPC 2.0 over HTTP</span>
      <span class="meta-item">Endpoint: POST /mcp</span>
      <span class="meta-item">Agents Guide: <a href="/agents-guide.md">/agents-guide.md</a></span>
    </p>
  </header>

  <main class="container">
    <section class="controls">
      <h2>Plan garden care</h2>
      <form id="plan-form" autocomplete="off">
        <div class="row">
          <label>
            Latitude
            <input id="lat" type="number" step="any" value="10.762622" required />
          </label>
          <label>
            Longitude
            <input id="lon" type="number" step="any" value="106.660172" required />
          </label>
          <label>
            Hours
            <select id="hours">
              <option value="24" selected>24</option>
              <option value="48">48</option>
              <option value="72">72</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label class="grow">
            Plants (comma-separated)
            <input id="plants" type="text" value="tomato, basil, lettuce" required />
          </label>
        </div>
        <div class="actions">
          <button type="submit" id="plan-btn">Get plan</button>
          <button type="button" id="lunar-btn">Lunar signal</button>
          <button type="button" id="weather-btn">Weather + soil</button>
          <button type="button" id="uv-btn">UV</button>
          <button type="button" id="windows-btn">Find windows</button>
          <button type="button" id="brief-btn">Agent brief</button>
        </div>
      </form>
      <p id="status" class="status"></p>
    </section>

    <section id="result-section" class="result" hidden>
      <h2 id="result-title">Result</h2>
      <pre id="result-json" class="result-json"></pre>
    </section>

    <section id="plan-board" class="plan-board" hidden>
      <h2>Plan board</h2>
      <div id="plan-list"></div>
    </section>
  </main>

  <footer class="site-footer">
    <p>LunarGarden MCP - same-origin only, no client-side secrets.</p>
  </footer>

  <script src="/app.js?v=lunargarden-20260727-1" defer></script>
</body>
</html>
`;

export const STYLES_CSS = `:root {
  --bg: #0f1419;
  --surface: #1a2332;
  --surface-2: #232f42;
  --text: #e6edf3;
  --text-dim: #8b949e;
  --accent: #58a6ff;
  --accent-2: #79c0ff;
  --warn: #f85149;
  --ok: #3fb950;
  --border: #30363d;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.site-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.site-header h1 {
  margin: 0 0 4px 0;
  font-size: 22px;
}

.subtitle {
  margin: 0 0 8px 0;
  color: var(--text-dim);
  font-size: 13px;
}

.metadata {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--text-dim);
}

.meta-item code, .meta-item a {
  color: var(--accent);
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 32px;
}

.controls {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.controls h2 {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
}

label.grow { flex: 1; min-width: 200px; }

input, select {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 14px;
  font-family: inherit;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

button {
  background: var(--accent);
  color: #fff;
  border: 0;
  border-radius: 4px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

button:hover { background: var(--accent-2); }

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status {
  margin: 12px 0 0 0;
  font-size: 13px;
  color: var(--text-dim);
}

.status.error { color: var(--warn); }
.status.ok { color: var(--ok); }

.result, .plan-board {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.result h2, .plan-board h2 {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.result-json {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.plan-item {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  margin-bottom: 12px;
}

.plan-item-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.plan-action {
  font-weight: 600;
  font-size: 14px;
}

.plan-time {
  font-size: 12px;
  color: var(--text-dim);
  font-family: monospace;
}

.plan-confidence {
  font-size: 12px;
  color: var(--accent);
}

.plan-confidence.low { color: var(--warn); }

.plan-plants {
  font-size: 12px;
  color: var(--accent-2);
  margin-bottom: 6px;
}

.plan-rationale {
  font-size: 13px;
  margin: 0 0 8px 0;
}

.plan-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  font-size: 12px;
}

.plan-context-item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
}

.plan-context-label {
  color: var(--text-dim);
  font-size: 11px;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.site-footer {
  padding: 16px 32px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
}

@media (max-width: 640px) {
  .container { padding: 16px; }
  .site-header { padding: 16px; }
}
`;

export const APP_JS = `const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const resultSection = $("#result-section");
const resultTitle = $("#result-title");
const resultJson = $("#result-json");
const planBoard = $("#plan-board");
const planList = $("#plan-list");

let rpcId = 0;

function setStatus(text, kind) {
  statusEl.textContent = text || "";
  statusEl.className = "status" + (kind ? " " + kind : "");
}

function showJson(title, obj) {
  resultTitle.textContent = title;
  resultJson.textContent = JSON.stringify(obj, null, 2);
  resultSection.hidden = false;
}

async function callTool(name, args) {
  const id = ++rpcId;
  const body = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args || {} }
  };
  const res = await fetch("/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("HTTP " + res.status + ": " + text);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message || "RPC error");
  }
  return json.result;
}

async function listTools() {
  const res = await fetch("/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/list", params: {} })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result && json.result.tools ? json.result.tools : [];
}

function parsePlants(raw) {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function renderPlan(planItems) {
  planList.innerHTML = "";
  if (!Array.isArray(planItems) || planItems.length === 0) {
    planList.innerHTML = "<p>No plan items returned.</p>";
  } else {
    for (const item of planItems) {
      const conf = typeof item.confidence === "number" ? item.confidence : null;
      const confClass = conf !== null && conf < 0.5 ? "low" : "";
      const ctx = item.context || {};
      const ctxHtml = ["lunar", "panchang", "weather", "soil", "uv"]
        .filter((k) => ctx[k])
        .map((k) => '<div class="plan-context-item"><div class="plan-context-label">' + k + '</div><div>' + escapeHtml(JSON.stringify(ctx[k])) + '</div></div>')
        .join("");
      const div = document.createElement("div");
      div.className = "plan-item";
      div.innerHTML = '<div class="plan-item-head">'
        + '<span class="plan-action">' + escapeHtml(item.action || "action") + '</span>'
        + '<span class="plan-time">' + escapeHtml(item.datetime_utc || "") + '</span>'
        + (conf !== null ? '<span class="plan-confidence ' + confClass + '">conf ' + conf.toFixed(2) + '</span>' : "")
        + '</div>'
        + '<div class="plan-plants">' + escapeHtml((item.plants || []).join(", ")) + '</div>'
        + '<p class="plan-rationale">' + escapeHtml(item.rationale || "") + '</p>'
        + '<div class="plan-context">' + ctxHtml + '</div>';
      planList.appendChild(div);
    }
  }
  planBoard.hidden = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c]));
}

function readForm() {
  return {
    lat: parseFloat($("#lat").value),
    lon: parseFloat($("#lon").value),
    hours: parseInt($("#hours").value, 10) || 24,
    plants: parsePlants($("#plants").value)
  };
}

$("#plan-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = readForm();
  if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) {
    setStatus("Latitude/longitude invalid", "error");
    return;
  }
  setStatus("Calling plan_garden_care...");
  try {
    const r = await callTool("plan_garden_care", {
      lat: f.lat, lon: f.lon, plants: f.plants, hours: f.hours
    });
    const planText = (r && r.content && r.content[0] && r.content[0].text) || "";
    let parsed;
    try { parsed = JSON.parse(planText); } catch { parsed = { raw: planText }; }
    const planItems = (parsed && parsed.plan) || [];
    showJson("plan_garden_care (raw)", parsed);
    renderPlan(planItems);
    setStatus("plan_garden_care returned " + planItems.length + " item(s).", "ok");
  } catch (err) {
    setStatus("Error: " + err.message, "error");
  }
});

$("#lunar-btn").addEventListener("click", async () => {
  const f = readForm();
  setStatus("Calling get_lunar_garden_signal...");
  try {
    const r = await callTool("get_lunar_garden_signal", { datetime: new Date().toISOString(), lat: f.lat, lon: f.lon });
    const txt = (r && r.content && r.content[0] && r.content[0].text) || "";
    showJson("get_lunar_garden_signal", safeParse(txt));
    setStatus("Lunar signal retrieved.", "ok");
  } catch (err) { setStatus("Error: " + err.message, "error"); }
});

$("#weather-btn").addEventListener("click", async () => {
  const f = readForm();
  setStatus("Calling get_weather_soil_forecast...");
  try {
    const r = await callTool("get_weather_soil_forecast", { lat: f.lat, lon: f.lon, hours: f.hours });
    const txt = (r && r.content && r.content[0] && r.content[0].text) || "";
    showJson("get_weather_soil_forecast", safeParse(txt));
    setStatus("Weather + soil retrieved.", "ok");
  } catch (err) { setStatus("Error: " + err.message, "error"); }
});

$("#uv-btn").addEventListener("click", async () => {
  const f = readForm();
  setStatus("Calling get_air_quality_uv...");
  try {
    const r = await callTool("get_air_quality_uv", { lat: f.lat, lon: f.lon, hours: f.hours });
    const txt = (r && r.content && r.content[0] && r.content[0].text) || "";
    showJson("get_air_quality_uv", safeParse(txt));
    setStatus("UV retrieved.", "ok");
  } catch (err) { setStatus("Error: " + err.message, "error"); }
});

$("#windows-btn").addEventListener("click", async () => {
  const f = readForm();
  setStatus("Calling find_garden_care_windows...");
  try {
    const r = await callTool("find_garden_care_windows", { lat: f.lat, lon: f.lon, activity: "watering", hours: f.hours, min_window_minutes: 60 });
    const txt = (r && r.content && r.content[0] && r.content[0].text) || "";
    showJson("find_garden_care_windows", safeParse(txt));
    setStatus("Windows retrieved.", "ok");
  } catch (err) { setStatus("Error: " + err.message, "error"); }
});

$("#brief-btn").addEventListener("click", async () => {
  const f = readForm();
  setStatus("Calling generate_agent_brief...");
  try {
    const r = await callTool("generate_agent_brief", { lat: f.lat, lon: f.lon, plants: f.plants, window_hours: f.hours });
    const txt = (r && r.content && r.content[0] && r.content[0].text) || "";
    showJson("generate_agent_brief", safeParse(txt));
    setStatus("Brief retrieved.", "ok");
  } catch (err) { setStatus("Error: " + err.message, "error"); }
});

function safeParse(s) { try { return JSON.parse(s); } catch { return { raw: s }; } }

(async () => {
  try {
    const tools = await listTools();
    setStatus("Connected to /mcp. " + tools.length + " tools advertised.", "ok");
  } catch (err) {
    setStatus("Could not list tools: " + err.message, "error");
  }
})();
`;

export const AGENTS_GUIDE_MD = `# LunarGarden MCP - Agents Guide

This document describes the public Model Context Protocol (MCP) interface for LunarGarden, served at GET /agents-guide.md on the same origin as the application.

## Transport

- Protocol: MCP (JSON-RPC 2.0 over HTTP)
- Endpoint: POST /mcp (same-origin)
- Content-Type: application/json
- Version: advertised by the SDK at runtime (no hardcoded version in code)

## Initialization

POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "<runtime-detected>",
    "capabilities": {},
    "clientInfo": { "name": "<agent>", "version": "<x.y.z>" }
  }
}

The server returns its declared protocol version and server capabilities.

## Tool list

POST /mcp { "method": "tools/list" } returns schemas for all 8 tools:

1. get_lunar_garden_signal
2. get_weather_soil_forecast
3. get_soil_profile
4. get_air_quality_uv
5. find_garden_care_windows
6. plan_garden_care
7. explain_care_decision
8. generate_agent_brief

Full input/output schemas are returned by the server and not duplicated here.

## Tool summaries

### 1. get_lunar_garden_signal
Lunar phase + moon sign + Vedic panchang. Returns phase, illumination_pct, age_days, moon_sign, moon_degree, panchang { tithi, nakshatra, yoga, karana, vaara, sunrise, sunset, moonrise, moonset }, source, mock.

### 2. get_weather_soil_forecast
Hourly weather + soil forecast (24/48/72h). Returns hourly[] each with time, temp_c, precipitation_mm, precipitation_probability_pct, wind_speed_kmh, soil_temp_c_0cm, soil_moisture_m3m3_0to1cm.

### 3. get_soil_profile
SoilGrids static baseline (fail-soft). Returns profile[] or [] on failure. Each: property, depth, value, unit.

### 4. get_air_quality_uv
Hourly UV index (24/48/72h). Returns hourly[] with time, uv_index, uv_index_clear_sky.

### 5. find_garden_care_windows
Optimal outdoor work windows from weather + soil + UV constraints. Returns windows[] each with start_utc, end_utc, duration_minutes, score (0-100), weather_summary, soil_summary, uv_summary.

### 6. plan_garden_care
Composite 24-72h structured care plan. Returns plan[] each with datetime_utc, action, plants[], lunar_context, panchang_context, weather_context, soil_context, uv_context, rationale, confidence (0-1).

### 7. explain_care_decision
Explainability for one plan item. Returns decision_summary, factors[], cited_rules[], cited_data_sources[], counterfactuals[].

### 8. generate_agent_brief
Inter-agent handoff brief. Returns brief_id, summary, upcoming_actions[], watchpoints[], data_provenance, recommended_followups[].

## Error handling

All tools return JSON-RPC 2.0 standard error objects with code and message. Invalid input returns HTTP 400 with error.message. Internal errors return HTTP 500 with a redacted message.

## Data provenance

Each tool output includes a source field naming the upstream API. Composite tools include data_provenance listing all sources.

## Mock mode

When LIVE_ASTROLOGY is not "true" (default in Gate 2), get_lunar_garden_signal returns deterministic mock data shaped exactly like the real response. The output's mock flag is true.

## Health check

GET /healthz returns HTTP 200 with body OK.
`;