// Compare read-only UMTX_OP_SHM/ALIVE responses on known live mappings
// against null, unmapped, and unsupported-operation controls on PS4 14.00.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.umtx ||
      !native.readMemory || !native.frame ||
      native.wrappers.service_launch_webapp!==0x83711e530 ||
      !state || state.array[0]!==state.a)
    throw new Error("umtx_plan_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var rx=native.readMemory(0x83711e530,4);
  if (rx[0]!==0x55 || rx[1]!==0x48 ||
      rx[2]!==0x89 || rx[3]!==0xe5)
    throw new Error("rx_mapping_changed");
  var address=native.frameAddress+0x100;
  if (!Number.isSafeInteger(address) || address<0x200000000 ||
      address>=0x900000000 || native.frame.length<0x108)
    throw new Error("heap_mapping_invalid");
  var guard=Array.from(native.frame.subarray(0x100,0x108));
  function check(op,flags,pointer) {
    var returned=native.call("umtx",[0,op,flags,pointer,0]);
    var errno=returned.value===-1?native.readErrno():0;
    return {value:returned.value,high:returned.high,errno:errno};
  }
  function compact(entry) {
    return entry.value+"/"+entry.errno+"/"+entry.high;
  }
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_mapping_preflight");
  phase="read_only_calls";
  var invalid=check(127,8,0);
  var nullAddress=check(25,8,0);
  var unmapped=check(25,8,0xdead);
  var heap=check(25,8,address);
  var executable=check(25,8,0x83711e530);
  phase="postflight";
  var after=native.call("getpid",[]);
  var guardIntact=guard.every(function(v,i) {
    return native.frame[0x100+i]===v;
  });
  var shape=[invalid,nullAddress,unmapped,heap,executable].every(
    function(entry) {
      return (entry.value===0 && entry.high===0) ||
        (entry.value===-1 && entry.high===0xffffffff &&
         entry.errno>0 && entry.errno<128);
    });
  var restored=after.value===before.value && after.high===0 &&
    guardIntact && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_mapping_restored");
  result={id:"umtx_shm_mapping_gate_v1",
    status:shape&&restored?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      invalid:compact(invalid),null_address:compact(nullAddress),
      unmapped:compact(unmapped),heap:compact(heap),
      executable:compact(executable),guard_intact:guardIntact,
      caller_restored:restored}};
} catch(error) {
  result={id:"umtx_shm_mapping_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
