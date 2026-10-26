// Locate same-type slot reuse, then test whether the displaced wrapper writes
// the newly allocated canvas rather than the original one.
async function run() {
  await api.mark("before_reuse_write");
  var original = document.createElement("canvas");
  original.width = 4;
  original.height = 4;
  var inner = null;
  var outer = original.getContext("2d", {
    get desynchronized() {
      inner = original.getContext("2d");
      return false;
    }
  });
  if (!inner || !outer || inner === outer || original.getContext("2d") !== outer)
    return [{ id: "canvas_2d_reuse_write", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("reuse_write_created");
  var held = [];
  window.__fw14CanvasReuseWrite = { original: original, inner: inner,
    outer: outer, held: held };
  var aliasIndex = -1;
  for (var i = 0; i < 32; i++) {
    var canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    var context = canvas.getContext("2d");
    if (!context || context.canvas !== canvas)
      return [{ id: "canvas_2d_reuse_write", status: "error",
        details: { error: "fresh_context_failed", index: i } }];
    held.push({ canvas: canvas, context: context });
    if (inner.canvas === canvas) {
      aliasIndex = i;
      break;
    }
  }
  if (aliasIndex < 0)
    return [{ id: "canvas_2d_reuse_write", status: "pass",
      details: { alias_found: false, created_count: held.length } }];
  await api.mark("reuse_write_alias_found");
  var target = held[aliasIndex];
  target.context.fillStyle = "#ff0000";
  target.context.fillRect(0, 0, 1, 1);
  var before = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  await api.mark("reuse_write_before_draw");
  inner.fillStyle = "#0000ff";
  var sharedStyle = target.context.fillStyle === inner.fillStyle;
  inner.fillRect(0, 0, 1, 1);
  var after = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  var originalPixel = Array.prototype.join.call(
    outer.getImageData(0, 0, 1, 1).data, ",");
  await api.mark("reuse_write_after_draw");
  return [{ id: "canvas_2d_reuse_write", status: "pass",
    details: { alias_found: true, alias_index: aliasIndex,
      created_count: held.length, shared_fill_style: sharedStyle,
      target_before: before, target_after: after,
      original_after: originalPixel, target_changed: before !== after } }];
}
return run();
