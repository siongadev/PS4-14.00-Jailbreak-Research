// Accumulate several displaced 2D wrappers, then find whether two point at
// the same newly allocated live 2D context.
async function run() {
  await api.mark("before_multi_stale");
  var stale = [];
  var reentry = [];
  var fresh = [];
  window.__fw14MultiStale = { stale: stale, reentry: reentry, fresh: fresh };
  for (var i = 0; i < 8; i++) {
    var canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    var inner = null;
    var outer = canvas.getContext("2d", {
      get desynchronized() {
        inner = canvas.getContext("2d");
        return false;
      }
    });
    if (!inner || !outer || inner === outer || canvas.getContext("2d") !== outer)
      return [{ id: "canvas_multi_stale_alias", status: "error",
        details: { error: "reentry_failed", index: i } }];
    stale.push(inner);
    reentry.push({ canvas: canvas, outer: outer });
  }
  await api.mark("multi_stale_created");
  var bestCount = 0;
  var bestIndex = -1;
  var scanned = 0;
  for (var j = 0; j < 32; j++) {
    var newCanvas = document.createElement("canvas");
    newCanvas.width = 4;
    newCanvas.height = 4;
    var context = newCanvas.getContext("2d");
    if (!context || context.canvas !== newCanvas)
      return [{ id: "canvas_multi_stale_alias", status: "error",
        details: { error: "fresh_context_failed", index: j } }];
    fresh.push({ canvas: newCanvas, context: context });
    var count = 0;
    for (var k = 0; k < stale.length; k++) {
      if (stale[k].canvas === newCanvas)
        count++;
    }
    scanned++;
    if (count > bestCount) {
      bestCount = count;
      bestIndex = j;
    }
    if (j === 7 || j === 15 || j === 31)
      await api.mark("multi_fresh_batch_" + (j + 1));
    if (bestCount >= 2)
      break;
  }
  var distinctWrappers = true;
  for (var a = 0; a < stale.length; a++) {
    for (var b = a + 1; b < stale.length; b++) {
      if (stale[a] === stale[b]) distinctWrappers = false;
    }
  }
  return [{ id: "canvas_multi_stale_alias", status: "pass",
    details: { stale_count: stale.length, fresh_count: fresh.length,
      best_alias_count: bestCount, best_fresh_index: bestIndex,
      distinct_wrappers: distinctWrappers, scanned_count: scanned } }];
}
return run();
