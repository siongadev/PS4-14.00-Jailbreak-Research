var state = window.__fw14NodeState;
var result;
var phase = "preflight";
var attempted = false;
var observedSameText = null;
var observedType = null;
var observedName = null;
var restored = false;
var bytesRestored = false;
try {
  if (!state) {
    result = { id: "text_pointer_followup", status: "pass", details: {
      attempted: false, reason: "no_held_live_list"
    } };
  } else {
    var view = state.view;
    var index = state.index;
    var original = state.elementBytes;
    var replacement = state.textBytes;
    var sameBytes = true;
    for (var i = 0; i < 8; i++)
      if (view[index + i] !== original[i]) sameBytes = false;
    var preflight = sameBytes && state.list.item(0) === state.firstNode &&
      state.list.item(1) !== state.firstNode &&
      state.textNode.nodeType === 3 && state.list.length === 8191 &&
      replacement.length === 8 && original.length === 8 &&
      replacement.join(",") !== original.join(",");
    if (preflight) {
      phase = "text_pointer_insert";
      if (api && typeof api.markSync === "function") api.markSync("text_pointer_before_write");
      attempted = true;
      try {
        for (var w = 0; w < 8; w++) view[index + w] = replacement[w];
        var observed = state.list.item(0);
        observedSameText = observed === state.textNode;
        observedType = observed ? observed.nodeType : null;
        observedName = observed ? observed.nodeName : null;
      } finally {
        for (var x = 0; x < 8; x++) view[index + x] = original[x];
      }
      phase = "restore_check";
      restored = state.list.item(0) === state.firstNode;
      bytesRestored = true;
      for (var j = 0; j < 8; j++)
        if (view[index + j] !== original[j]) bytesRestored = false;
      if (api && typeof api.markSync === "function") api.markSync("text_pointer_restored");
    }
    result = { id: "text_pointer_followup", status: "pass", details: {
      attempted: attempted, preflight: preflight,
      observed_same_text: observedSameText, observed_type: observedType,
      observed_name: observedName, restored: restored,
      bytes_restored: bytesRestored
    } };
  }
} catch (error) {
  result = { id: "text_pointer_followup", status: "error", details: {
    phase: phase, attempted: attempted, error: String(error).slice(0, 200),
    observed_same_text: observedSameText, restored: restored
  } };
} finally {
  window.__fw14NodeState = null;
}
return [result];
