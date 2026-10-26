// Exact read-shaped command from the captured 14.00 PosixForWebKit client.
// Its SYSTEM_LANGUAGE path calls RegMgr command 0x19 with fixed key
// 0x12356328ecf5617b, selector 0, and a 16-byte in/out record.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1400||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.sys532)
    throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var io=0x1000,so=0x1100;
  var savedIn=Array.from(f.subarray(io,io+32));
  var savedStatus=Array.from(f.subarray(so,so+16));
  var ret=null,err=0,record=[],status=[],inputGuard=false,statusGuard=false;
  try {
    f.fill(0xa5,io,io+32);f.fill(0xa5,so,so+16);
    var key=[0x7b,0x61,0xf5,0xec,0x28,0x63,0x35,0x12];
    for(var i=0;i<8;i++)f[io+i]=key[i];
    for(var j=8;j<12;j++)f[io+j]=0;
    for(var k=12;k<16;k++)f[io+k]=0;
    phase="call";
    if(api&&api.markSync)api.markSync("regmgr_language_before");
    ret=n.call("sys532",[0x19,0,n.frameAddress+so,n.frameAddress+io,16]);
    if(ret.value===-1)err=n.readErrno();
    if(api&&api.markSync)api.markSync("regmgr_language_after");
    record=Array.from(f.subarray(io,io+16));
    status=Array.from(f.subarray(so,so+4));
    inputGuard=Array.from(f.subarray(io+16,io+32)).every(function(v){return v===0xa5;});
    statusGuard=Array.from(f.subarray(so+4,so+16)).every(function(v){return v===0xa5;});
  }finally{
    for(var a=0;a<savedIn.length;a++)f[io+a]=savedIn[a];
    for(var b=0;b<savedStatus.length;b++)f[so+b]=savedStatus[b];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a&&
    savedIn.every(function(v,i){return f[io+i]===v;})&&
    savedStatus.every(function(v,i){return f[so+i]===v;});
  result={id:"regmgr_language_v1",status:ret&&restored&&inputGuard&&statusGuard?
    "pass":"fail",details:{pid:before.value,return_value:ret?ret.value:null,
    return_high:ret?ret.high:null,errno:err,
    record_hex:record.map(function(v){return(v+256).toString(16).slice(1);}).join(""),
    status_hex:status.map(function(v){return(v+256).toString(16).slice(1);}).join(""),
    navigator_language:String(navigator.language).slice(0,32),
    input_guard:inputGuard,status_guard:statusGuard,restored:restored}};
}catch(error){result={id:"regmgr_language_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
