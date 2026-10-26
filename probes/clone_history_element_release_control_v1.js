// Release a list after detaching its second Element, without changing entries.
var held = window.__fw14NodeState;
var result;
var phase = "preflight";
try {
  if (!held || held.list.length !== 8191 ||
      held.list.item(0) !== held.firstNode)
    throw new Error("missing_valid_held_list");
  var list = held.list;
  var element = list.item(1);
  if (!element || element === held.firstNode ||
      element.nodeName !== "SPAN" || !element.parentNode)
    throw new Error("invalid_second_element");
  var parent = element.parentNode;
  element.id = "fw14-element-probe";
  phase = "detach_element";
  parent.removeChild(element);
  var detached = element.parentNode === null &&
      element.id === "fw14-element-probe";
  if (!detached) throw new Error("element_not_detached");
  var nodeType = element.nodeType;
  var nodeName = element.nodeName;
  var nodeId = element.id;
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = new WeakRef(list);
  registry.register(list, "list");
  if (api && typeof api.markSync === "function") api.markSync("element_control_release");
  window.__fw14ElementState = {
    node: element, weak: weak, registry: registry,
    events: events, mode: "element-control", detached: detached
  };
  held.list = null;
  window.__fw14NodeState = null;
  list = null;
  held = null;
  result = { id: "element_release_control", status: "pass", details: {
    detached: detached, node_type: nodeType,
    node_name: nodeName, node_id: nodeId
  } };
} catch (error) {
  result = { id: "element_release_control", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
