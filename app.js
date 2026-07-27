// LunarGarden MCP - frontend client.
// All calls are same-origin POST /mcp (JSON-RPC 2.0). No secrets, no upstream calls.

const $ = (sel) => document.querySelector(sel);
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
    throw new Error(`HTTP ${res.status}: ${text}`);
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
        .map((k) => `<div class="plan-context-item"><div class="plan-context-label">${k}</div><div>${escapeHtml(JSON.stringify(ctx[k]))}</div></div>`)
        .join("");
      const div = document.createElement("div");
      div.className = "plan-item";
      div.innerHTML = `
        <div class="plan-item-head">
          <span class="plan-action">${escapeHtml(item.action || "action")}</span>
          <span class="plan-time">${escapeHtml(item.datetime_utc || "")}</span>
          ${conf !== null ? `<span class="plan-confidence ${confClass}">conf ${conf.toFixed(2)}</span>` : ""}
        </div>
        <div class="plan-plants">${escapeHtml((item.plants || []).join(", "))}</div>
        <p class="plan-rationale">${escapeHtml(item.rationale || "")}</p>
        <div class="plan-context">${ctxHtml}</div>
      `;
      planList.appendChild(div);
    }
  }
  planBoard.hidden = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
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
      lat: f.lat,
      lon: f.lon,
      plants: f.plants,
      hours: f.hours
    });
    const planText = (r && r.content && r.content[0] && r.content[0].text) || "";
    let parsed;
    try { parsed = JSON.parse(planText); } catch { parsed = { raw: planText }; }
    const planItems = (parsed && parsed.plan) || [];
    showJson("plan_garden_care (raw)", parsed);
    renderPlan(planItems);
    setStatus(`plan_garden_care returned ${planItems.length} item(s).`, "ok");
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

// On load: verify tools/list advertises exactly 8 tools.
(async () => {
  try {
    const tools = await listTools();
    setStatus(`Connected to /mcp. ${tools.length} tools advertised.`, "ok");
  } catch (err) {
    setStatus("Could not list tools: " + err.message, "error");
  }
})();