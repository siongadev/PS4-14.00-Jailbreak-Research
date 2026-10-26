// One-shot adaptation of the WebKit 313577 regression test. The validated
// Helvetica control reached the synchronous FontFace then getter on this page.
if (typeof FontFace !== "function" || !document.fonts)
  return [{ id: "font_face_reentry", status: "unsupported", details: { reason: "font_loading_api_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function" || typeof api.isActive !== "function")
  return [{ id: "font_face_reentry", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_font_reentry").then(function () {
  if (!api.isActive())
    return [{ id: "font_face_reentry", status: "error", details: { error: "probe_timeout_before_load" } }];

  var originalThen = Object.getOwnPropertyDescriptor(FontFace.prototype, "then");
  var markerStyle = document.createElement("style");
  var fontStyle = document.createElement("style");
  var getterCalls = 0;
  var layoutReturned = false;
  var result = "returned";
  var face = null;
  try {
    markerStyle.textContent = "x{}";
    fontStyle.textContent = '@font-face { font-family: fw14_reentry; src: local("Helvetica"); }';
    document.head.appendChild(markerStyle);
    document.head.appendChild(fontStyle);
    void document.body.offsetHeight;

    var iterator = document.fonts[Symbol.iterator]();
    for (var step = iterator.next(); !step.done; step = iterator.next()) {
      if (String(step.value.family).replace(/["']/g, "") === "fw14_reentry") {
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
          api.markSync("font_getter_entered");
          markerStyle.remove();
          void document.body.offsetHeight;
          layoutReturned = true;
          api.markSync("font_layout_returned");
          return undefined;
        }
      });
      var promise = face.load();
      if (promise && typeof promise.catch === "function")
        promise.catch(function () {});
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
    id: "font_face_reentry",
    status: getterCalls === 1 && layoutReturned ? "pass" : "fail",
    details: { getter_calls: getterCalls, layout_returned: layoutReturned, result: result }
  }];
});
