// Sysmodule 14.00 RX+0xe49 selects RX+0x54e0 with key 0x7802c000
// when its own auth-info capability bit 62 is set. Test the exact
// read-shaped underlying syscall without changing module flags.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.wrappers.sys532||!n.frame||
     n.frame.length<0x1400||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress;
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var savedValue=Array.from(f.subarray(0x1000,0x1020));
  var savedStatus=Array.from(f.subarray(0x1100,0x1120));
  var ret=null,errno=0,value=0,status=0,changed=0,guards=false;
  try{
    f.fill(0xa5,0x1000,0x1020);f.fill(0xa5,0x1100,0x1120);
    phase="regmgr_key_read";
    if(api&&api.markSync)api.markSync("sysmodule_key_before");
    ret=n.call("sys532",[2,0x7802c000,a+0x1100,a+0x1000,4]);
    errno=ret.value===-1?n.readErrno():0;
    if(api&&api.markSync)api.markSync("sysmodule_key_after");
    var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
    value=dv.getUint32(0x1000,true);
    status=dv.getUint32(0x1100,true);
    for(var i=0;i<4;i++){
      if(f[0x1000+i]!==0xa5)changed++;
      if(f[0x1100+i]!==0xa5)changed++;
    }
    guards=Array.from(f.subarray(0x1004,0x1020)).every(function(v){return v===0xa5;})&&
      Array.from(f.subarray(0x1104,0x1120)).every(function(v){return v===0xa5;});
  }finally{
    for(var j=0;j<savedValue.length;j++)f[0x1000+j]=savedValue[j];
    for(var k=0;k<savedStatus.length;k++)f[0x1100+k]=savedStatus[k];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a&&
    savedValue.every(function(v,i){return f[0x1000+i]===v;})&&
    savedStatus.every(function(v,i){return f[0x1100+i]===v;});
  result={id:"sysmodule_regmgr_key_v1",status:guards&&restored?"pass":"fail",
    details:{pid:before.value,ret:ret.value,high:ret.high,errno:errno,
      value:value,status_word:status,changed:changed,guards:guards,
      restored:restored}};
}catch(error){result={id:"sysmodule_regmgr_key_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
