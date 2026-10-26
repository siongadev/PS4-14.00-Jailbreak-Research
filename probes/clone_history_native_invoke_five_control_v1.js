// Check a five-call owned page chain before it is used for fd timing.
var native=window.__fw14NativeInvoke;
var result,phase="preflight";
try {
  if (!native || typeof native.call!=="function" ||
      typeof native.callMany!=="function")
    throw new Error("guarded_page_caller_missing");
  var pid=native.call("getpid",[]);
  if (pid.high!==0 || pid.value<=0)
    throw new Error("pid_baseline_invalid");
  if (api && typeof api.markSync==="function")
    api.markSync("native_five_preflight");
  phase="five_calls";
  var calls=[];
  for (var i=0;i<5;i++) calls.push({name:"getpid",args:[]});
  var sequence=native.callMany(calls);
  var matched=sequence && sequence.values.length===5 &&
    sequence.values.every(function (item) {
      return item.value===pid.value && item.high===0;
    });
  if (api && typeof api.markSync==="function")
    api.markSync("native_five_restored");
  result={id:"native_invoke_five_control_v1",
    status:matched ? "pass":"fail",
    details:{pid:pid.value,matched:matched,
      last_return:sequence && sequence.values &&
        sequence.values[4] ? sequence.values[4].value:null}};
} catch (error) {
  result={id:"native_invoke_five_control_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}
return [result];
