// Isolate the old wrapper read from list finalization and allocation sprays.
var state = window.__fw14RefcountState;
var result;
var phase = "preflight";
try {
  if (!state || state.mode !== "mutated" || !state.textNode ||
      state.events.indexOf("list") < 0)
    throw new Error("missing_finalized_mutated_list");
  if (api && typeof api.markSync === "function") api.markSync("stale_text_before_read");
  phase = "read";
  var data = state.textNode.data;
  var type = state.textNode.nodeType;
  var name = state.textNode.nodeName;
  var detached = state.textNode.parentNode === null;
  if (api && typeof api.markSync === "function") api.markSync("stale_text_after_read");
  result = { id: "stale_text_read", status: "pass", details: {
    data: data, type: type, name: name, detached: detached
  } };
} catch (error) {
  result = { id: "stale_text_read", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
