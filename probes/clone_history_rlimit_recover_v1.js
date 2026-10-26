var n=window.__fw14NativeInvoke,p=window.__fw14NativePlan;
var phase="preflight",result;
try{
  if(!n||!p||n.frame!==p.frame||!n.wrappers.getrlimit||
     !n.wrappers.setrlimit||typeof n.readErrno!=="function")
    throw new Error("native_limit_wrappers_missing");
  var f=n.frame,v=new DataView(f.buffer),base=n.frameAddress;
  var saved=Array.from(f.subarray(0x500,0x540));
  try{
    f.fill(0xa5,0x500,0x540);
    phase="read_before";
    var before=n.call("getrlimit",[8,base+0x500]);
    if(before.value!==0||before.high!==0)
      throw new Error("getrlimit_before_failed");
    var curLo=v.getUint32(0x500,true),curHi=v.getUint32(0x504,true);
    var maxLo=v.getUint32(0x508,true),maxHi=v.getUint32(0x50c,true);
    for(var i=0;i<16;i++)f[0x520+i]=f[0x500+i];
    var desired=(maxHi===0&&maxLo<1024)?maxLo:1024;
    v.setUint32(0x520,desired,true);
    v.setUint32(0x524,0,true);
    phase="restore_limit";
    var set=n.call("setrlimit",[8,base+0x520]);
    var setErrno=n.readErrno();
    phase="read_after";
    var after=n.call("getrlimit",[8,base+0x500]);
    if(after.value!==0||after.high!==0)
      throw new Error("getrlimit_after_failed");
    result={id:"rlimit_recover_v1",
      status:set.value===0&&set.high===0?"pass":"fail",
      details:{cur_lo:curLo,cur_hi:curHi,max_lo:maxLo,max_hi:maxHi,
        requested:desired,set_return:set.value,set_errno:setErrno,
        after_lo:v.getUint32(0x500,true),after_hi:v.getUint32(0x504,true)}};
  }finally{
    for(var j=0;j<saved.length;j++)f[0x500+j]=saved[j];
  }
}catch(error){
  result={id:"rlimit_recover_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
