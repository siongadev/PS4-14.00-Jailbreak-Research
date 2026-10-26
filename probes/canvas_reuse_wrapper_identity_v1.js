// Inspect the rooted result of the immediately preceding reuse-write probe.
var state = window.__fw14CanvasReuseWrite;
if (!state || !state.inner || !state.held)
  return [{ id: "canvas_reuse_wrapper_identity", status: "error",
    details: { error: "missing_rooted_reuse_state" } }];
var aliasIndex = state.held.findIndex(function (item) {
  return item.canvas === state.inner.canvas;
});
return [{ id: "canvas_reuse_wrapper_identity", status: "pass",
  details: { alias_index: aliasIndex, alias_found: aliasIndex >= 0,
    same_wrapper: aliasIndex >= 0 && state.inner === state.held[aliasIndex].context,
    held_count: state.held.length } }];
