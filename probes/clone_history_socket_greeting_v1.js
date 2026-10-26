// Connect to two browser-reachable local sockets and read without blocking.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if (!n || !state || state.array[0]!==state.a || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) || n.frame.length<0x900 ||
      !n.wrappers || !n.wrappers.sys97 || !n.wrappers.sys98 ||
      !n.wrappers.sys29 || !n.wrappers.close)
    throw new Error("native_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  var frame=n.frame,original=Array.from(frame.subarray(0x500,0x720));
  var sockaddr=0x500,out=0x600,rows=[],closed=true;
  var targets=[
    ["absent","/system_tmp/Fw14NoSuchSocket"],
    ["gnm_restricted","/system_tmp/GnmCompositorRestricted"],
    ["video_proxy","/system_tmp/gpvdec_proxy"]
  ];
  try {
    for (var t=0;t<targets.length;t++) {
      var label=targets[t][0],path=targets[t][1],fd=-1;
      phase="socket_"+label;
      frame.fill(0,sockaddr,sockaddr+106);
      frame[sockaddr+1]=1;
      for (var p=0;p<path.length;p++)
        frame[sockaddr+2+p]=path.charCodeAt(p);
      var opened=n.call("sys97",[1,1,0]);
      if (opened.value<0 || opened.value>=1024 || opened.high!==0)
        throw new Error("socket_failed:"+label+":"+opened.value+"/"+
          n.readErrno());
      fd=opened.value;
      try {
        if (api && api.markSync) api.markSync("greeting_before_"+label);
        phase="connect_"+label;
        var conn=n.call("sys98",[fd,n.frameAddress+sockaddr,106]);
        if (conn.value!==0) {
          rows.push(label+":connect:"+conn.value+"/"+n.readErrno());
          continue;
        }
        frame.fill(0xa5,out,out+64);
        phase="recv_"+label;
        var recv=n.call("sys29",[fd,n.frameAddress+out,64,0x80,0,0]);
        var err=recv.value===-1?n.readErrno():0,hex="";
        if (recv.value>0 && recv.value<=64)
          for (var i=0;i<recv.value;i++)
            hex+=(frame[out+i]+256).toString(16).slice(1);
        rows.push(label+":recv:"+recv.value+"/"+err+"/"+hex);
        if (api && api.markSync) api.markSync("greeting_after_"+label);
      } finally {
        var c=n.call("close",[fd]);
        if (c.value!==0) closed=false;
      }
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x500+x]=original[x];
  }
  var end=n.call("getpid",[]);
  var restored=end.high===0 && end.value===pid.value &&
    original.every(function(v,i){return frame[0x500+i]===v;}) &&
    state.array[0]===state.a;
  result={id:"socket_greeting_v1",
    status:closed && restored && rows.length===3?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|"),closed:closed,
      restored:restored}};
} catch(error) {
  result={id:"socket_greeting_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
