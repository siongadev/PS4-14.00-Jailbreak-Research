// Live 14.00 libSceRegMgr RX+0x140 calls syscall 532 with command 0,
// two zero arguments, a four-byte output pointer, and two zero arguments.
// Reproduce only this observed read-shaped call with owned memory.
var result, phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.call!=="function" ||
      typeof native.wrappers.sys532!=="number")
    throw new Error("native_plan_missing");
  var frame=native.frame;
  var off=0x1d00;
  if (off+32>frame.length) throw new Error("frame_too_small");
  var original=Array.from(frame.subarray(off,off+32));
  var before=native.call("getpid",[]);
  if (before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("pid_invalid");
  var callResult, errno=null, after;
  try {
    for (var i=0;i<32;i++) frame[off+i]=0xA5;
    phase="regmgr_status0";
    if (api && typeof api.markSync==="function")
      api.markSync("regmgr_status0_before");
    callResult=native.call("sys532",[0,0,native.frameAddress+off,0,0]);
    if (api && typeof api.markSync==="function")
      api.markSync("regmgr_status0_after");
    if (callResult.value===-1) errno=native.readErrno();
    after=Array.from(frame.subarray(off,off+16));
  } finally {
    for (var j=0;j<32;j++) frame[off+j]=original[j];
  }
  var pidAfter=native.call("getpid",[]);
  var restored=true;
  for (var k=0;k<32;k++) if (frame[off+k]!==original[k]) restored=false;
  var guards=after.slice(4).every(function(x){return x===0xA5;});
  var out4hex=after.slice(0,4).map(function(x){
    return x.toString(16).padStart(2,"0");
  }).join("");
  result={id:"regmgr_status0_v2",
    status:restored && guards && pidAfter.value===before.value &&
      pidAfter.high===0?"pass":"fail",
    details:{pid:before.value,ret:callResult.value,
      errno:errno,out4:out4hex,guard_ok:guards,
      restored:restored,pid_ok:pidAfter.value===before.value}};
} catch(error) {
  result={id:"regmgr_status0_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
