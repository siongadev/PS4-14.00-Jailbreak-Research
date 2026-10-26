api.log("Address readout unavailable on this page.\nRefresh to try again.");
return [{ id: "address_status_v1", status: "pass",
  details: { reason: "page_anchor_not_found" } }];
