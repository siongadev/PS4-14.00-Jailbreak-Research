// Read the detached Element wrapper only after the list-finalization result.
var state = window.__fw14ElementState;
var result;
var phase = "preflight";
try {
  if (!state || !state.node || state.events.indexOf("list") < 0)
    throw new Error("missing_finalized_element_list");
  if (api && typeof api.markSync === "function") api.markSync("element_before_stale_read");
  phase = "read";
  var id = state.node.id;
  var type = state.node.nodeType;
  var name = state.node.nodeName;
  var detached = state.node.parentNode === null;
  if (api && typeof api.markSync === "function") api.markSync("element_after_stale_read");
  result = { id: "element_stale_read", status: "pass", details: {
    mode: state.mode, id: id, type: type,
    name: name, detached: detached
  } };
} catch (error) {
  result = { id: "element_stale_read", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
