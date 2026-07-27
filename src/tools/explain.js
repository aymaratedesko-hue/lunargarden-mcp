// src/tools/explain.js - explain_care_decision tool.

import { explainCareDecision } from "../lib/explainer.js";

export const definition = {
  name: "explain_care_decision",
  description: "Explain the rationale, cited rules, and data sources behind one item from plan_garden_care output.",
  inputSchema: {
    type: "object",
    properties: {
      plan_item: { type: "object", description: "One item from plan_garden_care output. Required." },
      include_context: { type: "boolean", description: "If true, include full per-context payload. Default false." },
    },
    required: ["plan_item"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      decision_summary: { type: "string" },
      factors: { type: "array" },
      cited_rules: { type: "array" },
      cited_data_sources: { type: "array" },
      counterfactuals: { type: "array" },
      context: { type: "object" },
    },
    required: ["decision_summary", "factors", "cited_rules", "cited_data_sources", "counterfactuals"],
  },
};

export async function handler(args, _env) {
  if (!args || typeof args.plan_item !== "object" || args.plan_item === null) {
    throw new Error("plan_item is required and must be an object");
  }
  const result = explainCareDecision(args.plan_item, { include_context: !!args.include_context });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}