// 14.00 source-shaped SystemService chain: status output word 0 feeds
// kill-local-process. Compare service status and browser PID afterward.
var result=null,phase="preflight",n=null,f=null,saved=null,restored=false;
try {
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x220||!n.wrappers||
     typeof n.wrappers.service_status!=="number"||
     typeof n.wrappers.service_killlocal!=="number"||
     !s||s.array[0]!==s.a)
    throw new Error("service_caller_missing");
  f=n.frame;
  var a=n.frameAddress,dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  saved=Array.from(f.subarray(0x180,0x220));
  function hex12(){
    var text="";
    for(var i=0;i<12;i++)text+=("0"+f[0x180+i].toString(16)).slice(-2);
    return text;
  }
  var p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)
    throw new Error("pid_invalid");
  phase="status_before";
  f.fill(0xa5,0x180,0x220);
  var first=n.call("service_status",[a+0x180]);
  if(first.value!==0||first.high!==0)
    throw new Error("status_before_"+(first.value>>>0).toString(16));
  var beforeHex=hex12(),appId=dv.getUint32(0x180,true);
  if(appId===0||appId===0xffffffff||appId>=0x80000000)
    throw new Error("status_id_invalid_"+appId);
  var guards=true;
  for(var j=0x18c;j<0x220;j++)if(f[j]!==0xa5)guards=false;
  if(!guards)throw new Error("status_before_guard");
  phase="kill";
  if(api&&api.markSync)api.markSync("service_live_id_kill_before");
  var call=n.call("service_killlocal",[appId,0]);
  var ret=(call.value>>>0).toString(16);
  if(api&&api.markSync)api.markSync("service_live_id_kill_after");
  phase="status_after";
  f.fill(0xa5,0x180,0x220);
  var second=n.call("service_status",[a+0x180]);
  var afterHex=second.value===0&&second.high===0?hex12():"unavailable";
  for(var k=0x18c;k<0x220;k++)if(f[k]!==0xa5)guards=false;
  var q=n.call("getpid",[]);
  result={id:"service_status_kill_chain_v1",
    status:guards&&q.value===p.value&&q.high===0?"pass":"fail",
    details:{pid:p.value,app_id:appId,
      status_before:beforeHex,
      kill_hex:ret,kill_signed:call.value,
      status_after:afterHex,
      status_after_call:(second.value>>>0).toString(16),
      pid_after:q.value,guards:guards}};
} catch(error) {
  result={id:"service_status_kill_chain_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
} finally {
  if(f&&saved){
    for(var r=0;r<saved.length;r++)f[0x180+r]=saved[r];
    restored=true;
  }
}
if(result&&result.details)result.details.restored=restored;
return [result];
