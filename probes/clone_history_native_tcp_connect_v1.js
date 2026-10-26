// Verify the browser's native AF_INET/TCP path to the page's own collector.
// Connect and close only; no payload or memory bytes are transmitted.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if (!n || !state || state.array[0]!==state.a || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) || n.frame.length<0x900 ||
      !n.wrappers || !n.wrappers.sys97 || !n.wrappers.sys98 ||
      !n.wrappers.close)
    throw new Error("native_plan_missing");
  var octets=String(location.hostname).split(".").map(Number);
  var port=Number(location.port);
  if (octets.length!==4 || octets.some(function(v){
      return !Number.isInteger(v) || v<0 || v>255;
    }) || !Number.isInteger(port) || port<1 || port>65535)
    throw new Error("collector_address_not_ipv4");
  var before=n.call("getpid",[]);
  if (before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("pid_control_failed");
  var frame=n.frame,offset=0x500,saved=Array.from(frame.subarray(offset,offset+32));
  var fd=-1,opened,connected,openErr=0,connectErr=0,closeRet=null;
  try {
    frame.fill(0,offset,offset+32);
    frame[offset]=16; frame[offset+1]=2; // FreeBSD sockaddr_in length, AF_INET.
    frame[offset+2]=(port>>>8)&255; frame[offset+3]=port&255;
    for (var i=0;i<4;i++)frame[offset+4+i]=octets[i];
    phase="socket";
    if (api && api.markSync) api.markSync("native_tcp_before");
    opened=n.call("sys97",[2,1,0]);
    if(opened.value<0)openErr=n.readErrno();
    if(opened.high===0 && opened.value>=0 && opened.value<1024){
      fd=opened.value;
      phase="connect";
      connected=n.call("sys98",[fd,n.frameAddress+offset,16]);
      if(connected.value<0)connectErr=n.readErrno();
    }
    if (api && api.markSync) api.markSync("native_tcp_after");
  } finally {
    if(fd>=0){
      phase="close";
      closeRet=n.call("close",[fd]);
    }
    for(var j=0;j<saved.length;j++)frame[offset+j]=saved[j];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0 && after.value===before.value &&
    saved.every(function(v,k){return frame[offset+k]===v;}) &&
    state.array[0]===state.a;
  result={id:"native_tcp_connect_v1",
    status:opened && opened.value>=0 && connected &&
      connected.value===0 && closeRet && closeRet.value===0 &&
      restored?"pass":"fail",
    details:{pid:before.value,host:String(location.host),
      socket:opened?opened.value:null,socket_errno:openErr,
      connect:connected?connected.value:null,connect_errno:connectErr,
      close:closeRet?closeRet.value:null,restored:restored}};
}catch(error){
  result={id:"native_tcp_connect_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
