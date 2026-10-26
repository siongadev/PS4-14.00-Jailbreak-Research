// Ordinary no-waiter UMTX_OP_WAKE_PRIVATE control on an owned address.
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
  var address=native.frameAddress+0x100;
  var guard=Array.from(native.frame.subarray(0x100,0x108));
  if (address<0x200000000 || address>=0x900000000 || guard.length!==8)
    throw new Error("owned_address_invalid");
  phase="wake_call";
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_wake_preflight");
  var returned=native.call("umtx",[address,16,1,0,0]);
  var errno=returned.value===-1?native.readErrno():-1;
  var guardRestored=guard.every(function (byte,index) {
    return native.frame[0x100+index]===byte;
  });
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_wake_restored");
  result={id:"umtx_wake_control_v1",
    status:returned.value===0&&returned.high===0&&guardRestored?"pass":"fail",
    details:{wake_return:returned.value,wake_high:returned.high,
      wake_errno:errno,guard_restored:guardRestored,
      carrier_restored:state.array[0]===state.a}};
} catch (error) {
  result={id:"umtx_wake_control_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
