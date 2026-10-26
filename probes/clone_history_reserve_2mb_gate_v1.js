// PS4 14.00 number-675 memory-pool reserve shape, with conditional unmap.
var result, phase="preflight", f, saved;
var begin=0x1800, end=0x2000;
try {
  var n=window.__fw14NativeInvoke, s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<end||
     !Number.isSafeInteger(n.frameAddress)||
     typeof n.wrappers.sys675!=="number"||
     typeof n.wrappers.sys73!=="number"||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  f=n.frame;
  saved=Array.from(f.subarray(begin,end));
  var pid0=n.call("getpid",[]);
  if(pid0.high!==0||pid0.value<1||pid0.value>100000)
    throw new Error("pid_invalid");
  f.fill(0xa5,begin,end);
  var out=n.frameAddress+begin;
  phase="reserve";
  if(api&&typeof api.markSync==="function")api.markSync("reserve675_before");
  var c=n.call("sys675",[0,0x200000,0,0,out,0]);
  if(api&&typeof api.markSync==="function")api.markSync("reserve675_after");
  var err=c.value===-1?n.readErrno():0;
  var low=(f[begin]+f[begin+1]*256+f[begin+2]*65536+
      f[begin+3]*16777216)>>>0;
  var high=(f[begin+4]+f[begin+5]*256+f[begin+6]*65536+
      f[begin+7]*16777216)>>>0;
  var ptr=low+high*4294967296;
  var wrote=0,guard=true;
  for(var i=begin;i<begin+8;i++)if(f[i]!==0xa5)wrote++;
  for(var g=begin+8;g<end;g++)if(f[g]!==0xa5)guard=false;
  var plausible=c.value===0&&wrote>0&&
    Number.isSafeInteger(ptr)&&ptr>=0x100000&&
    ptr<0x1000000000000&&ptr%0x200000===0&&
    (ptr+0x200000<=n.frameAddress||ptr>=n.frameAddress+n.frame.length);
  var unmapRet=null,unmapErr=null;
  if(plausible){
    phase="release";
    if(api&&typeof api.markSync==="function")api.markSync("reserve675_release_before");
    var u=n.call("sys73",[ptr,0x200000,0,0,0,0]);
    unmapRet=u.value;unmapErr=u.value===-1?n.readErrno():0;
    if(api&&typeof api.markSync==="function")api.markSync("reserve675_release_after");
  }
  var pid1=n.call("getpid",[]);
  var pidOk=pid1.high===0&&pid1.value===pid0.value;
  result={id:"reserve_2mb_gate_v1",
    status:guard&&pidOk&&s.array[0]===s.a&&
      (!plausible||unmapRet===0)?"pass":"fail",
    details:{pid:pid0.value,ret:c.value,high:c.high,errno:err,
      ptr_hex:"0x"+high.toString(16)+("00000000"+low.toString(16)).slice(-8),
      wrote:wrote,plausible:plausible,unmap_ret:unmapRet,
      unmap_errno:unmapErr,guard:guard,pid_ok:pidOk}};
}catch(e){
  result={id:"reserve_2mb_gate_v1",status:"error",
    details:{phase:phase,error:String(e).slice(0,180)}};
}finally{
  if(f&&saved)for(var j=0;j<saved.length;j++)f[begin+j]=saved[j];
}
return [result];
