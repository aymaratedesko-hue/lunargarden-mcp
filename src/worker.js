// src/worker.js - Cloudflare Worker entry for LunarGarden MCP.
//
// Routes:
//   GET  /                  -> index.html (inlined)
//   GET  /styles.css        -> styles.css (inlined)
//   GET  /app.js            -> app.js (inlined)
//   GET  /healthz           -> "OK"
//   GET  /agents-guide.md   -> agents-guide.md (inlined)
//   POST /mcp               -> JSON-RPC 2.0 MCP endpoint (handleJsonRpc)
//
// Secrets (set via `wrangler secret put`, NEVER in code):
//   ASTROLOGY_API_USER_ID   (optional - real calls disabled if absent)
//   ASTROLOGY_API_KEY       (optional - real calls disabled if absent)
//
// Vars (set in wrangler.toml [vars]):
//   LIVE_ASTROLOGY          (default false; real AstrologyAPI calls require explicit "true")
//   ENVIRONMENT             (e.g. "development" | "production")

import { handleJsonRpc } from "./jsonrpc.js";
import { INDEX_HTML, STYLES_CSS, APP_JS, AGENTS_GUIDE_MD } from "./data.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

function textResponse(text, contentType, cacheControl) {
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl || "public, max-age=300",
      ...CORS_HEADERS,
    },
  });
}

async function readJsonBody(request) {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const err = new Error("Content-Type must be application/json");
    err.statusCode = 415;
    throw err;
  }
  let text;
  try {
    text = await request.text();
  } catch (_e) {
    const err = new Error("Failed to read request body");
    err.statusCode = 400;
    throw err;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_e) {
    const err = new Error("Body is not valid JSON");
    err.statusCode = 400;
    throw err;
  }
}

function makeCorsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return makeCorsPreflight();
    }

    // Frontend
    if (path === "/" || path === "/index.html") {
      return textResponse(INDEX_HTML, "text/html; charset=utf-8", "no-cache");
    }
    if (path === "/styles.css") {
      return textResponse(STYLES_CSS, "text/css; charset=utf-8", "public, max-age=300");
    }
    if (path === "/app.js") {
      return textResponse(APP_JS, "application/javascript; charset=utf-8", "no-cache");
    }

    // Health
    if (path === "/healthz") {
      return textResponse("OK", "text/plain; charset=utf-8", "no-store");
    }

    // Agents guide (public markdown)
    if (path === "/agents-guide.md") {
      return textResponse(AGENTS_GUIDE_MD, "text/markdown; charset=utf-8", "public, max-age=300");
    }

    // MCP JSON-RPC endpoint
    if (path === "/mcp") {
      if (request.method !== "POST") {
        return jsonResponse(
          { jsonrpc: "2.0", id: null, error: { code: -32600, message: "POST required for /mcp" } },
          405
        );
      }
      let body;
      try {
        body = await readJsonBody(request);
      } catch (e) {
        return jsonResponse(
          { jsonrpc: "2.0", id: null, error: { code: -32700, message: e.message || "Bad request" } },
          e.statusCode || 400
        );
      }
      try {
        const result = await handleJsonRpc(body, env);
        return jsonResponse(result, 200);
      } catch (e) {
        return jsonResponse(
          { jsonrpc: "2.0", id: body && body.id ? body.id : null, error: { code: -32603, message: e.message || "Internal error" } },
          500
        );
      }
    }

    return textResponse("Not Found", "text/plain; charset=utf-8", "no-store").then((r) => {
      // Adjust status to 404 without rebuilding
      const out = new Response(r.body, { status: 404, headers: r.headers });
      return out;
    });
  },
};