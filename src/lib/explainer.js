// src/lib/explainer.js - Build explainability output for one plan item.

export function explainCareDecision(planItem, opts) {
  const includeContext = !!(opts && opts.include_context);
  const ctx = planItem && planItem.context ? planItem.context : {};
  const citedRules = (planItem && planItem.cited_rules) || [];
  const dataSources = (planItem && planItem.data_sources) || [];
  const factors = [];

  for (const r of citedRules) {
    factors.push({
      factor: r.id,
      effect: r.effect,
      note: r.note,
    });
  }

  // Counterfactuals: which rules would have flipped the recommendation?
  const counterfactuals = [];
  for (const r of citedRules) {
    if (r.effect === "discourages") {
      counterfactuals.push({
        rule_id: r.id,
        condition: "if the rule had not applied",
        outcome: "confidence would have been higher or recommendation may have changed",
      });
    }
  }

  return {
    decision_summary: `${planItem && planItem.action ? planItem.action : "Care action"} at ${planItem && planItem.datetime_utc ? planItem.datetime_utc : "(unknown time)"} with confidence ${planItem && typeof planItem.confidence === "number" ? planItem.confidence.toFixed(2) : "n/a"}.`,
    factors,
    cited_rules: citedRules.map((r) => ({ id: r.id, sources: r.sources })),
    cited_data_sources: dataSources,
    counterfactuals,
    context: includeContext ? ctx : undefined,
  };
}