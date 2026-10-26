var details = {};
try {
  details.evaluate_type = typeof document.evaluate;
  details.result_type = typeof XPathResult;
  if (typeof document.evaluate === "function" && typeof XPathResult !== "undefined") {
    var root = document.createElement("div");
    root.appendChild(document.createElement("span"));
    root.appendChild(document.createTextNode("x"));
    var snapshot = document.evaluate("descendant-or-self::node()", root, null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    details.length = snapshot.snapshotLength;
    var types = [];
    for (var i = 0; i < snapshot.snapshotLength; i++)
      types.push(snapshot.snapshotItem(i).nodeType);
    details.types = types.join(",");
  }
  return [{ id: "xpath_snapshot_capability", status: "pass", details: details }];
} catch (error) {
  details.error = String(error).slice(0, 200);
  return [{ id: "xpath_snapshot_capability", status: "error", details: details }];
}
