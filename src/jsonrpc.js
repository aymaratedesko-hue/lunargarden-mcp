// src/jsonrpc.js - JSON-RPC 2.0 + MCP router.
//
// Methods supported:
//   - initialize             -> returns server info + capabilities
//   - tools/list             -> returns array of all 8 tool schemas
//   - tools/call             -> dispatches to tool handler
//
// All other methods return JSON-RPC error -32601 (method not found).
// Per JSON-RPC 2.0, errors include a numeric code and a human-readable message.

import { getLunarGardenSignalTool } from "./tools/lunar.js";
import { getWeatherSoilForecastTool } from "./tools/weather.js";
import { getSoilProfileTool } from "./tools/soil.js";
import { getAirQualityUvTool } from "./tools/airquality.js";
import { findGardenCareWindowsTool } from "./tools/windows.js";
import { planGardenCareTool } from "./tools/plan.js";
import { explainCareDecisionTool } from "./tools/explain.js";
import { generateAgentBriefTool } from "./tools/brief.js";

const SERVER_INFO = {
  name: "lunargarden-mcp",
  version: "0.1.0",
  protocolVersion: "2025-06-18", // MCP spec supported by this server
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
};

const TOOL_DEFS = [
  getLunarGardenSignalTool.definition,
  getWeatherSoilForecastTool.definition,
  getSoilProfileTool.definition,
  getAirQualityUvTool.definition,
  findGardenCareWindowsTool.definition,
  planGardenCareTool.definition,
  explainCareDecisionTool.definition,
  generateAgentBriefTool.definition,
];

const TOOL_HANDLERS = {
  get_lunar_garden_signal: getLunarGardenSignalTool.handler,
  get_weather_soil_forecast: getWeatherSoilForecastTool.handler,
  get_soil_profile: getSoilProfileTool.handler,
  get_air_quality_uv: getAirQualityUvTool.handler,
  find_garden_care_windows: findGardenCareWindowsTool.handler,
  plan_garden_care: planGardenCareTool.handler,
  explain_care_decision: explainCareDecisionTool.handler,
  generate_agent_brief: generateAgentBriefTool.handler,
};

function rpcError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: "2.0", id: id == null ? null : id, error: err };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id == null ? null : id, result };
}

function validateToolName(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("tools/call requires params.name as a non-empty string");
  }
}

function ensureArgsObject(args) {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("tools/call params.arguments must be an object");
  }
  return args;
}

export async function handleJsonRpc(body, env) {
  if (!body || typeof body !== "object") {
    return rpcError(null, -32700, "Parse error: body must be a JSON object");
  }
  const { id, method, params } = body;
  if (typeof method !== "string") {
    return rpcError(id || null, -32600, "Invalid Request: method must be a string");
  }

  try {
    if (method === "initialize") {
      return rpcResult(id, {
        protocolVersion: SERVER_INFO.protocolVersion,
        serverInfo: { name: SERVER_INFO.name, version: SERVER_INFO.version },
        capabilities: SERVER_CAPABILITIES,
      });
    }
    if (method === "notifications/initialized") {
      // Notification, no result.
      return rpcResult(id, {});
    }
    if (method === "tools/list") {
      return rpcResult(id, { tools: TOOL_DEFS });
    }
    if (method === "tools/call") {
      const p = params || {};
      validateToolName(p.name);
      const args = ensureArgsObject(p.arguments);
      const handler = TOOL_HANDLERS[p.name];
      if (!handler) {
        return rpcError(id, -32601, `Unknown tool: ${p.name}`);
      }
      const result = await handler(args, env);
      return rpcResult(id, result);
    }
    if (method === "ping") {
      return rpcResult(id, {});
    }
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    const message = e && e.message ? e.message : "Internal error";
    // Tool input errors -> -32602 (Invalid params). Other -> -32603.
    const code = /must|invalid|finite|required|non-empty|cannot/i.test(message) ? -32602 : -32603;
    return rpcError(id, code, message);
  }
}