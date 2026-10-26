// Compare PS4 14.00 op-25 ALIVE with the mapping in both candidate
// address slots. No registration, destruction, or racing is attempted.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.umtx ||
      typeof native.readErrno!=="function" || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("umtx_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress+0x100;
  if (address<0x200000000 || address>=0x900000000 ||
      frame.length<0x130)
    throw new Error("owned_mapping_invalid");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var guard=Array.from(frame.subarray(0x100,0x130));
  function call(obj,op,flags,uaddr1) {
    var returned=native.call("umtx",[obj,op,flags,uaddr1,0]);
    return {value:returned.value,high:returned.high,
      errno:returned.value===-1?native.readErrno():0};
  }
  function compact(entry) {
    return entry.value+"/"+entry.errno+"/"+entry.high;
  }
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_dualslot_preflight");
  phase="read_only_calls";
  var invalid=call(address,127,8,address);
  var objOnly=call(address,25,8,0);
  var uaddrOnly=call(0,25,8,address);
  var both=call(address,25,8,address);
  phase="postflight";
  var after=native.call("getpid",[]);
  var guardIntact=guard.every(function(byte,index) {
    return frame[0x100+index]===byte;
  });
  var shape=[invalid,objOnly,uaddrOnly,both].every(function(entry) {
    return (entry.value===0 && entry.high===0) ||
      (entry.value===-1 && entry.high===0xffffffff &&
       entry.errno>0 && entry.errno<128);
  });
  var restored=after.value===before.value && after.high===0 &&
    guardIntact && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_dualslot_restored");
  result={id:"umtx_shm_dual_slot_gate_v1",
    status:shape&&restored?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      invalid:compact(invalid),obj_only:compact(objOnly),
      uaddr_only:compact(uaddrOnly),both:compact(both),
      guard_intact:guardIntact,caller_restored:restored}};
} catch(error) {
  result={id:"umtx_shm_dual_slot_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
