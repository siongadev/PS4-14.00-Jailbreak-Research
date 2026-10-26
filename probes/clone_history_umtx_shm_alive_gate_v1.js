// Read-only UMTX_OP_SHM availability discriminator on one owned mapping.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.umtx ||
      typeof native.readErrno!=="function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("umtx_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress+0x100;
  if (address<0x200000000 || address>=0x900000000 ||
      frame.length<0x108)
    throw new Error("owned_mapping_invalid");
  var guard=Array.from(frame.subarray(0x100,0x108));
  phase="umtx_calls";
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_alive_preflight");
  function check(op, flags, pointer) {
    var returned=native.call("umtx",[0,op,flags,pointer,0]);
    var errno=returned.value===-1?native.readErrno():-1;
    return {value:returned.value,high:returned.high,errno:errno};
  }
  var invalid=check(127,8,0);
  var nullAlive=check(25,8,0);
  var mappedAlive=check(25,8,address);
  var guardRestored=guard.every(function (byte,index) {
    return frame[0x100+index]===byte;
  });
  var valid=[invalid,nullAlive,mappedAlive].every(function (entry) {
    return (entry.value===0 && entry.high===0) ||
      (entry.value===-1 && entry.high===0xffffffff &&
       entry.errno>0 && entry.errno<128);
  });
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_alive_restored");
  result={id:"umtx_shm_alive_gate_v1",
    status:valid&&guardRestored?"pass":"fail",
    details:{invalid_return:invalid.value,invalid_errno:invalid.errno,
      null_return:nullAlive.value,null_errno:nullAlive.errno,
      mapped_return:mappedAlive.value,mapped_errno:mappedAlive.errno,
      guard_restored:guardRestored,return_shapes_valid:valid,
      carrier_restored:state.array[0]===state.a}};
} catch (error) {
  result={id:"umtx_shm_alive_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
