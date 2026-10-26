var held = window.__fw14NodeState;
var result;
var phase = "preflight";
var changed = false;
try {
  if (!held || held.list.item(0) !== held.firstNode ||
      held.textNode.nodeType !== 3 || !held.textNode.parentNode ||
      held.list.length !== 8191)
    throw new Error("missing_valid_held_list");
  var view = held.view;
  var index = held.index;
  var original = held.elementBytes;
  var replacement = held.textBytes;
  for (var i = 0; i < 8; i++)
    if (view[index + i] !== original[i]) throw new Error("stale_vector_bytes");
  if (replacement.join(",") === original.join(","))
    throw new Error("same_pointer_bytes");
  var list = held.list;
  var textNode = held.textNode;
  var parent = textNode.parentNode;
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = new WeakRef(list);
  registry.register(list, "list");
  phase = "detach_text";
  parent.removeChild(textNode);
  var detached = textNode.parentNode === null && textNode.data === "text-probe";
  if (!detached) throw new Error("text_not_detached");
  phase = "replace_list_pointer";
  if (api && typeof api.markSync === "function") api.markSync("list_mutated_before_write");
  for (var w = 0; w < 8; w++) view[index + w] = replacement[w];
  changed = true;
  if (list.item(0) !== textNode) throw new Error("text_pointer_not_live");
  if (api && typeof api.markSync === "function") api.markSync("list_mutated_before_release");
  window.__fw14RefcountState = {
    textNode: textNode, weak: weak, registry: registry,
    events: events, mode: "mutated", detached: detached,
    view: view, index: index, originalBytes: original
  };
  held.list = null;
  window.__fw14NodeState = null;
  list = null;
  held = null;
  result = { id: "list_release_mutated", status: "pass", details: {
    detached: detached, changed: changed, matched_text: true,
    text_type: textNode.nodeType, mode: "mutated"
  } };
} catch (error) {
  if (changed && held && held.view && held.elementBytes)
    for (var x = 0; x < 8; x++) held.view[held.index + x] = held.elementBytes[x];
  result = { id: "list_release_mutated", status: "error", details: {
    phase: phase, changed: changed, error: String(error).slice(0, 200)
  } };
}
return [result];
