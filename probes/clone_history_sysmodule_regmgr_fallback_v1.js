// Sysmodule 14.00 RX+0xe59 uses the browser-side fallback key through
// RX+0x6700. Read the exact key with owned, guarded RegMgr buffers.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1400||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.sys532)
    throw new Error("plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var io=0x1000,so=0x1100;
  var savedIn=Array.from(f.subarray(io,io+32));
  var savedStatus=Array.from(f.subarray(so,so+16));
  var ret=null,err=0,recordHex="",status=0,guards=false;
  try{
    f.fill(0xa5,io,io+32);f.fill(0xa5,so,so+16);
    var key=[0x40,0x3f,0x1b,0x41,0x43,0x63,0xc4,0x1a];
    for(var i=0;i<8;i++)f[io+i]=key[i];
    for(var j=8;j<16;j++)f[io+j]=0;
    phase="regmgr_fallback_read";
    if(api&&api.markSync)api.markSync("sysmodule_fallback_before");
    ret=n.call("sys532",[0x19,0,n.frameAddress+so,n.frameAddress+io,16]);
    err=ret.value===-1?n.readErrno():0;
    if(api&&api.markSync)api.markSync("sysmodule_fallback_after");
    for(var k=0;k<16;k++)recordHex+=("0"+f[io+k].toString(16)).slice(-2);
    status=new DataView(f.buffer,f.byteOffset,f.byteLength).getUint32(so,true);
    guards=Array.from(f.subarray(io+16,io+32)).every(function(v){return v===0xa5;})&&
      Array.from(f.subarray(so+4,so+16)).every(function(v){return v===0xa5;});
  }finally{
    for(var a=0;a<savedIn.length;a++)f[io+a]=savedIn[a];
    for(var b=0;b<savedStatus.length;b++)f[so+b]=savedStatus[b];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a&&
    savedIn.every(function(v,i){return f[io+i]===v;})&&
    savedStatus.every(function(v,i){return f[so+i]===v;});
  result={id:"sysmodule_regmgr_fallback_v1",status:guards&&restored?"pass":"fail",
    details:{pid:before.value,ret:ret.value,high:ret.high,errno:err,
      status_word:status,record_hex:recordHex,guards:guards,
      restored:restored}};
}catch(error){result={id:"sysmodule_regmgr_fallback_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
