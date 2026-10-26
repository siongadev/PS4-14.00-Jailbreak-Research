// Read-only app-status query through byte-checked 14.00 SystemService code.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,frame=n&&n.frame;
  if (!n || !frame || !Number.isSafeInteger(n.frameAddress) ||
      !n.wrappers || typeof n.wrappers.service_status!=="number" ||
      frame.length<0x900) throw new Error("service_caller_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1) throw new Error("pid_invalid");
  var offset=0x500,original=Array.from(frame.subarray(offset,offset+16));
  var call,words=[];
  try {
    frame.fill(0xa5,offset,offset+16);
    phase="call";
    if (api && api.markSync) api.markSync("app_status_before");
    call=n.call("service_status",[n.frameAddress+offset]);
    if (api && api.markSync) api.markSync("app_status_after");
    var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
    for (var i=0;i<3;i++) words.push(dv.getUint32(offset+i*4,true));
  } finally {
    for (var k=0;k<original.length;k++) frame[offset+k]=original[k];
  }
  var end=n.call("getpid",[]);
  var restored=end.high===0 && end.value===pid.value &&
    original.every(function(v,i){return frame[offset+i]===v;});
  result={id:"service_app_status_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,return_code:(call.value>>>0).toString(16),
      return_high:call.high,words:words.map(function(x){
        return x.toString(16);}).join(","),restored:restored}};
} catch(error) {
  result={id:"service_app_status_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
