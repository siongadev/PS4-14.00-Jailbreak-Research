// Harmless control for the authenticated probe milestone endpoint.
if (!api || typeof api.mark !== "function")
  return [{ id: "marker_round_trip", status: "error", details: { error: "marker_api_unavailable" } }];
return api.mark("round_trip").then(function (receipt) {
  return [{
    id: "marker_round_trip",
    status: receipt && receipt.phase === "round_trip" ? "pass" : "fail",
    details: { phase: receipt && receipt.phase ? receipt.phase : "missing" }
  }];
});
