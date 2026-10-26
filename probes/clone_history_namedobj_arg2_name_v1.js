// Separate 557 arg2 from the name's terminator position on 14.00.
// Each successful object is deleted with the same 0x4000 kind.
var result,phase="preflight",live=0;
try {
  var native=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if(!native||!native.wrappers||!native.wrappers.sys557||
     !native.wrappers.sys558||!native.frame||
     !Number.isSafeInteger(native.frameAddress)||!state||
     state.array[0]!==state.a)throw new Error("native_plan_missing");
  var frame=native.frame,off=0x300,len=48;
  if(off+len>frame.length)throw new Error("frame_too_small");
  var saved=Array.from(frame.subarray(off,off+len));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function name(text){
    frame.fill(0,off,off+len);
    for(var i=0;i<text.length;i++)frame[off+i]=text.charCodeAt(i);
  }
  function invoke(arg2){
    var r=native.call("sys557",[native.frameAddress+off,arg2,0x4000,0,0,0]);
    var errno=r.value===-1?native.readErrno():0;
    if(r.value>0&&r.value<0x1000000)live=r.value;
    return {value:r.value,errno:errno};
  }
  function cleanup(){
    if(!live)return {value:null,errno:null};
    var r=native.call("sys558",[live,0x4000,0,0,0,0]);
    var errno=r.value===-1?native.readErrno():0;
    if(r.value===0)live=0;
    return {value:r.value,errno:errno};
  }
  if(api&&typeof api.markSync==="function")api.markSync("nobj_arg2_before");
  phase="short_arg2_zero";
  name("Fw14Arg2Zero");
  var zero=invoke(0),zeroDel=cleanup();
  if(live)throw new Error("zero_cleanup_failed");
  phase="short_arg2_pointer";
  name("Fw14Arg2Ptr");
  var pointer=invoke(native.frameAddress+0x500),pointerDel=cleanup();
  if(live)throw new Error("pointer_cleanup_failed");
  phase="long_name";
  name("ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
  var longName=invoke(0);cleanup();
  if(api&&typeof api.markSync==="function")api.markSync("nobj_arg2_after");
  for(var j=0;j<len;j++)frame[off+j]=saved[j];
  var restored=true;
  for(var k=0;k<len;k++)if(frame[off+k]!==saved[k])restored=false;
  var end=native.call("getpid",[]);
  var pidOk=end.high===0&&end.value===pid.value&&state.array[0]===state.a;
  result={id:"namedobj_arg2_name_v1",status:(!live&&restored&&pidOk)?"pass":"fail",
    details:{pid:pid.value,zero:zero.value,zero_errno:zero.errno,
      zero_del:zeroDel.value,pointer:pointer.value,pointer_errno:pointer.errno,
      pointer_del:pointerDel.value,long_name:longName.value,
      long_errno:longName.errno,
      live_handle:live,pid_ok:pidOk,restored:restored}};
}catch(error){
  result={id:"namedobj_arg2_name_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180),live_handle:live}};
}
return [result];
