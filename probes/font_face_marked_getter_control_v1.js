// Controls for synchronous milestone submission inside FontFace's then getter.
// The stylesheet removal and layout run only after face.load returns.
if (typeof FontFace !== "function" || !document.fonts)
  return [{ id: "font_face_marked_getter_control", status: "unsupported", details: { reason: "font_loading_api_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function" || typeof api.isActive !== "function")
  return [{ id: "font_face_marked_getter_control", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_marked_getter").then(function () {
  if (!api.isActive())
    return [{ id: "font_face_marked_getter_control", status: "error", details: { error: "probe_timeout_before_load" } }];

  var originalThen = Object.getOwnPropertyDescriptor(FontFace.prototype, "then");
  var markerStyle = document.createElement("style");
  var fontStyle = document.createElement("style");
  var getterCalls = 0;
  var result = "returned";
  var layoutReturned = false;
  try {
    markerStyle.textContent = "x{}";
    fontStyle.textContent = '@font-face { font-family: fw14_marked_control; src: local("Helvetica"); }';
    document.head.appendChild(markerStyle);
    document.head.appendChild(fontStyle);
    void document.body.offsetHeight;

    var face = null;
    var iterator = document.fonts[Symbol.iterator]();
    for (var step = iterator.next(); !step.done; step = iterator.next()) {
      if (String(step.value.family).replace(/["']/g, "") === "fw14_marked_control") {
        face = step.value;
        break;
      }
    }
    if (!face)
      result = "font_face_missing";
    else {
      var loaded = face.loaded;
      if (loaded && typeof loaded.catch === "function")
        loaded.catch(function () {});
      Object.defineProperty(FontFace.prototype, "then", {
        configurable: true,
        get: function () {
          getterCalls++;
          api.markSync("marked_getter_entered");
          return undefined;
        }
      });
      var promise = face.load();
      if (promise && typeof promise.catch === "function")
        promise.catch(function () {});
      markerStyle.remove();
      void document.body.offsetHeight;
      layoutReturned = true;
      api.markSync("marked_layout_returned");
      result = String(face.status);
    }
  } catch (error) {
    result = String(error).slice(0, 160);
  } finally {
    if (originalThen)
      Object.defineProperty(FontFace.prototype, "then", originalThen);
    else
      delete FontFace.prototype.then;
    markerStyle.remove();
    fontStyle.remove();
  }
  return [{
    id: "font_face_marked_getter_control",
    status: getterCalls === 1 && layoutReturned ? "pass" : "fail",
    details: { getter_calls: getterCalls, layout_returned: layoutReturned, result: result }
  }];
});
