// Use selector 0's eight-byte output to test whether selector 4 changes it.
var result,phase="preflight",frame,original,off=0x800,len=0x40;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||!native.frame||
      !Number.isSafeInteger(native.frameAddress)||
      typeof native.wrappers.sys601!=="number")
    throw new Error("caller_missing");
  frame=native.frame;
  if(off+len+0x40>=frame.length)throw new Error("frame_small");
  original=Array.from(frame.subarray(off,off+len+0x40));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function readStatus(){
    frame.fill(0xa5,off,off+len+0x40);
    var c=native.call("sys601",[0,native.frameAddress+off,0,0,0,0]);
    var errno=c.value===-1?native.readErrno():null;
    var hex="",changed=0,guard=true;
    for(var i=0;i<8;i++)hex+=("0"+frame[off+i].toString(16)).slice(-2);
    for(var j=0;j<len;j++)if(frame[off+j]!==0xa5)changed++;
    for(var k=off+len;k<off+len+0x40;k++)
      if(frame[k]!==0xa5)guard=false;
    if(c.value!==0||c.high!==0||changed!==8||!guard)
      throw new Error("status_output_changed_or_failed_"+errno);
    return hex;
  }
  phase="status_before";
  var before=readStatus();
  if(api&&typeof api.markSync==="function")
    api.markSync("mdbg4_status_before");
  phase="request_4";
  var call=native.call("sys601",[4,0,0,0,0,0]);
  var errno4=call.value===-1?native.readErrno():null;
  if(api&&typeof api.markSync==="function")
    api.markSync("mdbg4_status_after");
  phase="status_after";
  var after=readStatus();
  var end=native.call("getpid",[]);
  result={id:"mdbg_request4_status_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,request_ret:call.value,
      request_errno:errno4===null?"ok":errno4,
      status_before:before,status_after:after,
      changed:before!==after}};
}catch(error){
  result={id:"mdbg_request4_status_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(frame&&original)
    for(var r=0;r<original.length;r++)frame[off+r]=original[r];
}
return [result];
