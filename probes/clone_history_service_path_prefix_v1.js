// Read the path prefix used by the 14.00 sceSystemServiceLaunchWebApp
// implementation. This invokes only its no-argument prefix import.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.readMemory ||
      native.wrappers.service_path_prefix!==0x83711c208 ||
      native.wrappers.service_launch_webapp!==0x83711e530)
    throw new Error("service_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync==="function")
    api.markSync("service_prefix_preflight");
  phase="prefix_call";
  var pointerResult=native.call("service_path_prefix",[]);
  var pointer=(pointerResult.value>>>0)+pointerResult.high*0x100000000;
  if (!Number.isSafeInteger(pointer) || pointer<0x100000000 ||
      pointer>=0x1000000000000)
    throw new Error("prefix_pointer_invalid");
  phase="prefix_read";
  var bytes=native.readMemory(pointer,128);
  var end=bytes.indexOf(0);
  if (end<0) throw new Error("prefix_not_terminated");
  var prefix="";
  for (var i=0;i<end;i++) {
    if (bytes[i]<0x20 || bytes[i]>0x7e)
      throw new Error("prefix_nonprintable");
    prefix+=String.fromCharCode(bytes[i]);
  }
  var after=native.call("getpid",[]);
  if (api && typeof api.markSync==="function")
    api.markSync("service_prefix_restored");
  result={id:"service_path_prefix_v1",
    status:after.value===before.value && after.high===0?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      pointer:"0x"+pointer.toString(16),prefix:prefix,
      expected_webapp_path:prefix+"/common/lib/webapp.self",
      nul_offset:end,caller_restored:after.value===before.value}};
} catch(error) {
  result={id:"service_path_prefix_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
