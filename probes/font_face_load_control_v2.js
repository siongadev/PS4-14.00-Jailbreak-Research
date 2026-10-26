// Counts only the synchronous FontFace then-getter callback during local-font
// loads. No stylesheet is removed from the getter; all changes are restored.
var ids = ["helvetica_control", "arial_control", "missing_font_control"];
var names = ["Helvetica", "Arial", "__fw14_missing_font_control__"];
function unsupported(reason) {
  return ids.map(function (id) {
    return { id: id, status: "unsupported", details: { reason: reason } };
  });
}
if (typeof FontFace !== "function" || !document.fonts)
  return unsupported("font_loading_api_unavailable");
if (!api || typeof api.mark !== "function" || typeof api.isActive !== "function")
  return ids.map(function (id) {
    return { id: id, status: "error", details: { error: "marker_api_unavailable" } };
  });

return api.mark("before_font_control").then(function () {
  if (!api.isActive())
    return ids.map(function (id) {
      return { id: id, status: "error", details: { error: "probe_timeout_before_load" } };
    });

  var originalThen = Object.getOwnPropertyDescriptor(FontFace.prototype, "then");
  var getterCalls = 0;
  var checks = [];
  var styles = [];
  try {
    Object.defineProperty(FontFace.prototype, "then", {
      configurable: true,
      get: function () { getterCalls++; return undefined; }
    });
    for (var i = 0; i < ids.length; i++) {
      var family = "fw14_control_" + i;
      var style = document.createElement("style");
      style.textContent = '@font-face { font-family: ' + family + '; src: local("' + names[i] + '"); }';
      document.head.appendChild(style);
      styles.push(style);
      void document.body.offsetHeight;

      var face = null;
      var iterator = document.fonts[Symbol.iterator]();
      for (var step = iterator.next(); !step.done; step = iterator.next()) {
        if (String(step.value.family).replace(/["']/g, "") === family) {
          face = step.value;
          break;
        }
      }
      var details = { source: names[i], found: !!face, getter_calls_before: getterCalls };
      if (face) {
        try {
          var loaded = face.loaded;
          if (loaded && typeof loaded.catch === "function")
            loaded.catch(function () {});
          var promise = face.load();
          if (promise && typeof promise.catch === "function")
            promise.catch(function () {});
          details.font_status = String(face.status);
        } catch (error) {
          details.error = String(error).slice(0, 160);
        }
      }
      details.getter_calls_after = getterCalls;
      checks.push({ id: ids[i], status: face ? "pass" : "unsupported", details: details });
    }
  } finally {
    if (originalThen)
      Object.defineProperty(FontFace.prototype, "then", originalThen);
    else
      delete FontFace.prototype.then;
    for (var j = 0; j < styles.length; j++)
      styles[j].remove();
  }
  return checks;
});
