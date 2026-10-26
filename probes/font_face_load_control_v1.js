// Non-mutating control for the font-face promise-assimilation callback path.
// The later WebKit regression removes a stylesheet in this getter; this
// control only counts getter calls and restores the prototype afterward.
if (typeof FontFace !== "function" || !document.fonts)
  return [{ id: "font_face_load_control", status: "unsupported", details: { reason: "font_loading_api_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.isActive !== "function")
  return [{ id: "font_face_load_control", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_font_control").then(function () {
  if (!api.isActive())
    return [{ id: "font_face_load_control", status: "error", details: { error: "probe_timeout_before_load" } }];

  var originalThen = Object.getOwnPropertyDescriptor(FontFace.prototype, "then");
  var calls = 0;
  var cases = [];
  var styles = [];
  var names = ["Helvetica", "Arial", "__fw14_missing_font_control__"];
  try {
    Object.defineProperty(FontFace.prototype, "then", {
      configurable: true,
      get: function () { calls++; return undefined; }
    });
    for (var i = 0; i < names.length; i++) {
      var family = "fw14_control_" + i;
      var style = document.createElement("style");
      style.textContent = '@font-face { font-family: ' + family + '; src: local("' + names[i] + '"); }';
      document.head.appendChild(style);
      styles.push(style);
      void document.body.offsetHeight;

      var face = null;
      var faces = document.fonts;
      if (typeof Symbol !== "undefined" && faces[Symbol.iterator]) {
        var iterator = faces[Symbol.iterator]();
        for (var step = iterator.next(); !step.done; step = iterator.next()) {
          if (String(step.value.family).replace(/["']/g, "") === family) {
            face = step.value;
            break;
          }
        }
      }
      var entry = { source: names[i], found: !!face, getter_calls_before: calls };
      if (face) {
        try {
          var loaded = face.loaded;
          if (loaded && typeof loaded.catch === "function")
            loaded.catch(function () {});
          var promise = face.load();
          if (promise && typeof promise.catch === "function")
            promise.catch(function () {});
          entry.status = String(face.status);
        } catch (error) {
          entry.error = String(error).slice(0, 160);
        }
      }
      entry.getter_calls_after = calls;
      cases.push(entry);
    }
  } finally {
    if (originalThen)
      Object.defineProperty(FontFace.prototype, "then", originalThen);
    else
      delete FontFace.prototype.then;
    for (var j = 0; j < styles.length; j++)
      styles[j].remove();
  }
  return [{
    id: "font_face_load_control",
    status: "pass",
    details: { getter_calls: calls, cases: cases }
  }];
});
