var held = window.__fw14NodeState;
var result;
try {
  if (!held || held.list.item(0) !== held.firstNode ||
      held.textNode.nodeType !== 3 || !held.textNode.parentNode)
    throw new Error("missing_valid_held_list");
  var list = held.list;
  var textNode = held.textNode;
  var parent = textNode.parentNode;
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = new WeakRef(list);
  registry.register(list, "list");
  parent.removeChild(textNode);
  var detached = textNode.parentNode === null && textNode.data === "text-probe";
  if (api && typeof api.markSync === "function") api.markSync("list_control_before_release");
  window.__fw14RefcountState = {
    textNode: textNode, weak: weak, registry: registry,
    events: events, mode: "unchanged", detached: detached
  };
  held.list = null;
  window.__fw14NodeState = null;
  list = null;
  held = null;
  result = { id: "list_release_control", status: "pass", details: {
    detached: detached, text_type: textNode.nodeType,
    text_data: textNode.data, mode: "unchanged"
  } };
} catch (error) {
  result = { id: "list_release_control", status: "error", details: {
    error: String(error).slice(0, 200)
  } };
}
return [result];
