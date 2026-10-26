// Read-only comparison of the ordinary clock and FreeBSD's CLOCK_TAI=16.
// A 14.00 syscall number or clock ID is only a hypothesis until this call returns.
var result, phase="preflight", frame, saved;
var base=0x1800, span=0x100;
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if(!native || typeof native.call!=="function" ||
      typeof native.readErrno!=="function" ||
      typeof native.wrappers.sys232!=="number" ||
      typeof native.wrappers.sys234!=="number" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("clock_caller_missing");
  frame=native.frame;
  if(base+span>frame.length)throw new Error("owned_frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  frame.fill(0x5a,base,base+span);
  function hex(bytes) {
    return Array.from(bytes).map(function(v){return (v+256).toString(16).slice(-2);}).join("");
  }
  function nsec(bytes) {
    return bytes[8]+bytes[9]*256+bytes[10]*65536+bytes[11]*16777216;
  }
  function readClock(name, clockId) {
    frame.fill(0xa5,base,base+16);
    var returned=native.call(name,[clockId,native.frameAddress+base,0,0,0,0]);
    var errno=returned.value===-1?native.readErrno():0;
    var bytes=frame.slice(base,base+16);
    return {ret:returned.value,high:returned.high,errno:errno,
      output:hex(bytes),nsec:nsec(bytes),
      changed:Array.from(bytes).some(function(v){return v!==0xa5;})};
  }
  var pid=native.call("getpid",[]);
  if(pid.high!==0 || pid.value<1)throw new Error("pid_control_invalid");
  phase="realtime_controls";
  var time0=readClock("sys232",0);
  var res0=readClock("sys234",0);
  if(time0.ret!==0 || time0.high!==0 || !time0.changed ||
      time0.nsec>=1000000000 || res0.ret!==0 ||
      res0.high!==0 || !res0.changed || res0.nsec>=1000000000)
    throw new Error("realtime_control_failed");
  phase="clock16_read";
  if(api && typeof api.markSync==="function")api.markSync("clock16_v2_before");
  var time16=readClock("sys232",16);
  var res16=readClock("sys234",16);
  if(api && typeof api.markSync==="function")api.markSync("clock16_v2_after");
  var end=native.call("getpid",[]);
  var guard=Array.from(frame.subarray(base+16,base+span)).every(function(v){return v===0x5a;});
  var shape=[time16,res16].every(function(v){
    return (v.ret===0 && v.high===0 && v.changed && v.nsec<1000000000) ||
      (v.ret===-1 && v.high===0xffffffff && v.errno>0 && v.errno<128);
  });
  result={id:"clock_tai_read_v2",
    status:guard && shape && end.high===0 && end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,
      realtime_controls:time0.ret+"/"+time0.output+","+res0.ret+"/"+res0.output,
      clock16_time_ret:time16.ret,clock16_time_errno:time16.errno,
      clock16_time_output:time16.output,
      clock16_res_ret:res16.ret,clock16_res_errno:res16.errno,
      clock16_res_output:res16.output,guard:guard,
      carrier_restored:state.array[0]===state.a}};
} catch(error) {
  result={id:"clock_tai_read_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
} finally {
  if(frame && saved) {
    for(var i=0;i<saved.length;i++)frame[base+i]=saved[i];
    result.details.frame_restored=saved.every(function(v,i){return frame[base+i]===v;});
  }
}
return [result];
